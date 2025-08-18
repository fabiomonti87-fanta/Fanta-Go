'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Player, ClassicRole } from '@/components/fast/ClassicBuilder';

export const dynamic = 'force-dynamic';

type FormationKey = '3-4-3'|'4-3-3'|'3-5-2'|'4-4-2'|'4-5-1'|'5-3-2'|'5-4-1';

const FORM_SHAPE: Record<FormationKey, { D:number; C:number; A:number }> = {
  '3-4-3': { D:3, C:4, A:3 },
  '4-3-3': { D:4, C:3, A:3 },
  '3-5-2': { D:3, C:5, A:2 },
  '4-4-2': { D:4, C:4, A:2 },
  '4-5-1': { D:4, C:5, A:1 },
  '5-3-2': { D:5, C:3, A:2 },
  '5-4-1': { D:5, C:4, A:1 },
};

function useSavedRoster() {
  const [saved, setSaved] = useState<any>(null);
  useEffect(() => {
    try { const raw = localStorage.getItem('fast:lastRoster'); if (raw) setSaved(JSON.parse(raw)); } catch {}
  }, []);
  return saved as (null | {
    tableId: string; kind: string; buyIn: number; capacity: number; stack: number;
    team: Player[]; left: number; formation: FormationKey; ts: number;
  });
}

function LineupContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const tableId = sp.get('id') ?? 't0';
  const buyIn = Number(sp.get('buyIn') ?? 1);
  const capacity = Number(sp.get('cap') ?? 20);
  const stack = Number(sp.get('stack') ?? 1000);
  const kind = sp.get('kind') ?? 'classic';

  const saved = useSavedRoster();
  const formation: FormationKey = saved?.formation ?? '3-4-3';
  const shape = FORM_SHAPE[formation];

  // stato XI: 1P + D,C,A secondo modulo; memorizzo id giocatore per slot
  const [gk, setGk] = useState<string>('');
  const [dIds, setDIds] = useState<string[]>(Array(shape.D).fill(''));
  const [cIds, setCIds] = useState<string[]>(Array(shape.C).fill(''));
  const [aIds, setAIds] = useState<string[]>(Array(shape.A).fill(''));

  const used = useMemo(()=> new Set([gk, ...dIds, ...cIds, ...aIds].filter(Boolean)), [gk, dIds, cIds, aIds]);

  const byRole = useMemo(() => {
    const pool = saved?.team ?? [];
    return {
      P: pool.filter(p => p.role === 'P'),
      D: pool.filter(p => p.role === 'D'),
      C: pool.filter(p => p.role === 'C'),
      A: pool.filter(p => p.role === 'A'),
    } as Record<ClassicRole, Player[]>;
  }, [saved]);

  const bench = useMemo(() => {
    if (!saved?.team) return [];
    return saved.team.filter(p => !used.has(p.id));
  }, [saved, used]);

  function commitLineup() {
    const payload = {
      tableId, kind, buyIn, capacity, stack,
      formation,
      XI: {
        P: gk ? [gk] : [],
        D: dIds.filter(Boolean),
        C: cIds.filter(Boolean),
        A: aIds.filter(Boolean),
      },
      bench: bench.map(b => b.id),
      ts: Date.now(),
    };
    try { localStorage.setItem('fast:lastLineup', JSON.stringify(payload)); } catch {}
    // resta su questa pagina; il bottone "Simula partita" porta ai risultati
  }

  function goSimulate() {
    const params = new URLSearchParams({ id: tableId, buyIn: String(buyIn), cap: String(capacity), stack: String(stack), kind });
    router.push(`/fast/result?${params.toString()}`);
  }

  if (!saved?.team?.length) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-900 text-white">
        Nessuna rosa salvata. Torna al builder.
      </div>
    );
  }

  // helper option renderer
  const Opt = ({p}:{p:Player}) => <option value={p.id}>{p.name} — {p.team}</option>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Schiera formazione</h1>
            <div className="text-sm text-white/80">
              Tavolo {tableId} • Modulo {formation} • Buy-in €{buyIn} • Capienza {capacity} • Stack {stack}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>router.push('/fast/build?'+sp.toString())} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15">
              Torna alla rosa
            </button>
          </div>
        </header>

        <section className="bg-white/5 rounded-xl border border-white/10 p-4">
          {/* Campo stilizzato semplice */}
          <div className="relative w-full rounded-xl border border-white/15 overflow-hidden" style={{paddingTop:'60%', backgroundImage:'repeating-linear-gradient(90deg, rgba(16,122,57,0.9) 0, rgba(16,122,57,0.9) 6%, rgba(13,102,48,0.9) 6%, rgba(13,102,48,0.9) 12%)'}}>
            <div className="absolute inset-0">
              {/* linee */}
              <div className="absolute left-1/2 top-0 -translate-x-1/2 w-px h-full bg-white/40" />
              <div className="absolute left-[20%] top-0 w-[60%] h-[22%] border-b border-white/40" />
              <div className="absolute left-[20%] bottom-0 w-[60%] h-[22%] border-t border-white/40" />
            </div>

            {/* GK */}
            <div className="absolute left-1/2 top-[88%] -translate-x-1/2 -translate-y-1/2">
              <Slot
                label="P"
                value={gk}
                onChange={setGk}
                options={byRole.P.filter(p=>!used.has(p.id) || p.id===gk)}
              />
            </div>

            {/* linea D */}
            {Array.from({length: shape.D}).map((_,i)=>(
              <div key={`D${i}`} className="absolute" style={{left:`${(100/(shape.D+1))*(i+1)}%`, top:'70%', transform:'translate(-50%, -50%)'}}>
                <Slot
                  label="D"
                  value={dIds[i]}
                  onChange={(v)=> setDIds(prev=> prev.map((x,idx)=> idx===i? v: x))}
                  options={byRole.D.filter(p=>!used.has(p.id) || p.id===dIds[i])}
                />
              </div>
            ))}

            {/* linea C */}
            {Array.from({length: shape.C}).map((_,i)=>(
              <div key={`C${i}`} className="absolute" style={{left:`${(100/(shape.C+1))*(i+1)}%`, top:'52%', transform:'translate(-50%, -50%)'}}>
                <Slot
                  label="C"
                  value={cIds[i]}
                  onChange={(v)=> setCIds(prev=> prev.map((x,idx)=> idx===i? v: x))}
                  options={byRole.C.filter(p=>!used.has(p.id) || p.id===cIds[i])}
                />
              </div>
            ))}

            {/* linea A */}
            {Array.from({length: shape.A}).map((_,i)=>(
              <div key={`A${i}`} className="absolute" style={{left:`${(100/(shape.A+1))*(i+1)}%`, top:'36%', transform:'translate(-50%, -50%)'}}>
                <Slot
                  label="A"
                  value={aIds[i]}
                  onChange={(v)=> setAIds(prev=> prev.map((x,idx)=> idx===i? v: x))}
                  options={byRole.A.filter(p=>!used.has(p.id) || p.id===aIds[i])}
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={commitLineup} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15">Conferma formazione</button>
            <button onClick={goSimulate} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700">Simula partita</button>
          </div>
        </section>

        {/* Panchina */}
        <section className="bg-white/5 rounded-xl border border-white/10 p-4">
          <h3 className="font-semibold mb-2">Panchina</h3>
          {bench.length===0 ? (
            <div className="text-sm text-white/70">Nessun giocatore in panchina.</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {bench.map(b=>(
                <div key={b.id} className="rounded-lg bg-white/10 border border-white/10 px-3 py-2">
                  <div className="font-semibold">{b.role} • {b.name}</div>
                  <div className="text-xs text-white/70">{b.team}</div>
                  <div className="text-xs text-white/90">FVM {b.price}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Slot({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v:string)=>void;
  options: Player[];
}) {
  return (
    <div className="w-40">
      <div className="text-center text-white/90 text-xs mb-1">{label}</div>
      <select
        value={value}
        onChange={(e)=> onChange(e.target.value)}
        className="w-full px-2 py-1 rounded-md bg-white/80 text-slate-900"
      >
        <option value="">— scegli —</option>
        {options.map(p=> <option key={p.id} value={p.id}>{p.name} ({p.team})</option>)}
      </select>
    </div>
  );
}

export default function LineupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center bg-slate-900 text-white">Caricamento…</div>}>
      <LineupContent />
    </Suspense>
  );
}
