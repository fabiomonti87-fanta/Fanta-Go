// src/app/hooks/useBestLineup.ts
export type Role = 'P'|'DC'|'DD'|'DS'|'B'|'E'|'M'|'C'|'W'|'T'|'A'|'PC';
export type FormationKey =
  | '3-4-3' | '3-4-1-2' | '3-4-2-1'
  | '3-5-2' | '3-5-1-1'
  | '4-3-3' | '4-3-1-2' | '4-4-2'
  | '4-1-4-1' | '4-4-1-1' | '4-2-3-1';

export interface Player {
  id?: number | string;
  giocatore: string;
  squadraFantacalcio: string;
  squadraSerieA?: string;
  ruolo?: string;
  tipoContratto?: string;
  dataAcquisto?: string | Date;
  scadenzaIpotizzata?: string | Date;
  tipoAcquisto?: string;
  valAsteriscato?: number | string;
  scambioIngaggio?: number | string;
  valoreAcquisto?: number | string;
  fvm2425?: number | string;
  ultimoFVM?: number | string;
  valoreXMercato?: number | string;
  ingaggio36?: number | string;
  ingaggioReale?: number | string;
}

export interface PlayerMeta extends Player {
  id: number | string;
  _roles: Role[];
  _fvm: number;
}

export interface Slot {
  id: string;
  label: string;         // es. "DD" o "W/T"
  allowed: Role[];       // in ordine di priorità (più specifico -> più generico)
  x: number;             // %
  y: number;             // %
}
export interface AssignedSlot {
  slot: Slot;
  player: PlayerMeta | null;
  chosenRole: Role | null;
}
export interface LineupEvaluation {
  key: FormationKey;
  slots: Slot[];
  assigned: AssignedSlot[];
  filled: number;
  sumFvm: number;
  bench: PlayerMeta[];
}

export const ROLE_OPTIONS: Role[] = ['P','DC','DD','DS','B','E','M','C','W','T','A','PC'];

export const ROLE_CANON: Record<string, Role> = {
  P:'P', POR:'P',
  DD:'DD', DC:'DC', DS:'DS', B:'B',
  E:'E', M:'M', C:'C', W:'W', T:'T', A:'A', PC:'PC', Pc:'PC'
};

export const FORMATION_KEYS: FormationKey[] = [
  '3-4-3','3-4-1-2','3-4-2-1','3-5-2','3-5-1-1',
  '4-3-3','4-3-1-2','4-4-2','4-1-4-1','4-4-1-1','4-2-3-1'
];

/** util */
const spreadX = (n: number) => Array.from({length:n}, (_,i)=> (100/(n+1))*(i+1));
export const parseRoles = (ruolo?: string): Role[] => {
  if (!ruolo || ruolo === '#N/A') return [];
  const tokens = String(ruolo).split(/[^A-Za-z0-9]+/).filter(Boolean);
  const canon = tokens.map(t => ROLE_CANON[t.toUpperCase()]).filter(Boolean) as Role[];
  return Array.from(new Set(canon));
};
export const getFVM = (p: Player): number => {
  const v1 = Number(p.valoreXMercato); if (!Number.isNaN(v1) && v1>0) return v1;
  const v2 = Number(p.ultimoFVM);      if (!Number.isNaN(v2) && v2>0) return v2;
  const v3 = Number(p.fvm2425);        return Number.isNaN(v3) ? 0 : v3;
};

