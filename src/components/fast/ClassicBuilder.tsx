'use client';

import React, { useMemo, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Search } from 'lucide-react';

export type ClassicRole = 'P' | 'D' | 'C' | 'A';
export type Player = {
  id: string;
  name: string;
  team: string;
  role: ClassicRole;
  price: number; // FVM
};

type FormationKey =
  | '3-4-3' | '4-3-3' | '3-5-2' | '4-4-2' | '4-5-1' | '5-3-2' | '5-4-1';

const ROLE_ORDER: ClassicRole[] = ['P', 'D', 'C', 'A'];
const ROLE_COLORS: Record<ClassicRole, string> = {
  P: 'bg-amber-500', D: 'bg-emerald-500', C: 'bg-sky-500', A: 'bg-rose-500',
};
const REQUIRED_COUNTS: Record<ClassicRole, number> = { P: 3, D: 8, C: 8, A: 6 };

export default function ClassicBuilder({
  budget,
  onConfirm,
}: {
  budget: number;
  onConfirm: (team: Player[], left: number, formation: FormationKey) => void;
}) {
  // --- stato base ---
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Player[]>([]);
  const [formation, setFormation] = useState<FormationKey>('3-4-3');

  // filtri
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | ClassicRole>('all');
  const [teamFilter, setTeamFilter] = useState<'all' | string>('all');

  // % vincolanti per random
  const [pctP, setPctP] = useState(9);
  const [pctD, setPctD] = useState(15);
  const [pctC, setPctC] = useState(30);
  const [pctA, setPctA] = useState(46);

  // debug box dentro distribuzione crediti
  const [showDebug, setShowDebug] = useState(false);

// SOSTITUISCI questa riga:
// const lastSigRef = useRef<string>('');
// CON:
const lastSigsRef = useRef<string[]>([]);

  // --- derivati ---
  const teams = useMemo(
    () => Array.from(new Set(players.map((p) => p.team))).sort(),
    [players]
  );
  const spent = useMemo(() => selected.reduce((s, p) => s + p.price, 0), [selected]);
  const left  = Math.max(0, budget - spent);
  const countByRole = useMemo(() => {
    const m: Record<ClassicRole, number> = { P:0,D:0,C:0,A:0 };
    selected.forEach(p => { m[p.role] += 1; });
    return m;
  }, [selected]);

  const targets = useMemo(() => ({
    P: Math.round(budget * pctP / 100),
    D: Math.round(budget * pctD / 100),
    C: Math.round(budget * pctC / 100),
    A: Math.round(budget * pctA / 100),
  }), [budget, pctP, pctD, pctC, pctA]);

  const filtered = useMemo(() => {
    const used = new Set(selected.map(s => s.id));
    const term = q.trim().toLowerCase();
    return players.filter(p => {
      if (used.has(p.id)) return false;
      if (roleFilter !== 'all' && p.role !== roleFilter) return false;
      if (teamFilter !== 'all' && p.team !== teamFilter) return false;
      if (!term) return true;
      return p.name.toLowerCase().includes(term) || p.team.toLowerCase().includes(term);
    });
  }, [players, selected, q, roleFilter, teamFilter]);

  // --- util excel ---
  const roleMapToClassic = (r: string): ClassicRole | null => {
    const R = r.toUpperCase();
    if (['P','POR','PORTIERE'].includes(R)) return 'P';
    if (['D','DC','DD','DS','E','B','DEF'].includes(R)) return 'D';
    if (['C','M','T','MED','MID'].includes(R)) return 'C';
    if (['A','W','PC','ATT','FWD'].includes(R)) return 'A';
    return null;
  };
  const toNumber = (v: any) => {
    if (typeof v === 'number') return v;
    const n = Number(String(v ?? '').replace(',', '.').replace(/\s/g, ''));
    return Number.isFinite(n) ? n : NaN;
  };
  const shuffle = <T,>(arr: T[]) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  function parseExcelToPlayers(data: ArrayBuffer) {
    const wb = XLSX.read(data, { type: 'array' });
    const sheets = [
      ...wb.SheetNames.filter(n => /tutti|quot|list/i.test(n)),
      ...wb.SheetNames,
    ];

    for (const sn of sheets) {
      const ws = wb.Sheets[sn];
      if (!ws) continue;
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false }) as any[][];
      if (!rows.length) continue;

      // trova header nelle prime 40
      let hi = -1;
      for (let i=0;i<Math.min(40, rows.length);i++) {
        const r = (rows[i] ?? []).map(x => String(x ?? '').trim().toLowerCase());
        const ok = (r.includes('nome')||r.includes('giocatore')||r.includes('calciatore'))
                && (r.includes('squadra')||r.includes('team')||r.includes('club'))
                && (r.includes('r')||r.includes('ruolo')||r.includes('rm')||r.includes('ruolo mantra'));
        if (ok) { hi = i; break; }
      }
      if (hi < 0) continue;

      const header = rows[hi].map(h => String(h ?? '').trim().toLowerCase());
      const findIdx = (labels: string[]) => header.findIndex(h => labels.includes(h));

      const idxR  = findIdx(['r','ruolo']);
      const idxRM = findIdx(['rm','ruolo mantra','mantra']);
      const idxN  = findIdx(['nome','giocatore','calciatore']);
      const idxT  = findIdx(['squadra','team','club']);
      let idxFVM  = findIdx(['fvm','fvm m','quotazione fvm']);
      if (idxFVM < 0) idxFVM = 11; // fallback: colonna L

      const out: Player[] = [];
      for (let i=hi+1;i<rows.length;i++){
        const r = rows[i]; if(!r) continue;
        const name = String(r[idxN] ?? '').trim();
        const team = String(r[idxT] ?? '').trim();
        const roleRaw = String((idxR>=0? r[idxR] : r[idxRM]) ?? '').trim();
        const role = idxR>=0 && ['P','D','C','A'].includes(roleRaw.toUpperCase())
          ? roleRaw.toUpperCase() as ClassicRole
          : roleMapToClassic(roleRaw);
        const price = toNumber(r[idxFVM]);
        if (!name || !team || !role || !Number.isFinite(price) || price <= 0) continue;
        out.push({
          id: `${role}-${name}-${team}`.replace(/\s+/g, '_'),
          name, team, role, price: Math.round(price),
        });
      }
      if (out.length){
        out.sort((a,b)=>b.price - a.price);
        setPlayers(out);
        setSelected([]);
        setQ(''); setRoleFilter('all'); setTeamFilter('all');
        return;
      }
    }
    alert('Impossibile leggere il listone. Verifica Ruolo/RM, Nome, Squadra e FVM (o colonna L).');
  }

  function handleExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try { parseExcelToPlayers(ev.target?.result as ArrayBuffer); }
      catch { alert('Errore lettura file. Usa un .xlsx valido.'); }
    };
    reader.readAsArrayBuffer(file);
    e.currentTarget.value = '';
  }

  // --- add/remove ---
  const canAdd = (p: Player) =>
    (countByRole[p.role] ?? 0) < REQUIRED_COUNTS[p.role] &&
    p.price <= left &&
    selected.length < 25;

  const add    = (p: Player) => { if (canAdd(p)) setSelected(prev => [...prev, p]); };
  const remove = (id: string)  => setSelected(prev => prev.filter(x => x.id !== id));

