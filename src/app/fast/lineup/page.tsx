'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Player } from '@/components/fast/ClassicBuilder';
import LineupPicker from '@/components/fast/LineupPicker';

export const dynamic = 'force-dynamic';

function useSavedRoster() {
  const [saved, setSaved] = useState<any>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('fast:lastRoster');
      if (raw) setSaved(JSON.parse(raw));
    } catch {}
  }, []);
  return saved as (null | {
    tableId: string; kind: string; buyIn: number; capacity: number; stack: number;
    team: Player[]; left: number; formation: any; ts: number;
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

  if (!saved?.team?.length) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-900 text-white">
        Nessuna rosa salvata. Torna al builder.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Schiera formazione</h1>
            <div className="text-sm text-white/80">
              Tavolo {tableId} • Modulo {saved.formation} • Buy-in €{buyIn} • Capienza {capacity} • Stack {stack}
            </div>
          </div>
          <button onClick={()=>router.push('/fast/build?'+sp.toString())} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15">
            Torna alla rosa
          </button>
        </header>

        <section className="bg-white/5 rounded-xl border border-white/10 p-4">
          <LineupPicker
            team={saved.team}
            formation={saved.formation}
            onBack={()=>router.push('/fast/build?'+sp.toString())}
            onConfirm={(xi, bench)=>{
              // salva anche la lineup dettagliata
              try {
                localStorage.setItem('fast:lastLineup', JSON.stringify({
                  tableId, kind, buyIn, capacity, stack,
                  formation: saved.formation,
                  XI: {
                    P: xi.filter(p=>p.role==='P').map(p=>p.id),
                    D: xi.filter(p=>p.role==='D').map(p=>p.id),
                    C: xi.filter(p=>p.role==='C').map(p=>p.id),
                    A: xi.filter(p=>p.role==='A').map(p=>p.id),
                  },
                  bench: bench.map(p=>p.id),
                  ts: Date.now(),
                }));
              } catch {}
              const params = new URLSearchParams({ id: tableId, buyIn: String(buyIn), cap: String(capacity), stack: String(stack), kind });
              router.push(`/fast/result?${params.toString()}`);
            }}
          />
        </section>
      </div>
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