/** campo: GK fisso + linee helper */
function buildSlotsForFormation(key: FormationKey): Slot[] {
  const slots: Slot[] = [];
  // GK
  slots.push({ id:'GK', label:'P', allowed:['P'], x:50, y:92 });

  const pushLine = (y: number, roleGroups: Role[][]) => {
    const xs = spreadX(roleGroups.length);
    roleGroups.forEach((allowed, i) => {
      slots.push({
        id: `L${y}-${i}`,
        label: allowed.length===1 ? allowed[0] : (allowed as string[]).join('/'),
        allowed,
        x: xs[i],
        y
      });
    });
  };

  switch (key) {
    // --- 3 dietro: laterali = DC/B, centrale = DC ---
    case '3-4-3':
      pushLine(74, [['DC','B'], ['DC'], ['DC','B']]);
      pushLine(58, [['E'], ['M','C'], ['C'], ['E']]);
      pushLine(40, [['W','A'], ['A','PC'], ['W','A']]);
      break;
    case '3-4-1-2':
      pushLine(74, [['DC','B'], ['DC'], ['DC','B']]);
      pushLine(58, [['E'], ['M','C'], ['C'], ['E']]);
      pushLine(47, [['T']]);
      pushLine(38, [['A','PC'], ['A','PC']]);
      break;
    case '3-4-2-1':
      pushLine(74, [['DC','B'], ['DC'], ['DC','B']]);
      pushLine(58, [['E'], ['M','C'], ['C'], ['E']]);
      pushLine(46, [['W','T'], ['T'], ['W','T']]);
      pushLine(36, [['PC','A']]);
      break;
    case '3-5-2':
      pushLine(74, [['DC','B'], ['DC'], ['DC','B']]);
      pushLine(60, [['E'], ['M','C'], ['M'], ['C'], ['E']]);
      pushLine(40, [['A','PC'], ['A','PC']]);
      break;
    case '3-5-1-1':
      pushLine(74, [['DC','B'], ['DC'], ['DC','B']]);
      pushLine(60, [['E'], ['M','C'], ['M'], ['C'], ['E']]);
      pushLine(45, [['T','A']]);
      pushLine(36, [['A','PC']]);
      break;

    // --- 4 dietro classico ---
    case '4-3-3':
      pushLine(74, [['DD'], ['DC'], ['DC'], ['DS']]);
      pushLine(58, [['M','C'], ['M'], ['C']]);
      pushLine(40, [['W','A'], ['A','PC'], ['W','A']]);
      break;
    case '4-3-1-2':
      pushLine(74, [['DD'], ['DC'], ['DC'], ['DS']]);
      pushLine(58, [['M','C'], ['M'], ['C']]);
      pushLine(47, [['T']]);
      pushLine(38, [['A','PC'], ['A','PC']]);
      break;
    case '4-4-2':
      pushLine(74, [['DD'], ['DC'], ['DC'], ['DS']]);
      pushLine(58, [['E','W'], ['M','C'], ['C'], ['E','W']]);
      pushLine(40, [['A','PC','W'], ['A','PC','W']]);
      break;
    case '4-1-4-1':
      pushLine(74, [['DD'], ['DC'], ['DC'], ['DS']]);
      pushLine(63, [['M']]);
      pushLine(52, [['E','W'], ['C','T'], ['T'], ['W']]);
      pushLine(38, [['A','PC']]);
      break;
    case '4-4-1-1':
      pushLine(74, [['DD'], ['DC'], ['DC'], ['DS']]);
      pushLine(58, [['E','W'], ['M'], ['C'], ['E','W']]);
      pushLine(46, [['T','A']]);
      pushLine(38, [['A','PC']]);
      break;
    case '4-2-3-1':
      pushLine(74, [['DD'], ['DC'], ['DC'], ['DS']]);
      pushLine(62, [['M','C'], ['M','C']]);
      pushLine(50, [['W','E','T','A'], ['T'], ['W','E','T','A']]);
      pushLine(38, [['PC','A']]);
      break;
  }
  return slots;
}

/** assegnatore greedy “scarcity-first” con priorità ruolo */
function assignLineupGreedy(slots: Slot[], players: PlayerMeta[]): AssignedSlot[] {
  const assigned: AssignedSlot[] = [];
  const used = new Set<number | string>();

  // calcolo eleggibili
  const elig = slots.map((s, idx) => {
    const list = players
      .filter(p => !used.has(p.id) && p._roles.some(r => s.allowed.includes(r)))
      .sort((a,b)=> b._fvm - a._fvm);
    return { idx, slot:s, list };
  });
  // ordina per scarsità
  elig.sort((a,b)=> a.list.length - b.list.length);

  for (const e of elig) {
    const candidate = e.list.find(p => !used.has(p.id));
    if (candidate) {
      used.add(candidate.id);
      // scegli il ruolo più “specifico” seguendo l’ordine in slot.allowed
      const chosen = e.slot.allowed.find(r => candidate._roles.includes(r)) ?? e.slot.allowed[0];
      assigned[e.idx] = { slot: e.slot, player: candidate, chosenRole: chosen };
    } else {
      assigned[e.idx] = { slot: e.slot, player: null, chosenRole: null };
    }
  }
  return assigned.map((a,i)=> a ?? { slot: slots[i], player: null, chosenRole: null });
}

export function evaluateFormation(key: FormationKey, roster: PlayerMeta[]): LineupEvaluation {
  const slots = buildSlotsForFormation(key);
  const assigned = assignLineupGreedy(slots, roster);
  const filled = assigned.filter(a => a.player).length;
  const sumFvm = assigned.reduce((s,a)=> s + (a.player?.[ '_fvm' ] ?? 0), 0);
  const bench = roster.filter(p => !assigned.some(a => a.player?.id === p.id));
  return { key, slots, assigned, filled, sumFvm, bench };
}

export function useBestLineup(players: Player[], choice: 'auto'|FormationKey) {
  const roster: PlayerMeta[] = players
    .map((p,i) => ({
      ...p,
      id: p.id ?? i,
      _roles: parseRoles(p.ruolo),
      _fvm: getFVM(p)
    }))
    .filter(p => p._roles.length>0 && p._fvm>0)
    .sort((a,b)=> b._fvm - a._fvm);

  if (!roster.length) return null;
  const keys = choice === 'auto' ? FORMATION_KEYS : [choice];
  let best: LineupEvaluation | null = null;
  for (const k of keys) {
    const ev = evaluateFormation(k, roster);
    if (!best || ev.filled > best.filled || (ev.filled===best.filled && ev.sumFvm > best.sumFvm)) {
      best = ev;
    }
  }
  return best!;
}
