'use client';

import React, { useMemo, useState, useEffect } from 'react';
import type { Player, ClassicRole } from './ClassicBuilder';

type FormationKey = '3-4-3' | '4-3-3' | '3-5-2' | '4-4-2' | '4-5-1' | '5-3-2' | '5-4-1';

const parseFormation = (f: FormationKey) => {
  const [d, c, a] = f.split('-').map(n => parseInt(n, 10));
  return { d, c, a };
};

const NUMBER_LAYOUTS: Record<FormationKey, { def: number[]; mid: number[]; att: number[] }> = {
  '4-3-3': { def: [2,4,5,3], mid: [6,8,10], att: [7,9,11] },
  '3-4-3': { def: [3,4,2],   mid: [6,8,10,5], att: [7,9,11] },
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
  onConfirm,
}: {
  team: Player[];
  formation: FormationKey;
  onBack: () => void;
  onConfirm: (xi: Player[], bench: Player[]) => void;
}) {
  const { d, c, a } = parseFormation(formation);
  const nums = NUMBER_LAYOUTS[formation];

  // XI state
  const [gk, setGk] = useState<Player | null>(null);
  const [def, setDef] = useState<(Player | null)[]>(Array(d).fill(null));
  const [mid, setMid] = useState<(Player | null)[]>(Array(c).fill(null));
  const [att, setAtt] = useState<(Player | null)[]>(Array(a).fill(null));

  // ids scelti
  const chosenIds = useMemo(() => {
    const ids: string[] = [];
    if (gk) ids.push(gk.id);
    def.forEach(p => p && ids.push(p.id));
    mid.forEach(p => p && ids.push(p.id));
    att.forEach(p => p && ids.push(p.id));
    return new Set(ids);
  }, [gk, def, mid, att]);

  // panchina e ordinamento
  const bench = useMemo(() => team.filter(p => !chosenIds.has(p.id)), [team, chosenIds]);
  const [benchOrder, setBenchOrder] = useState<number[]>([]);
  useEffect(() => { setBenchOrder(bench.map((_, i) => i)); }, [bench.length]);
  const benchOrdered = useMemo(() => benchOrder.map(i => bench[i]).filter(Boolean), [bench, benchOrder]);

  // util
  const reorder = <T,>(arr: T[], from: number, to: number) => {
    const a = arr.slice(); const [m] = a.splice(from, 1); a.splice(to, 0, m); return a;
  };
  const avail = (role: ClassicRole) => bench.filter(p => p.role === role).sort((a,b)=>b.price-a.price);

  // selezione rapida via prompt
  function pickFor(role: ClassicRole, set: (arr: (Player | null)[]) => void, arr: (Player | null)[], idx: number) {
    const pool = avail(role);
    if (!pool.length) return;
    const choice = window.prompt(
      `Scegli ${role}:\n` +
      pool.slice(0, 12).map((x, i) => `${i + 1}. ${x.name} (${x.team}) – ${x.price}`).join('\n') +
      `\n\nDigita il numero (1-${Math.min(12, pool.length)})`
    );
    const k = Number(choice) - 1;
    if (!Number.isFinite(k) || k < 0 || k >= pool.length) return;
    const next = arr.slice(); next[idx] = pool[k]; set(next);
  }

  const canConfirm = !!(gk && def.every(Boolean) && mid.every(Boolean) && att.every(Boolean));
  const startingXI: Player[] = [
    ...(gk ? [gk] : []),
    ...(def.filter(Boolean) as Player[]),
    ...(mid.filter(Boolean) as Player[]),
    ...(att.filter(Boolean) as Player[]),
  ];

  // Shirt “compatta” + draggable
  const Shirt = ({
    number, player, onClick, draggable, onDragStart, onDragOver, onDrop
  }: {
    number: number;
    player?: Player | null;
    onClick?: () => void;
    draggable?: boolean;
    onDragStart?: () => void;
    onDragOver?: (e: React.DragEvent)=>void;
    onDrop?: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`relative flex flex-col items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full bg-white/90 text-slate-900 shadow
                  hover:scale-105 transition ${player ? 'ring-2 ring-emerald-500 cursor-move' : 'cursor-pointer'}`}
      title={player ? `${player.role} • ${player.name} (${player.team})` : 'Seleziona giocatore'}
    >
      <div className="text-base md:text-lg font-extrabold">{number}</div>
      {player && (
        <div className="absolute -bottom-5 md:-bottom-6 text-[10px] md:text-xs font-semibold text-white/90 truncate w-[96px] md:w-[120px] text-center">
          {player.name}
        </div>
      )}
    </button>
  );

  // Riga slot con drag&drop intra-linea
  function SlotRow({
    role, slots, numbers, setter,
  }: {
    role: ClassicRole;
    slots: (Player | null)[];
    numbers: number[];
    setter: (arr: (Player | null)[]) => void;
  }) {
    const [dragFrom, setDragFrom] = useState<number | null>(null);
    return (
      <div className="flex items-center justify-center gap-6">
        {slots.map((p, i) => (
          <div key={i} className="flex flex-col items-center">
            <Shirt
              number={numbers[i]}
              player={p || undefined}
              onClick={() => pickFor(role, setter, slots, i)}
              draggable={!!p}
              onDragStart={() => setDragFrom(i)}
              onDragOver={(e)=>e.preventDefault()}
              onDrop={()=>{
                if (dragFrom===null || dragFrom===i) return;
                setter(reorder(slots, dragFrom, i));
                setDragFrom(null);
              }}
            />
            {p && (
              <button
                className="mt-8 text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/15"
                onClick={() => { const next = slots.slice(); next[i] = null; setter(next); }}
              >
                Rimuovi
              </button>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Drag&drop panchina
  const [benchDragFrom, setBenchDragFrom] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Schiera formazione • Modulo {formation}</div>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15">⬅ Torna alla rosa</button>
          <button
            disabled={!canConfirm}
            onClick={() => onConfirm(startingXI, benchOrdered)}
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
            onClick={() => pickFor('P', (arr)=>setGk(arr[0]), [gk], 0)}
          />
          {gk && (
            <button className="ml-4 text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/15" onClick={()=>setGk(null)}>
              Rimuovi
            </button>
          )}
        </div>
      </div>

      {/* panchina */}
      <div className="rounded-xl bg-white/5 border border-white/10">
        <div className="px-4 py-3 border-b border-white/10 font-semibold">Panchina (trascina per riordinare)</div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          {benchOrdered.map((b, i) => (
            <div
              key={b.id}
              draggable
              onDragStart={(e) => {
  setBenchDragFrom(i);
  // DnD: serve sapere quale elemento della panchina (nell'ordine visualizzato) stiamo trascinando
  e.dataTransfer.setData('text/bench-ordered-index', String(i));
  e.dataTransfer.effectAllowed = 'move';
}}

              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (benchDragFrom === null || benchDragFrom === i) return;
                // traduci indici “visibili” → indici originali
                const fromOrig = benchOrder[benchDragFrom];
                const toOrig = benchOrder[i];
                const newOrder = benchOrder.slice();
                const curPos = newOrder.indexOf(fromOrig);
                const newPos = newOrder.indexOf(toOrig);
                const next = reorder(newOrder, curPos, newPos);
                setBenchOrder(next);
                setBenchDragFrom(null);
              }}
              className="rounded-lg bg-white/10 border border-white/10 px-3 py-2 cursor-move"
              title="Trascina per riordinare"
            >
              <div className="font-semibold">{b.role} • {b.name}</div>
              <div className="text-xs text-white/70">{b.team}</div>
              <div className="text-xs text-white/90">FVM {b.price}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
