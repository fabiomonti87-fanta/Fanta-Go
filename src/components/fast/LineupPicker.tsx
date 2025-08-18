'use client';

import React, { useMemo, useState } from 'react';
import type { Player, ClassicRole } from './ClassicBuilder';

type FormationKey =
  | '3-4-3' | '4-3-3' | '3-5-2' | '4-4-2' | '4-5-1' | '5-3-2' | '5-4-1';

const parseFormation = (f: FormationKey) => {
  const [d, c, a] = f.split('-').map(n => parseInt(n, 10));
  return { d, c, a };
};

// numeri classici per ogni linea, per modulo
const NUMBER_LAYOUTS: Record<FormationKey, { def: number[]; mid: number[]; att: number[] }> = {
  '4-3-3': { def: [2,4,5,3], mid: [6,8,10], att: [7,9,11] },
  '3-4-3': { def: [3,4,2],   mid: [6,8,10,5], att: [7,9,11] }, // 5 come mediano "alla 3 dietro"
  '3-5-2': { def: [2,4,5],   mid: [7,6,10,8,3], att: [9,11] },
  '4-4-2': { def: [2,4,5,3], mid: [7,6,8,11],    att: [9,10] },
  '4-5-1': { def: [2,4,5,3], mid: [7,6,8,10,11], att: [9] },
  '5-3-2': { def: [2,4,5,6,3], mid: [8,10,7],    att: [9,11] },
  '5-4-1': { def: [2,4,5,6,3], mid: [7,8,10,11], att: [9] },
};

