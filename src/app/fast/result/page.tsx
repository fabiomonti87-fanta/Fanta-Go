'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Row = { name: string; isYou: boolean; score: number; prize: number };

function getPayout(capacity: number, net: number): number[] {
  if (capacity <= 10) return [50,30,20].map(p => (p/100)*net);
  if (capacity <= 20) return [40,25,18,10,7].map(p => (p/100)*net);
  if (capacity <= 50) return [20,15,12,10,8,7,6,5,4,3].map(p => (p/100)*net);
  return [12,10,9,8,7,6,5,5,4,4,3,3,3,2.5,2.5,2,1.5,1.5].map(p => (p/100)*net);
}

function ResultContent() {
  const router = useRouter();
  const sp = useSearchParams();

  const tableId = sp.get('id') ?? 't0';
  const buyIn = Number(sp.get('buyIn') ?? 1);
  const capacity = Number(sp.get('cap') ?? 20);
  const stack = Number(sp.get('stack') ?? 1000);
  const kind = sp.get('kind') ?? 'classic';

  const [saved, setSaved] = useState<any>(null);
  useEffect(() => {
    try { const raw = localStorage.getItem('fast:lastRoster'); if (raw) setSaved(JSON.parse(raw)); } catch {}
  }, []);

  const { leaderboard, pot, rake, net, payoutDesc } = useMemo(() => {
    const youScore = Math.round(55 + Math.random()*30 + Math.min(10, Math.max(0, saved ? (saved.stack - saved.left)/saved.stack*10 : 0)));
    const bots: Row[] = Array.from({length: Math.max(0, capacity-1)}, (_,i)=>({
      name:`Bot ${i+1}`, isYou:false, score: Math.round(55 + Math.random()*40), prize:0
    }));
    let rows: Row[] = [{ name:'Tu', isYou:true, score: youScore, prize:0 }, ...bots].sort((a,b)=>b.score-a.score);

    const pot = buyIn * capacity;
    const rake = Math.round(pot*0.10*100)/100;
    const net = pot - rake;
    const payout = getPayout(capacity, net);
    const payoutDesc = `Payout: ${payout.map((v,i)=>`#${i+1} €${v.toFixed(2)}`).join(' • ')}`;
    rows = rows.map((r,idx)=> ({...r, prize: payout[idx] ?? 0 }));
    return { leaderboard: rows, pot, rake, net, payoutDesc };
  }, [saved, buyIn, capacity]);

  const podium = leaderboard.slice(0,3);
  const rest = leaderboard.slice(3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4">
      <div className="max-w-5xl mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Risultati</h1>
            <div className="text-sm text-white/80">
              Tavolo {tableId} • Modalità {kind} • Buy-in €{buyIn} • Capienza {capacity} • Stack {stack}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>router.push('/fast')} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15">Torna alla lobby</button>
            <button onClick={()=>router.push(`/fast/build?id=${tableId}&buyIn=${buyIn}&cap=${capacity}&stack=${stack}&kind=${kind}`)} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700">Crea un’altra squadra</button>
          </div>
        </header>

        <section className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-sm text-white/80 mb-2">
            Montepremi €{pot.toFixed(2)} • Rake 10% €{rake.toFixed(2)} • Netto €{net.toFixed(2)}
          </div>
          <div className="text-xs text-white/70 mb-4">{payoutDesc}</div>

          {/* PODIO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {/* 2nd */}
            {podium[1] && (
              <div className="rounded-xl bg-white/10 border border-white/10 p-4 text-center">
                <div className="text-3xl">🥈</div>
                <div className="mt-2 font-semibold">{podium[1].name}{podium[1].isYou && ' (Tu)'}</div>
                <div className="text-sm text-white/80">Score {podium[1].score} • Premio {podium[1].prize ? `€${podium[1].prize.toFixed(2)}` : '-'}</div>
              </div>
            )}
            {/* 1st */}
            {podium[0] && (
              <div className="rounded-xl bg-emerald-700/30 border border-emerald-400/40 p-4 text-center scale-105">
                <div className="text-4xl">🥇</div>
                <div className="mt-2 font-semibold">{podium[0].name}{podium[0].isYou && ' (Tu)'}</div>
                <div className="text-sm text-white/90">Score {podium[0].score} • Premio {podium[0].prize ? `€${podium[0].prize.toFixed(2)}` : '-'}</div>
              </div>
            )}
            {/* 3rd */}
            {podium[2] && (
              <div className="rounded-xl bg-white/10 border border-white/10 p-4 text-center">
                <div className="text-3xl">🥉</div>
                <div className="mt-2 font-semibold">{podium[2].name}{podium[2].isYou && ' (Tu)'}</div>
                <div className="text-sm text-white/80">Score {podium[2].score} • Premio {podium[2].prize ? `€${podium[2].prize.toFixed(2)}` : '-'}</div>
              </div>
            )}
          </div>

          {/* DAL 4° IN GIÙ */}
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="text-white/70">
                <th className="py-2 px-2">#</th>
                <th className="py-2 px-2">Giocatore</th>
                <th className="py-2 px-2 text-right">Punteggio</th>
                <th className="py-2 px-2 text-right">Premio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rest.map((r, idx) => (
                <tr key={idx} className={r.isYou ? 'bg-emerald-900/20' : ''}>
                  <td className="py-2 px-2">{idx + 4}</td>
                  <td className="py-2 px-2">{r.name}{r.isYou && ' (Tu)'}</td>
                  <td className="py-2 px-2 text-right">{r.score}</td>
                  <td className="py-2 px-2 text-right">{r.prize ? `€${r.prize.toFixed(2)}` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center bg-slate-900 text-white">Caricamento…</div>}>
      <ResultContent />
    </Suspense>
  );
}
