'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ClassicBuilder from '@/components/fast/ClassicBuilder';
import {
  Table, simulateClassicScores, simulateTop100Scores, computePayouts,
} from '@/lib/fast/game';
import { Users, TimerReset, Crown, Home, ArrowLeft, Loader2, Gamepad2, Wallet } from 'lucide-react';

const KEY = 'fast.demo.lobby.tables';

function loadAll(): Table[] { if (typeof window==='undefined') return []; try { return JSON.parse(localStorage.getItem(KEY)||'[]') as Table[]; } catch { return []; } }
function saveAll(tables: Table[]) { if (typeof window==='undefined') return; localStorage.setItem(KEY, JSON.stringify(tables)); }

export default function FastTablePage() {
  const { tableId } = useParams<{ tableId: string }>();
  const [tables, setTables] = useState<Table[]>([]);
  const [you, setYou] = useState<string>('');
  const [loadingSim, setLoadingSim] = useState(false);

  useEffect(() => {
    setTables(loadAll());
    const nick = localStorage.getItem('fast.demo.you') || `Player_${Math.random().toString(36).slice(2,6)}`;
    setYou(nick);
  }, []);

  const table = useMemo(() => tables.find(t => t.id === tableId), [tables, tableId]);
  const meIdx = useMemo(() => table?.seats.findIndex(s => s.name === you) ?? -1, [table, you]);
  const me = meIdx >= 0 && table ? table.seats[meIdx] : undefined;

  function updateTable(next: Table) {
    const all = tables.map(t => t.id === next.id ? next : t);
    setTables(all); saveAll(all);
  }

  function onConfirmTeam(team: any[], budgetLeft: number) {
    if (!table || meIdx < 0) return;
    const updated: Table = { ...table, seats: table.seats.map((s,i)=> i===meIdx ? ({...s, team, budgetLeft}) : s) };
    updateTable(updated);
  }

  function simulateNow() {
    if (!table || table.status === 'finished') return;
    setLoadingSim(true);
    setTimeout(() => {
      const withScores = table.mode === 'classic'
        ? { ...table, seats: simulateClassicScores(table.seats) }
        : { ...table, seats: simulateTop100Scores(table.seats) };
      const finalized = { ...computePayouts(withScores), status: 'finished' as const };
      updateTable(finalized);
      setLoadingSim(false);
    }, 1000);
  }

  if (!table) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-2">Tavolo non trovato.</p>
          <Link href="/fast" className="px-3 py-2 rounded-lg bg-gray-900 text-white">Torna alla Lobby</Link>
        </div>
      </div>
    );
  }

  const needsTeam = table.mode === 'classic' && (!me || !me.team || me.team.length !== 25);

  return (
    <div className="min-h-screen p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900 via-slate-900 to-black">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-black/40 backdrop-blur border border-emerald-500/40 rounded-2xl p-4 mb-4 shadow-[0_0_40px_rgba(16,185,129,0.15)] text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gamepad2 className="text-emerald-300" />
              <div>
                <div className="font-bold">Fast Fanta &amp; Go • {table.mode === 'classic' ? 'Classic' : 'Top 100'} • €{table.buyIn}</div>
                <div className="text-xs text-white/60">{table.id}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/fast" className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20">
                <ArrowLeft size={16}/> Lobby
              </Link>
              <Link href="/" className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                <Home size={16}/> App
              </Link>
            </div>
          </div>
          {table.mode === 'classic' && (
            <div className="mt-2 text-sm flex items-center gap-2">
              <Wallet size={16} className="text-emerald-300"/> Budget stack: <span className="font-semibold">{table.budgetStack ?? 1000}</span>
              <span className="ml-4">Capienza: <strong>{table.capacity}</strong></span>
            </div>
          )}
        </div>

        {/* Step builder per Classic */}
        {needsTeam ? (
          <ClassicBuilder budget={table.budgetStack ?? 1000} onConfirm={onConfirmTeam}/>
        ) : (
          <>
            {/* Stato tavolo */}
            <div className="bg-black/40 backdrop-blur border border-emerald-500/40 rounded-2xl p-4 mb-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">Stato: <span className={table.status === 'finished' ? 'text-emerald-300' : 'text-amber-300'}>{table.status.toUpperCase()}</span></div>
                  <div className="text-sm text-white/70">Posti: {table.seats.length}/{table.capacity} • Rake: {Math.round(table.rake*100)}%</div>
                </div>
                {table.status !== 'finished' ? (
                  <button
                    onClick={simulateNow}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    disabled={loadingSim}
                  >
                    {loadingSim ? <Loader2 className="animate-spin" size={16}/> : <TimerReset size={16}/>}
                    Simula esito
                  </button>
                ) : (
                  <div className="text-sm text-emerald-300 font-semibold">Partita conclusa</div>
                )}
              </div>
            </div>

            {/* Partecipanti */}
            <div className="bg-black/40 backdrop-blur border border-emerald-500/40 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 text-white flex items-center gap-2">
                <Users size={16}/> Partecipanti
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
                {table.seats.map((s, i) => (
                  <div key={i} className="border border-white/10 rounded-lg p-3 text-white bg-white/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{s.name}{s.name === you ? ' (tu)' : ''}</div>
                        <div className="text-xs text-white/60">{s.isBot ? 'Bot' : (s.team?.length ? 'Ha confermato la rosa' : 'Umano')}</div>
                      </div>
                      {table.status === 'finished' && (
                        <div className="text-right">
                          <div className="text-sm text-white/80">Score: <span className="font-semibold text-white">{s.score ?? '-'}</span></div>
                          {typeof s.prize === 'number' && s.prize > 0 && (
                            <div className="text-sm text-emerald-300 font-semibold">€ {(s.prize ?? 0).toFixed(2)}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Winners */}
              {table.status === 'finished' && table.winners && (
                <div className="border-t border-white/10 p-4">
                  <div className="font-semibold text-white mb-2">Classifica & Payout</div>
                  <div className="space-y-2">
                    {table.winners.map((w, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-emerald-900/30 border border-emerald-500/30 rounded-lg px-3 py-2 text-white">
                        <div className="flex items-center gap-2">
                          <Crown className="text-emerald-300" size={18}/>
                          <span className="font-semibold">#{idx+1}</span>
                          <span>{w.name}</span>
                        </div>
                        <div className="text-sm">
                          <span className="mr-4 text-white/80">Score: <strong className="text-white">{w.score}</strong></span>
                          <span className="text-emerald-300 font-semibold">€ {(w.prize ?? 0).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-sm text-white/70">
                    Pot netto: <strong className="text-white">€ {table.pot?.toFixed(2)}</strong> • Rake totale: <strong className="text-white">€ {table.rakeTotal?.toFixed(2)}</strong>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