export default function LineupPicker({
  team,
  formation,
  onBack,
  onConfirm, // chiamata quando clicchi "Simula partita"
}: {
  team: Player[];
  formation: FormationKey;
  onBack: () => void;
  onConfirm: (xi: Player[], bench: Player[]) => void;
}) {
  const { d, c, a } = parseFormation(formation);
  const nums = NUMBER_LAYOUTS[formation];

  // stato: XI & bench
  const [gk, setGk] = useState<Player | null>(null);
  const [def, setDef] = useState<(Player | null)[]>(Array(d).fill(null));
  const [mid, setMid] = useState<(Player | null)[]>(Array(c).fill(null));
  const [att, setAtt] = useState<(Player | null)[]>(Array(a).fill(null));

  const chosenIds = useMemo(() => new Set([
    ...(gk ? [gk.id] : []),
    ...def.filter(Boolean).map(p => (p as Player).id),
    ...mid.filter(Boolean).map(p => (p as Player).id),
    ...att.filter(Boolean).map(p => (p as Player).id),
  ]), [gk, def, mid, att]);

  const bench = useMemo(() => team.filter(p => !chosenIds.has(p.id)), [team, chosenIds]);

  const [benchOrder, setBenchOrder] = useState<number[]>(() => bench.map((_, i) => i));

  // riallinea benchOrder quando cambia bench
  React.useEffect(() => {
    setBenchOrder(bench.map((_, i) => i));
  }, [bench.length]);

  const moveBench = (idx: number, dir: -1 | 1) => {
    setBenchOrder(prev => {
      const arr = prev.slice();
      const pos = arr.indexOf(idx);
      const to = pos + dir;
      if (to < 0 || to >= arr.length) return arr;
      [arr[pos], arr[to]] = [arr[to], arr[pos]];
      return arr;
    });
  };

  // filtro helper per slot
  const avail = (role: ClassicRole) =>
    bench.filter(p => p.role === role).sort((a,b)=>b.price - a.price);

  const canConfirm =
    gk && def.every(Boolean) && mid.every(Boolean) && att.every(Boolean);

  const startingXI = [
    ...(gk ? [gk] : []),
    ...(def.filter(Boolean) as Player[]),
    ...(mid.filter(Boolean) as Player[]),
    ...(att.filter(Boolean) as Player[]),
  ];

  // UI helpers
  const Shirt = ({ number, player, onClick }: { number: number; player?: Player | null; onClick?: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center w-16 h-16 rounded-full bg-white/90 text-slate-900 shadow
                  hover:scale-105 transition ${player ? 'ring-2 ring-emerald-500' : ''}`}
      title={player ? `${player.role} • ${player.name} (${player.team})` : 'Seleziona giocatore'}
    >
      <div className="text-lg font-extrabold">{number}</div>
      {player && <div className="absolute -bottom-6 text-xs font-semibold text-white/90 truncate w-[120px] text-center">{player.name}</div>}
    </button>
  );

  const SlotRow = ({
    role, slots, numbers, setter,
  }: {
    role: ClassicRole;
    slots: (Player | null)[];
    numbers: number[];
    setter: (arr: (Player | null)[]) => void;
  }) => (
    <div className="flex items-center justify-center gap-6">
      {slots.map((p, i) => (
        <div key={i} className="flex flex-col items-center">
          <Shirt
            number={numbers[i]}
            player={p ?? undefined}
            onClick={() => {
              // apri mini menu: scegli dal bench di quel ruolo
              const pool = avail(role);
              if (!pool.length) return;
              // pick semplice: prima scelta disponibile in ordine di prezzo
              const choice = window.prompt(
                `Scegli ${role} per lo slot #${numbers[i]}:\n` +
                pool.slice(0, 12).map((x, idx) => `${idx+1}. ${x.name} (${x.team}) – ${x.price}`).join('\n') +
                `\n\nDigita il numero (1-${Math.min(12, pool.length)}) oppure annulla`
              );
              const k = Number(choice) - 1;
              if (!Number.isFinite(k) || k < 0 || k >= pool.length) return;
              const pick = pool[k];

              const next = slots.slice();
              next[i] = pick;
              setter(next);
            }}
          />
          {p && (
            <button
              className="mt-8 text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/15"
              onClick={() => {
                const next = slots.slice(); next[i] = null; setter(next);
              }}
            >
              Rimuovi
            </button>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Schiera formazione • Modulo {formation}</div>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15">⬅ Torna alla rosa</button>
          <button
            disabled={!canConfirm}
            onClick={() => onConfirm(startingXI, benchOrder.map(i => bench[i]))}
            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40"
          >
            Simula partita
          </button>
        </div>
      </div>

      {/* campo */}
      <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-sky-900/40 to-emerald-900/40 p-6">
        {/* attacco */}
        <div className="mb-10">
          <SlotRow role="A" slots={att} numbers={nums.att} setter={setAtt}/>
        </div>
        {/* centrocampo */}
        <div className="mb-10">
          <SlotRow role="C" slots={mid} numbers={nums.mid} setter={setMid}/>
        </div>
        {/* difesa */}
        <div className="mb-10">
          <SlotRow role="D" slots={def} numbers={nums.def} setter={setDef}/>
        </div>
        {/* portiere */}
        <div className="flex items-center justify-center">
          <Shirt
            number={1}
            player={gk ?? undefined}
            onClick={() => {
              const pool = avail('P');
              if (!pool.length) return;
              const choice = window.prompt(
                `Scegli Portiere:\n` +
                pool.slice(0, 12).map((x, idx) => `${idx+1}. ${x.name} (${x.team}) – ${x.price}`).join('\n') +
                `\n\nDigita il numero (1-${Math.min(12, pool.length)}) oppure annulla`
              );
              const k = Number(choice) - 1;
              if (!Number.isFinite(k) || k < 0 || k >= pool.length) return;
              setGk(pool[k]);
            }}
          />
          {gk && (
            <button className="ml-4 text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/15" onClick={()=>setGk(null)}>
              Rimuovi
            </button>
          )}
        </div>
      </div>

      {/* panchina ordinabile */}
      <div className="rounded-xl bg-white/5 border border-white/10">
        <div className="px-4 py-3 border-b border-white/10 font-semibold">Panchina (trascinamento semplice ↑ ↓)</div>
        <div className="divide-y divide-white/10">
          {benchOrder.map((i, row) => {
            const p = bench[i];
            return (
              <div key={p.id} className="px-4 py-2 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.role} • {p.name} <span className="text-white/60">({p.team})</span></div>
                  <div className="text-xs text-white/70">FVM {p.price}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-2 py-1 rounded bg-white/10 hover:bg-white/15" onClick={()=>moveBench(i,-1)} disabled={row===0}>↑</button>
                  <button className="px-2 py-1 rounded bg-white/10 hover:bg-white/15" onClick={()=>moveBench(i, 1)} disabled={row===benchOrder.length-1}>↓</button>
                </div>
              </div>
            );
          })}
          {bench.length === 0 && <div className="px-4 py-3 text-sm text-white/70">Nessun giocatore in panchina.</div>}
        </div>
      </div>
    </div>
  );
}
