'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ClassicBuilder, { Player } from '@/components/fast/ClassicBuilder';

export const dynamic = 'force-dynamic';

function BuildContent() {
  const router = useRouter();
  const sp = useSearchParams();

  const tableId = sp.get('id') ?? 't0';
  const stack = Number(sp.get('stack') ?? 1000);
  const buyIn = Number(sp.get('buyIn') ?? 1);
  const capacity = Number(sp.get('cap') ?? 20);
  const kind = sp.get('kind') ?? 'classic';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Costruisci squadra</h1>
            <div className="text-sm text-white/80">
              Tavolo {tableId} • Modalità {kind} • Buy-in €{buyIn} • Capienza {capacity} • Stack {stack}
            </div>
          </div>
          <button onClick={() => router.push('/fast')} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15">
            Torna alla lobby
          </button>
        </header>

        <section className="bg-white/5 rounded-xl border border-white/10 p-4">
          <ClassicBuilder
            budget={stack}
            onConfirm={(team: Player[], left: number, formation: any) => {
              const payload = { tableId, kind, buyIn, capacity, stack, team, left, formation, ts: Date.now() };
              try { localStorage.setItem('fast:lastRoster', JSON.stringify(payload)); } catch {}
              const params = new URLSearchParams({ id: tableId, buyIn: String(buyIn), cap: String(capacity), stack: String(stack), kind });
              // vai alla pagina SCHIERA XI
              location.href = `/fast/lineup?${params.toString()}`;
            }}
          />
        </section>
      </div>
    </div>
  );
}

export default function BuildPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center bg-slate-900 text-white">Caricamento…</div>}>
      <BuildContent />
    </Suspense>
  );
}