// --- RANDOM potenziato ---
// SOSTITUISCI INTERAMENTE la funzione randomize() con questa:
function randomize() {
  if (!players.length) return;

  // pool per ruolo
  const poolByRole: Record<ClassicRole, Player[]> = { P:[], D:[], C:[], A:[] };
  for (const p of players) poolByRole[p.role].push(p);
  ROLE_ORDER.forEach(r => { poolByRole[r] = poolByRole[r].slice().sort((a,b)=>b.price-a.price); });

  // target di budget per ruolo (vincolanti come "massimo")
  const targetByRole: Record<ClassicRole, number> = {
    P: Math.round(budget * pctP / 100),
    D: Math.round(budget * pctD / 100),
    C: Math.round(budget * pctC / 100),
    A: Math.round(budget * pctA / 100),
  };

  // helper: pick per ruolo rispettando target e contando i pezzi
  const pickRole = (role: ClassicRole, need: number, cap: number): { chosen: Player[]; spent: number } => {
    // tiering per variabilità
    const pool = shuffle(poolByRole[role]); // randomizzo l'ordine di ingresso
    const sorted = pool.slice().sort((a,b)=>b.price-a.price); // per eventuali aggiustamenti

    const top = sorted.slice(0, Math.max(1, Math.floor(sorted.length*0.30)));
    const mid = sorted.slice(top.length, Math.max(top.length+1, Math.floor(sorted.length*0.70)));
    const low = sorted.slice(top.length+mid.length);

    const tryFill = (buckets: Player[][]): { chosen: Player[]; spent: number } => {
      const out: Player[] = [];
      let spent = 0;

      // 1-2 top se possibile
      for (const p of shuffle(buckets[0])) {
        if (out.length >= Math.min(2, need)) break;
        if (spent + p.price <= cap) { out.push(p); spent += p.price; }
      }

      // mid
      for (const p of shuffle(buckets[1])) {
        if (out.length >= need) break;
        if (spent + p.price <= cap) { out.push(p); spent += p.price; }
      }

      // low
      for (const p of shuffle(buckets[2])) {
        if (out.length >= need) break;
        if (spent + p.price <= cap) { out.push(p); spent += p.price; }
      }

      // se ancora mancano slot, prendo i più economici rimasti (sempre <= cap)
      let idx = sorted.length - 1;
      while (out.length < need && idx >= 0) {
        const p = sorted[idx--];
        if (out.find(x=>x.id===p.id)) continue;
        if (spent + p.price <= cap) { out.push(p); spent += p.price; }
        else break; // non posso più aggiungere senza sforare cap ruolo
      }
      return { chosen: out, spent };
    };

    // primo tentativo
    let { chosen, spent } = tryFill([top, mid, low]);

    // micro-upgrade intra-ruolo per limare il leftover, senza superare cap ruolo
    let guard = 0;
    while (guard++ < 80 && chosen.length === need) {
      // candidato swap: rimpiazzo il più economico con uno migliore se ci sto nel cap
      const cheapestIdx = chosen.reduce((mi, x, i)=> x.price < chosen[mi].price ? i : mi, 0);
      const cheapest = chosen[cheapestIdx];
      const better = sorted.find(p => !chosen.some(c=>c.id===p.id) && p.price > cheapest.price && (spent - cheapest.price + p.price) <= cap);
      if (!better) break;
      spent = spent - cheapest.price + better.price;
      chosen[cheapestIdx] = better;
    }

    return { chosen, spent };
  };

  const needByRole = REQUIRED_COUNTS;

  // Effettuo più tentativi e scelgo il migliore (leftover minore, niente duplicati)
  let bestTeam: Player[] = [];
  let bestLeft = Infinity;
  let attempts = 0;

  while (attempts++ < 16) {
    const team: Player[] = [];
    let spentTot = 0;

    // pick per ruolo a cap "vincolante"
    for (const r of ROLE_ORDER) {
      const capR = targetByRole[r];
      const { chosen, spent } = pickRole(r, needByRole[r], capR);
      // se non riesco a coprire i pezzi minimi, abortisco tentativo
      if (chosen.length !== needByRole[r]) { spentTot = budget + 1; break; }
      team.push(...chosen);
      spentTot += spent;
    }

    if (spentTot > budget) continue; // scarta tentativo

    // upgrade cross-ruolo: prova ad alzare qualche slot dove rimane margine globale
    let guard = 0;
    while (guard++ < 120) {
      let upgraded = false;
      for (const r of ROLE_ORDER) {
        const capR = targetByRole[r];
        const inRole = team.filter(p=>p.role===r).sort((a,b)=>a.price-b.price);
        const candidates = poolByRole[r].filter(p=>!team.some(t=>t.id===p.id)).sort((a,b)=>b.price-a.price);
        for (const cand of candidates) {
          // prova a sostituire il più economico
          const idx = inRole.findIndex(Boolean);
          if (idx<0) continue;
          const cur = inRole[0];
          const delta = cand.price - cur.price;
          if (delta <= 0) continue;
          if ( (team.filter(p=>p.role===r).reduce((s,p)=>s+p.price,0) + delta) > capR ) continue; // non superare cap ruolo
          if (spentTot + delta > budget) continue; // non superare budget globale
          // applico swap
          const idxTeam = team.findIndex(t=>t.id===cur.id);
          team[idxTeam] = cand;
          spentTot += delta;
          upgraded = true;
          break;
        }
        if (upgraded) break;
      }
      if (!upgraded) break;
    }

    const leftNow = budget - spentTot;
    const sig = team.map(p=>p.id).sort().join('|');
    const seen = new Set(lastSigsRef.current);

    if (!seen.has(sig) && leftNow >= 0 && leftNow <= bestLeft) {
      bestTeam = team;
      bestLeft = leftNow;
      if (bestLeft <= 1) break; // abbastanza a fondo cassa
    }
  }

  if (!bestTeam.length) return;

  // aggiorno memoria anti-duplicati (ultime 5)
  const sig = bestTeam.map(p=>p.id).sort().join('|');
  lastSigsRef.current = [sig, ...lastSigsRef.current.filter(s=>s!==sig)].slice(0,5);

  setSelected(bestTeam);
}

