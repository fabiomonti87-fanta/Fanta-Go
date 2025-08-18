// src/lib/fast/game.ts
export type Mode = 'classic' | 'top100';
export type TableStatus = 'waiting' | 'running' | 'finished';
export type ClassicRole = 'P' | 'D' | 'C' | 'A';

export interface Player {
  id: string;
  name: string;
  team: string;
  role: ClassicRole;
  price: number;
}

export interface Seat {
  name: string;
  isBot: boolean;
  team?: Player[];
  budgetLeft?: number;
  score?: number;
  prize?: number;
}

export interface Table {
  id: string;
  mode: Mode;
  title?: string;
  buyIn: number;
  rake: number;            // 0.10
  capacity: number;        // 2/4/6/10/20/50
  budgetStack?: number;    // 200 o 1000 (solo classic)
  status: TableStatus;
  createdAt: number;
  seats: Seat[];
  winners?: Seat[];
  pot?: number;
  rakeTotal?: number;
}

export const BUY_INS = [1, 2, 5, 10, 20, 50] as const;
export const CAPACITY_STEPS = [2, 4, 6, 10, 20, 50, 100] as const;
export const DEMO_RAKE = 0.10;

export function payoutPerc(capacity: number): number[] {
  // percentuali sul NET pot (dopo rake) — demo
  const map: Record<number, number[]> = {
    2: [100],
    4: [60, 40],
    6: [50, 30, 20],
    10: [50, 30, 10],     // top100 demo
    20: [40, 25, 15, 6, 4],
    50: [20,15,12,10,8,7,6,5,4,3],
    100: [16,13,10,8,7,6,6,5,4,4,3.5,3,2.5,2,1.5,1,1,1],
  };
  return map[capacity] ?? [];
}

export function euros(n: number): number {
  return Math.round(n * 100) / 100;
}
export function newId(prefix = 'tbl'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}
export function makeBotName(i: number): string {
  const pool = ['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot','Lima','Kilo','Sierra','Tango','Zeta','Omega'];
  const nick = pool[i % pool.length];
  return `Bot ${nick}${i >= pool.length ? `-${Math.floor(i/pool.length)+1}` : ''}`;
}

// ---- simulazioni punteggio (demo) ----
function randNormal(mu: number, sigma: number): number {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mu + z * sigma;
}
export function simulateClassicScores(seats: Seat[]): Seat[] {
  return seats.map(s => ({ ...s, score: Math.max(10, Math.round(randNormal(70, 15))) }));
}
export function simulateTop100Scores(seats: Seat[]): Seat[] {
  return seats.map(s => ({ ...s, score: Math.max(5, Math.round(randNormal(65, 22))) }));
}

export function computePayouts(table: Table): Table {
  const capacity = table.capacity;
  const perc = payoutPerc(capacity);
  const gross = table.buyIn * table.seats.length;
  const rakeTotal = euros(gross * table.rake);
  const pot = euros(gross - rakeTotal);

  const sorted = [...table.seats].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const winnersCount = Math.min(perc.length, sorted.length);
  for (let i = 0; i < winnersCount; i++) {
    sorted[i].prize = euros((perc[i] / 100) * pot);
  }
  return { ...table, winners: sorted.slice(0, winnersCount), pot, rakeTotal };
}
