'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Eye, EyeOff, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

type TableStatus = 'filling' | 'running' | 'completed';
type GameKind = 'classic' | 'top100';
type Table = {
  id: string;
  kind: GameKind;
  buyIn: number;                       // € 1..50
  capacity: 10 | 20 | 50 | 100;        // numero partecipanti
  enrolled: number;                    // iscritti
  status: TableStatus;
  stack: number;                       // 200 | 1000
  title?: string;
};

export default function Page() {
  const router = useRouter();

  // Demo seed tavoli
  const [tables, setTables] = useState<Table[]>([
    { id: 't1', kind: 'classic', buyIn: 1,  capacity: 20, enrolled: 12, status: 'filling',  stack: 1000, title: 'Serale easy' },
    { id: 't2', kind: 'classic', buyIn: 2,  capacity: 10, enrolled: 10, status: 'running',  stack: 200,  title: 'Speed 10'   },
    { id: 't3', kind: 'classic', buyIn: 5,  capacity: 20, enrolled: 20, status: 'completed',stack: 1000, title: 'Domenica Pro' },
    { id: 't4', kind: 'top100',  buyIn: 10, capacity: 50, enrolled: 37, status: 'filling',  stack: 200,  title: 'Top100 – Medium' },
  ]);

  // Filtri
  const [q, setQ] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [kind, setKind] = useState<'all' | GameKind>('all');
  const [stack, setStack] = useState<'all' | 200 | 1000>('all');

  const [buyInMin, setBuyInMin] = useState(1);
  const [buyInMax, setBuyInMax] = useState(50);
  const [capMin, setCapMin] = useState<10 | 20 | 50 | 100>(10);
  const [capMax, setCapMax] = useState<10 | 20 | 50 | 100>(100);

  // "Crea tavolo" a comparsa
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    return tables
      .filter(t => (showCompleted ? true : t.status !== 'completed'))
      .filter(t => (kind === 'all' ? true : t.kind === kind))
      .filter(t => (stack === 'all' ? true : t.stack === stack))
      .filter(t => t.buyIn >= buyInMin && t.buyIn <= buyInMax)
      .filter(t => t.capacity >= capMin && t.capacity <= capMax)
      .filter(t => {
        const s = q.trim().toLowerCase();
        if (!s) return true;
        return (
          t.title?.toLowerCase().includes(s) ||
          t.id.toLowerCase().includes(s) ||
          t.kind.toLowerCase().includes(s)
        );
      })
      .sort((a,b) => Number(a.status === 'filling') - Number(b.status === 'filling')) // filling prima
      .reverse();
  }, [tables, showCompleted, kind, stack, buyInMin, buyInMax, capMin, capMax, q]);

  function handleCreate(data: Omit<Table, 'id' | 'enrolled' | 'status'>) {
    const id = `t${Math.random().toString(36).slice(2, 8)}`;
    setTables(prev => [{ id, ...data, enrolled: 0, status: 'filling' }, ...prev]);
    setShowCreate(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Fast Fanta &amp; Go</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCompleted(v => !v)}
              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15"
              title={showCompleted ? 'Nascondi tavoli completati' : 'Mostra anche completati'}
            >
              {showCompleted ? <EyeOff className="inline h-4 w-4 mr-1" /> : <Eye className="inline h-4 w-4 mr-1" />}
              {showCompleted ? 'Nascondi completati' : 'Mostra completati'}
            </button>
            <button
              onClick={() => setShowCreate(v => !v)}
              className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="inline h-4 w-4 mr-1" />
              Crea tavolo
            </button>
          </div>
        </header>

{/* Filtri */}
<section className="bg-white/5 rounded-xl border border-white/10 p-4">
  {/* RIGA 1: cerca, modalità, stack */}
  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
    <div className="md:col-span-2">
      <label className="text-xs text-white/70">Cerca</label>
      <div className="relative">
        <svg className="absolute left-3 top-2.5 h-4 w-4 text-white/60" viewBox="0 0 24 24" fill="none"><path d="M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="2" /></svg>
        <input
          value={q}
          onChange={e=>setQ(e.target.value)}
          placeholder="Cerca titolo, id, modalità…"
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/10 text-white placeholder-white/60 border border-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
    </div>
    <div>
      <label className="text-xs text-white/70">Modalità</label>
      <select value={kind} onChange={e=>setKind(e.target.value as any)} className="w-full px-2 py-2 rounded-lg bg-white/10 text-white border border-white/20">
        <option value="all">Tutte</option>
        <option value="classic">Classic</option>
        <option value="top100">Top 100</option>
      </select>
    </div>
    <div>
      <label className="text-xs text-white/70">Stack (crediti)</label>
      <select value={stack} onChange={e=>setStack(e.target.value==='all'?'all': Number(e.target.value) as any)} className="w-full px-2 py-2 rounded-lg bg-white/10 text-white border border-white/20">
        <option value="all">Tutti</option>
        <option value={200}>200</option>
        <option value={1000}>1000</option>
      </select>
    </div>
  </div>

  {/* RIGA 2: buy-in + capienza */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end mt-3">
    <div>
      <label className="text-xs text-white/70">Buy-in (€) • {buyInMin}–{buyInMax}</label>
      <div className="flex items-center gap-2">
        <input type="range" min={1} max={50} step={1} value={buyInMin} onChange={e=>setBuyInMin(Math.min(Number(e.target.value), buyInMax))} className="w-full" />
        <input type="range" min={1} max={50} step={1} value={buyInMax} onChange={e=>setBuyInMax(Math.max(Number(e.target.value), buyInMin))} className="w-full" />
      </div>
    </div>
    <div>
      <label className="text-xs text-white/70">Capienza • {capMin}–{capMax}</label>
      <div className="flex items-center gap-2">
        <input type="range" min={10} max={100} step={10} value={capMin} onChange={e=>setCapMin(Math.min(Number(e.target.value) as any, capMax))} className="w-full" />
        <input type="range" min={10} max={100} step={10} value={capMax} onChange={e=>setCapMax(Math.max(Number(e.target.value) as any, capMin))} className="w-full" />
      </div>
    </div>
  </div>
</section>

        {/* Pannello creazione tavolo (a comparsa) */}
        {showCreate && (
          <CreateTablePanel
            onCancel={() => setShowCreate(false)}
            onCreate={(t) => handleCreate(t)}
          />
        )}

        {/* Lista tavoli */}
        <section className="bg-white/5 rounded-xl border border-white/10">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-semibold">Tavoli disponibili</h2>
          </div>
          <div className="divide-y divide-white/10">
            {filtered.map(t => (
              <LobbyRow
                key={t.id}
                t={t}
                onJoin={() => {
                  // vai alla pagina builder dedicata
                  const params = new URLSearchParams({
                    id: t.id, stack: String(t.stack), cap: String(t.capacity), buyIn: String(t.buyIn), kind: t.kind
                  });
                  router.push(`/fast/build?${params.toString()}`);
                }}
              />
            ))}
            {filtered.length === 0 && (
              <div className="p-4 text-sm text-white/70">Nessun tavolo da mostrare con i filtri correnti.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function LobbyRow({ t, onJoin }: { t: Table; onJoin: () => void }) {
  const pct = Math.round((t.enrolled / t.capacity) * 100);
  return (
    <div className="p-4 flex items-center justify-between">
      <div>
        <div className="font-semibold">
          {t.title || (t.kind === 'classic' ? 'Classic' : 'Top 100')}
        </div>
        <div className="text-xs text-white/70 space-x-2">
          <span>ID {t.id}</span>
          <span>• Modalità {t.kind}</span>
          <span>• Stack {t.stack}</span>
          <span>• Buy-in €{t.buyIn}</span>
          <span>• {t.enrolled}/{t.capacity}</span>
          <span>• Stato: {t.status}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-40 bg-white/10 h-2 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        <button onClick={onJoin} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700">
          Entra
        </button>
      </div>
    </div>
  );
}

function CreateTablePanel({
  onCreate,
  onCancel,
}: {
  onCreate: (t: Omit<Table, 'id' | 'enrolled' | 'status'>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<GameKind>('classic');
  const [buyIn, setBuyIn] = useState(1);
  const [capacity, setCapacity] = useState<10 | 20 | 50 | 100>(20);
  const [stack, setStack] = useState(1000);

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Nuovo tavolo</h3>
        <button onClick={onCancel} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15">
          Annulla
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <label className="text-sm">
          Titolo
          <input
            value={title}
            onChange={e=>setTitle(e.target.value)}
            placeholder="Es. Serale Easy"
            className="mt-1 w-full bg-white/10 border border-white/20 rounded px-2 py-2"
          />
        </label>

        <label className="text-sm">
          Modalità
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as GameKind)}
            className="mt-1 w-full bg-white/10 border border-white/20 rounded px-2 py-2"
          >
            <option value="classic">Classic</option>
            <option value="top100">Top 100</option>
          </select>
        </label>

        <label className="text-sm">
          Buy-in (€)
          <select
            value={buyIn}
            onChange={(e) => setBuyIn(Number(e.target.value))}
            className="mt-1 w-full bg-white/10 border border-white/20 rounded px-2 py-2"
          >
            {[1,2,5,10,20,50].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>

        <label className="text-sm">
          Capienza
          <select
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value) as any)}
            className="mt-1 w-full bg-white/10 border border-white/20 rounded px-2 py-2"
          >
            {[10,20,50,100].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>

        <label className="text-sm">
          Stack (crediti)
          <select
            value={stack}
            onChange={(e) => setStack(Number(e.target.value))}
            className="mt-1 w-full bg-white/10 border border-white/20 rounded px-2 py-2"
          >
            {[200,1000].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-3">
        <button
          onClick={() => onCreate({ kind, buyIn, capacity, stack, title })}
          className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700"
        >
          Crea
        </button>
      </div>
    </div>
  );
}