// --- fine randomize() ---

  // --- conferma ---
  const canConfirm =
    selected.length === 25 &&
    ROLE_ORDER.every(r => countByRole[r] === REQUIRED_COUNTS[r]) &&
    spent <= budget;

  function confirmTeam() {
    if (!canConfirm) return;
    onConfirm(selected, left, formation);
  }

  // --- UI ---
  return (
    <div className="space-y-4">
      {/* header: modulo + filtri + excel */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm">
          <label className="text-white/80 mr-2">Modulo</label>
          <select
            value={formation}
            onChange={(e)=>setFormation(e.target.value as FormationKey)}
            className="px-2 py-1 rounded-md bg-emerald-600/15 border border-emerald-500/30 text-white"
          >
            <option value="3-4-3">3-4-3</option>
            <option value="4-3-3">4-3-3</option>
            <option value="3-5-2">3-5-2</option>
            <option value="4-4-2">4-4-2</option>
            <option value="4-5-1">4-5-1</option>
            <option value="5-3-2">5-3-2</option>
            <option value="5-4-1">5-4-1</option>
          </select>
        </div>

        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/60" />
          <input
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            placeholder="Cerca nome o squadra…"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/10 text-white placeholder-white/60 border border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e)=>setRoleFilter(e.target.value as any)}
          className="px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20"
        >
          <option value="all">Tutti i ruoli</option>
          <option value="P">P</option><option value="D">D</option>
          <option value="C">C</option><option value="A">A</option>
        </select>

        <select
          value={teamFilter}
          onChange={(e)=>setTeamFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20"
        >
          <option value="all">Tutte le squadre</option>
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 cursor-pointer">
          <Upload className="h-4 w-4" /><span>Carica Excel</span>
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcel}/>
        </label>
      </div>

      {/* distribuzione crediti + random */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl bg-emerald-700/25 border border-emerald-500/30">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="font-semibold">Distribuzione crediti % (vincolante per il random)</div>
            <button
              type="button"
              onClick={()=>setShowDebug(v=>!v)}
              className="px-2 py-1 rounded-md bg-white/10 text-white hover:bg-white/15 text-xs"
              title="Mostra/Nascondi debug budget per ruolo"
            >{showDebug ? 'Nascondi debug' : 'Mostra debug'}</button>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <PercentInput label="Ruolo P" value={pctP} onChange={setPctP}/>
            <PercentInput label="Ruolo D" value={pctD} onChange={setPctD}/>
            <PercentInput label="Ruolo C" value={pctC} onChange={setPctC}/>
            <PercentInput label="Ruolo A" value={pctA} onChange={setPctA}/>
          </div>
          {showDebug && (
            <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {ROLE_ORDER.map(r=>{
                const spentR = selected.filter(p=>p.role===r).reduce((s,p)=>s+p.price,0);
                return (
                  <div key={r} className="rounded-lg bg-white/10 border border-white/10 p-3">
                    <div className="text-xs text-white/70">Ruolo {r}</div>
                    <div className="text-lg font-semibold">{targets[r]}</div>
                    <div className="text-xs">Spesi <span className="font-semibold">{spentR}</span></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="font-semibold mb-2">Randomizzatore (smart)</div>
          <p className="text-sm text-white/70 mb-3">
            Crea una rosa rispettando le percentuali per ruolo, usa quasi tutto il budget e rispetta 3P/8D/8C/6A.
          </p>
          <div className="flex items-center gap-2">
  <button onClick={randomize} className="px-3 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700">🎲 Randomizza</button>
  <button
    onClick={()=>{
      setSelected([]);
      // re-roll immediato, garantito diverso se possibile
      setTimeout(randomize, 0);
    }}
    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15"
  >
    Proponi alternativa
  </button>
</div>
        </div>
      </div>

      {/* stat */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatBox title="Budget" value={budget}/>
        <StatBox title="Speso" value={spent}/>
        <StatBox title="Rimanente" value={left} accent/>
        {ROLE_ORDER.map(r=>(
          <div key={r} className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center justify-between">
            <div>
              <div className="text-sm text-white/70">Ruolo {r}</div>
              <div className="text-xl font-semibold">{countByRole[r]}/{REQUIRED_COUNTS[r]}</div>
            </div>
            <div className={`h-3 w-3 rounded-full ${ROLE_COLORS[r]}`}/>
          </div>
        ))}
      </div>

      {/* elenco + rosa */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/5 border border-white/10">
          <div className="px-4 py-3 border-b border-white/10 font-semibold">Listone (FVM)</div>
          <div className="max-h-[520px] overflow-auto divide-y divide-white/10">
            {filtered.length===0 ? (
              <div className="p-4 text-sm text-white/70">Nessun giocatore trovato. Carica l’Excel o modifica i filtri.</div>
            ) : filtered.map(p=>(
              <div key={p.id} className="px-4 py-2 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.name} <span className="text-white/60">({p.team})</span></div>
                  <div className="text-xs text-white/70">Ruolo {p.role} • FVM {p.price}</div>
                </div>
                <button disabled={!canAdd(p)} onClick={()=>add(p)} className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed">Aggiungi</button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 flex flex-col">
          <div className="px-4 py-3 border-b border-white/10 font-semibold">La tua rosa ({selected.length}/25)</div>
          <div className="flex-1 max-h-[420px] overflow-auto divide-y divide-white/10">
            {selected.length===0 ? (
              <div className="p-4 text-sm text-white/70">Nessun giocatore selezionato.</div>
            ) : selected.map(p=>(
              <div key={p.id} className="px-4 py-2 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.role} • {p.name} <span className="text-white/60">({p.team})</span></div>
                  <div className="text-xs text-white/70">FVM {p.price}</div>
                </div>
                <button onClick={()=>remove(p.id)} className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/15">Rimuovi</button>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-white/10">
            <ul className="text-xs text-white/70 mb-2 space-y-1">
              <li>• Servono 25 giocatori.</li>
              <li>• Ruoli: 3P / 8D / 8C / 6A.</li>
              <li>• Non superare il budget.</li>
            </ul>
            <button disabled={!canConfirm} onClick={confirmTeam} className="w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed">Conferma rosa</button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="text-sm text-white/80">
          Budget: <span className="font-semibold">{budget}</span> • Rimasti: <span className="font-semibold text-emerald-400">{left}</span>
        </div>
      </div>
    </div>
  );
}

/* ---- piccoli componenti UI ---- */
function StatBox({ title, value, accent=false }: { title: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4">
      <div className="text-sm text-white/70">{title}</div>
      <div className={`text-2xl font-bold ${accent ? 'text-emerald-400':''}`}>{value}</div>
    </div>
  );
}
function PercentInput({ label, value, onChange }:{ label:string; value:number; onChange:(v:number)=>void }) {
  return (
    <div className="rounded-lg bg-white/10 border border-white/10 p-3">
      <div className="text-sm mb-1">{label}</div>
      <input
        type="number" min={0} max={100} step={1} value={value}
        onChange={(e)=>onChange(Number(e.target.value||0))}
        className="w-full px-2 py-1 rounded-md bg-white/90 text-slate-900"
      />
    </div>
  );
}
