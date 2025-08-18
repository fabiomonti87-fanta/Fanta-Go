'use client';

import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import {
  Users, FileText, Calendar, ChevronDown, Upload, CheckCircle,
  CreditCard, TrendingUp, Home, Baby, X, Search, ChevronRight, Eye
} from 'lucide-react';
import { Roboto } from 'next/font/google';

// Font Google (render affidabile su Windows/iOS/Android)
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
});

// ========= Tipi =========
type Role = 'Por' | 'Dc' | 'Dd' | 'Ds' | 'E' | 'M' | 'C' | 'T' | 'W' | 'A' | 'Pc';
type FormationKey = '4-3-3' | '4-4-2' | '3-5-2' | '3-4-3' | '4-2-3-1';

interface Player {
  id?: number;
  giocatore: string;
  squadraFantacalcio: string;
  squadraSerieA: string;
  ruolo: string;
  tipoContratto?: string;
  dataAcquisto?: string;
  scadenzaIpotizzata?: string;
  tipoAcquisto?: string;
  valAsteriscato?: string | number;
  scambioIngaggio?: string | number;
  valoreAcquisto?: string | number;
  fvm2425?: string | number;
  ultimoFVM?: string | number;
  valoreXMercato?: string | number;
  ingaggio36?: string | number;
  ingaggioReale?: string | number;
}

interface Slot {
  id: string;
  label: string;
  allowed: Role[];
  x: number; // 0..100
  y: number; // 0..100 (0 = alto, 100 = basso)
}

interface AssignedSlot {
  slot: Slot;
  player: (Player & { _roles: Role[]; _fvm: number }) | null;
  chosenRole: Role | null;
}

// ========= Costanti & Normalizzazioni =========
const ROLE_OPTIONS: Role[] = ['Por', 'Dc', 'Dd', 'Ds', 'E', 'M', 'C', 'T', 'W', 'A', 'Pc'];

const ROLE_CANON: Record<string, Role> = {
  POR: 'Por',
  PC: 'Pc',
  DC: 'Dc',
  DD: 'Dd',
  DS: 'Ds',
  E: 'E',
  M: 'M',
  C: 'C',
  T: 'T',
  W: 'W',
  A: 'A',
};

const FORMATION_KEYS: FormationKey[] = ['4-3-3', '4-4-2', '3-5-2', '3-4-3', '4-2-3-1'];

const TIPI_ACQUISTO: ReadonlyArray<string> = [
  'Acquistato tit definitivo', 'Asta', 'Asta riparazione',
  'Ceduto in prestito', 'Vivaio', 'Promosso da vivaio'
] as const;

const isValidDate = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '' && v !== '#N/A';

// helper: distribuisce X in percentuale in modo uniforme
const spreadX = (n: number): number[] => {
  const xs: number[] = [];
  for (let i = 1; i <= n; i++) xs.push((100 / (n + 1)) * i);
  return xs;
};

// per ogni formazione, definiamo gli slot con ruoli ammessi (in ordine di preferenza)
function buildSlotsForFormation(key: FormationKey): Slot[] {
  const slots: Slot[] = [];

  // GK (sempre)
  slots.push({ id: 'GK', label: 'Por', allowed: ['Por'], x: 50, y: 90 });

  const pushLine = (y: number, roleGroups: Role[][]) => {
    const xs = spreadX(roleGroups.length);
    roleGroups.forEach((allowed, i) => {
      slots.push({
        id: `L${y}-${i}`,
        label: allowed.length === 1 ? allowed[0] : (allowed.join('/') as unknown as Role),
        allowed,
        x: xs[i],
        y
      });
    });
  };

  // layout per linee (y dal basso verso l'alto)
  switch (key) {
    case '4-3-3': {
      pushLine(72, [['Dd', 'Dc'], ['Dc'], ['Dc'], ['Ds', 'Dc']]);
      pushLine(55, [['M', 'C', 'T', 'E'], ['M', 'C', 'T', 'E'], ['M', 'C', 'T', 'E']]);
      pushLine(38, [['W', 'A'], ['Pc', 'A'], ['W', 'A']]);
      break;
    }
    case '4-4-2': {
      pushLine(72, [['Dd', 'Dc'], ['Dc'], ['Dc'], ['Ds', 'Dc']]);
      pushLine(55, [['E', 'W', 'T'], ['M', 'C', 'T'], ['M', 'C', 'T'], ['E', 'W', 'T']]);
      pushLine(38, [['Pc', 'A', 'W'], ['Pc', 'A', 'W']]);
      break;
    }
    case '3-5-2': {
      pushLine(72, [['Dc', 'Dd', 'Ds'], ['Dc'], ['Dc', 'Dd', 'Ds']]);
      pushLine(57, [['E', 'W'], ['M', 'C', 'T'], ['M', 'C', 'T'], ['M', 'C', 'T'], ['E', 'W']]);
      pushLine(38, [['Pc', 'A', 'W'], ['Pc', 'A', 'W']]);
      break;
    }
    case '3-4-3': {
      pushLine(72, [['Dc', 'Dd', 'Ds'], ['Dc'], ['Dc', 'Dd', 'Ds']]);
      pushLine(55, [['E', 'W'], ['M', 'C', 'T'], ['M', 'C', 'T'], ['E', 'W']]);
      pushLine(38, [['W', 'A'], ['Pc', 'A'], ['W', 'A']]);
      break;
    }
    case '4-2-3-1': {
      pushLine(72, [['Dd', 'Dc'], ['Dc'], ['Dc'], ['Ds', 'Dc']]);
      pushLine(60, [['M', 'C'], ['M', 'C']]);
      pushLine(48, [['W', 'E', 'T', 'A'], ['T', 'A', 'W'], ['W', 'E', 'T', 'A']]);
      pushLine(36, [['Pc', 'A']]);
      break;
    }
  }

  return slots;
}

function parseRoles(ruolo: string | undefined | null): Role[] {
  if (!ruolo || ruolo === '#N/A') return [];
  const tokens = String(ruolo).split(/[^A-Za-z0-9]+/).filter(Boolean);
  const canon = tokens
    .map(t => ROLE_CANON[t.toUpperCase()])
    .filter(Boolean) as Role[];
  return [...new Set(canon)];
}

function getFVM(p: Player): number {
  const v1 = Number(p.valoreXMercato);
  if (!Number.isNaN(v1) && v1 > 0) return v1;
  const v2 = Number(p.ultimoFVM);
  if (!Number.isNaN(v2) && v2 > 0) return v2;
  const v3 = Number(p.fvm2425);
  return Number.isNaN(v3) ? 0 : Math.max(0, v3);
}

// ========= Componente =========
const FantacalcioManager: React.FC = () => {
  const [allData, setAllData] = useState<Player[]>([]);
  const [filteredData, setFilteredData] = useState<Player[]>([]);
  const [squadre, setSquadre] = useState<string[]>([]);
  const [creditiSquadre, setCreditiSquadre] = useState<Record<string, number>>({});
  const [selectedSquadra, setSelectedSquadra] = useState<string>('');
  const [filterType, setFilterType] = useState<'tutti' | 'scadenza' | 'organico' | 'riconferme' | 'nonInListone' | 'vivaio'>('tutti');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fileLoaded, setFileLoaded] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<'squadra' | 'riepilogo'>('squadra');

  // Ricerca e filtri
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRoles, setSelectedRoles] = useState<Set<Role>>(new Set());
  const [homeQuery, setHomeQuery] = useState<string>('');

  // Formazione
  const [formationChoice, setFormationChoice] = useState<'auto' | FormationKey>('auto');
  const [showPitch, setShowPitch] = useState<boolean>(false);

  // Prossime partite Serie A (facoltativo: se non hai la rotta /api/sa-matches, rimane vuoto)
  type MatchLite = {
    utcDate: string;
    homeTeam: { name: string };
    awayTeam: { name: string };
    competition?: { code?: string; name?: string };
    score?: { fullTime?: { home: number | null; away: number | null } };
  };
  const [matches, setMatches] = useState<MatchLite[]>([]);

  // Auto-load se l’ambiente fornisce window.fs (es. demo locale)
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as unknown as { fs?: { readFile: (n: string) => Promise<ArrayBuffer> } }).fs?.readFile) {
      (async () => {
        try {
          setLoading(true);
          for (const name of ['GESTIONALE_UFFICIALE 2.xlsx', 'GESTIONALE_UFFICIALE 1.xlsx', 'GESTIONALE_UFFICIALE.xlsx']) {
            try {
              const buf = await (window as unknown as { fs: { readFile: (n: string) => Promise<ArrayBuffer> } }).fs.readFile(name);
              processExcelData(buf);
              return;
            } catch {
              /* tenta il prossimo file */
            }
          }
          setLoading(false);
        } catch {
          setLoading(false);
        }
      })();
    }
  }, []);

  // Widget partite (safe: se fallisce, lascia lista vuota)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/sa-matches', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { matches?: MatchLite[] };
        if (!cancelled && json?.matches?.length) setMatches(json.matches);
      } catch {
        /* ignora */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        processExcelData(ev.target?.result as ArrayBuffer);
      } catch {
        setError('Errore nel processamento del file.');
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Errore nella lettura del file.');
      setLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const loadDemoData = () => {
    const demo: Player[] = [
      { id: 1, giocatore: 'Mario Rossi', squadraFantacalcio: 'Dinamo Splash', squadraSerieA: 'JUV', ruolo: 'Pc', tipoContratto: 'Diritto 2 anni', dataAcquisto: '2024-09-01', scadenzaIpotizzata: '2026-07-01', tipoAcquisto: 'Asta', valoreAcquisto: 50, fvm2425: 18, ultimoFVM: 18, valoreXMercato: 120, ingaggio36: 5.0, ingaggioReale: 3.0 },
      { id: 2, giocatore: 'Luca Bianchi', squadraFantacalcio: 'Dinamo Splash', squadraSerieA: 'INT', ruolo: 'W', tipoContratto: 'Standard 1 anno', dataAcquisto: '2024-09-01', scadenzaIpotizzata: '2025-07-01', tipoAcquisto: 'Acquistato tit definitivo', valoreAcquisto: 20, fvm2425: 12, ultimoFVM: 12, valoreXMercato: 30, ingaggio36: 3.0, ingaggioReale: 2.0 },
      { id: 3, giocatore: 'Gianni Verdi', squadraFantacalcio: 'Dinamo Splash', squadraSerieA: 'NAP', ruolo: 'M', tipoContratto: 'Diritto 1 anno', dataAcquisto: '2024-09-01', scadenzaIpotizzata: '2026-08-01', tipoAcquisto: 'Asta riparazione', valoreAcquisto: 15, fvm2425: 10, ultimoFVM: 10, valoreXMercato: 60, ingaggio36: 2.0, ingaggioReale: 1.5 },
      { id: 7, giocatore: 'Nonno Gigi', squadraFantacalcio: 'Dinamo Splash', squadraSerieA: 'PAR', ruolo: 'Por', tipoContratto: 'Standard 2 anni', dataAcquisto: '2024-09-01', scadenzaIpotizzata: '2026-07-01', tipoAcquisto: 'Asta', valoreAcquisto: 0, fvm2425: 0, ultimoFVM: 0, valoreXMercato: 0, ingaggio36: 0.8, ingaggioReale: 0.4 },
      { id: 9, giocatore: 'Terzino Destro', squadraFantacalcio: 'Dinamo Splash', squadraSerieA: 'SAM', ruolo: 'Dd', dataAcquisto: '2024-09-01', scadenzaIpotizzata: '2027-07-01', tipoAcquisto: 'Asta', valoreAcquisto: 0, fvm2425: 0, ultimoFVM: 0, valoreXMercato: 20, ingaggio36: 1.5, ingaggioReale: 1.0 },
      { id: 10, giocatore: 'Centrale 1', squadraFantacalcio: 'Dinamo Splash', squadraSerieA: 'LAZ', ruolo: 'Dc', dataAcquisto: '2024-09-01', scadenzaIpotizzata: '2027-07-01', tipoAcquisto: 'Asta', valoreAcquisto: 0, fvm2425: 0, ultimoFVM: 0, valoreXMercato: 25, ingaggio36: 1.7, ingaggioReale: 1.2 },
      { id: 11, giocatore: 'Centrale 2', squadraFantacalcio: 'Dinamo Splash', squadraSerieA: 'TOR', ruolo: 'Dc', dataAcquisto: '2024-09-01', scadenzaIpotizzata: '2027-07-01', tipoAcquisto: 'Asta', valoreAcquisto: 0, fvm2425: 0, ultimoFVM: 0, valoreXMercato: 24, ingaggio36: 1.6, ingaggioReale: 1.1 },
      { id: 12, giocatore: 'Terzino Sinistro', squadraFantacalcio: 'Dinamo Splash', squadraSerieA: 'SAS', ruolo: 'Ds', dataAcquisto: '2024-09-01', scadenzaIpotizzata: '2027-07-01', tipoAcquisto: 'Asta', valoreAcquisto: 0, fvm2425: 0, ultimoFVM: 0, valoreXMercato: 19, ingaggio36: 1.4, ingaggioReale: 0.9 },
      { id: 13, giocatore: 'Esterno', squadraFantacalcio: 'Dinamo Splash', squadraSerieA: 'FIO', ruolo: 'E', dataAcquisto: '2024-09-01', scadenzaIpotizzata: '2027-07-01', tipoAcquisto: 'Asta', valoreAcquisto: 0, fvm2425: 0, ultimoFVM: 0, valoreXMercato: 28, ingaggio36: 1.8, ingaggioReale: 1.3 },
      { id: 14, giocatore: 'Mezzala', squadraFantacalcio: 'Dinamo Splash', squadraSerieA: 'BOL', ruolo: 'C', dataAcquisto: '2024-09-01', scadenzaIpotizzata: '2027-07-01', tipoAcquisto: 'Asta', valoreAcquisto: 0, fvm2425: 0, ultimoFVM: 0, valoreXMercato: 26, ingaggio36: 1.6, ingaggioReale: 1.2 },
      { id: 15, giocatore: 'Trequartista', squadraFantacalcio: 'Dinamo Splash', squadraSerieA: 'ATA', ruolo: 'T', dataAcquisto: '2024-09-01', scadenzaIpotizzata: '2027-07-01', tipoAcquisto: 'Asta', valoreAcquisto: 0, fvm2425: 0, ultimoFVM: 0, valoreXMercato: 35, ingaggio36: 2.0, ingaggioReale: 1.5 },
      { id: 16, giocatore: 'Ala', squadraFantacalcio: 'Dinamo Splash', squadraSerieA: 'ROM', ruolo: 'W', dataAcquisto: '2024-09-01', scadenzaIpotizzata: '2027-07-01', tipoAcquisto: 'Asta', valoreAcquisto: 0, fvm2425: 0, ultimoFVM: 0, valoreXMercato: 34, ingaggio36: 2.1, ingaggioReale: 1.5 },
      { id: 17, giocatore: 'Seconda Punta', squadraFantacalcio: 'Dinamo Splash', squadraSerieA: 'NAP', ruolo: 'A', dataAcquisto: '2024-09-01', scadenzaIpotizzata: '2027-07-01', tipoAcquisto: 'Asta', valoreAcquisto: 0, fvm2425: 0, ultimoFVM: 0, valoreXMercato: 40, ingaggio36: 2.4, ingaggioReale: 1.6 },
    ];
    setAllData(demo);
    const uniq = [...new Set(demo.map(p => p.squadraFantacalcio))].sort();
    setSquadre(uniq);
    setSelectedSquadra(uniq[0] || '');
    setCreditiSquadre({ 'Dinamo Splash': 100 });
    setFileLoaded(true);
    setLoading(false);
    setError(null);
  };

  const processExcelData = (data: ArrayBuffer) => {
    try {
      const wb = XLSX.read(data, {
        type: 'array', cellStyles: true, cellFormulas: true, cellDates: true, cellNF: true, sheetStubs: true
      });
      const gestionale = wb.Sheets['Gestionale'];
      if (!gestionale) { setError('Il file non contiene il foglio &quot;Gestionale&quot;.'); setLoading(false); return; }

      const raw = XLSX.utils.sheet_to_json(gestionale, { header: 1 }) as unknown[][];
      const rows: Player[] = [];
      for (let i = 1; i < raw.length; i++) {
        const r = raw[i];
        if (r && r[1] && r[1] !== '#N/A') {
          rows.push({
            id: Number(r[0]),
            giocatore: String(r[1]),
            squadraFantacalcio: String(r[2] ?? ''),
            squadraSerieA: String(r[3] ?? ''),
            ruolo: String(r[4] ?? ''),
            tipoContratto: r[5] ? String(r[5]) : undefined,
            dataAcquisto: r[6] ? String(r[6]) : undefined,
            scadenzaIpotizzata: r[7] ? String(r[7]) : undefined,
            tipoAcquisto: r[8] ? String(r[8]) : undefined,
            valAsteriscato: r[9] as string | number | undefined,
            scambioIngaggio: r[10] as string | number | undefined,
            valoreAcquisto: r[11] as string | number | undefined,
            fvm2425: r[12] as string | number | undefined,
            ultimoFVM: r[13] as string | number | undefined,
            valoreXMercato: r[15] as string | number | undefined,
            ingaggio36: r[16] as string | number | undefined,
            ingaggioReale: r[17] as string | number | undefined,
          });
        }
      }
      if (!rows.length) { setError('Nessun dato valido trovato nel file.'); setLoading(false); return; }
      setAllData(rows);

      const uniq = [...new Set(rows.map(p => p.squadraFantacalcio).filter(s => s && s !== '#N/A'))].sort();
      setSquadre(uniq);

      const sintesi = wb.Sheets['Sintesi Squadre'];
      if (sintesi) {
        const ss = XLSX.utils.sheet_to_json(sintesi, { header: 1 }) as unknown[][];
        const cred: Record<string, number> = {};
        for (let i = 18; i < ss.length; i++) {
          const r = ss[i];
          if (r && r[0]) cred[String(r[0])] = Number(r[1]) || 0;
        }
        setCreditiSquadre(cred);
      }

      if (uniq.length) setSelectedSquadra(uniq[0]);
      setFileLoaded(true);
      setLoading(false);
    } catch {
      setError('Errore nel processamento del file.');
      setLoading(false);
    }
  };

  // Helpers UI
  const formatDate = (v: unknown) => {
    if (!isValidDate(v)) return '-';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('it-IT');
  };
  const formatRuolo = (v: unknown) => (!v || v === '#N/A') ? '-' : String(v);
  const formatFVM = (v: unknown) => (!v || v === '#N/A') ? '-' : String(v);
  const formatIngaggio = (v: unknown) => {
    if (!v || v === '#N/A') return '-';
    const n = Number(v);
    return Number.isNaN(n) ? '-' : n.toFixed(1);
  };

  // Calcoli riepilogo
  const calculateValoreInScadenza = (squadra: string): number => allData
    .filter(p => p.squadraFantacalcio === squadra
      && TIPI_ACQUISTO.includes(String(p.tipoAcquisto || ''))
      && isValidDate(p.scadenzaIpotizzata)
      && new Date(String(p.scadenzaIpotizzata)).getDate() === 1
      && new Date(String(p.scadenzaIpotizzata)).getMonth() === 6
      && new Date(String(p.scadenzaIpotizzata)).getFullYear() === 2025)
    .reduce((s, p) => s + (Number(p.valoreXMercato) || 0), 0);

  const calculatePossibiliCrediti = (squadra: string): number =>
    (creditiSquadre[squadra] || 0) + calculateValoreInScadenza(squadra);

  const calculateTotaleIngaggi = (squadra: string): number => allData
    .filter(p => p.squadraFantacalcio === squadra && TIPI_ACQUISTO.includes(String(p.tipoAcquisto || '')))
    .reduce((s, p) => s + (Number(p.ingaggioReale) || 0), 0);

  const calculateContrattiPluriennali = (squadra: string): number => allData
    .filter(p => {
      if (p.squadraFantacalcio !== squadra) return false;
      const organico = TIPI_ACQUISTO.filter(t => t !== 'Vivaio');
      if (!organico.includes(String(p.tipoAcquisto || ''))) return false;
      if (!isValidDate(p.scadenzaIpotizzata)) return false;
      const scad = new Date(String(p.scadenzaIpotizzata));
      if (!(scad > new Date('2025-07-01'))) return false;
      const hasFVM = p.ultimoFVM && p.ultimoFVM !== '#N/A' && p.ultimoFVM !== '#N/D' && p.ultimoFVM !== '';
      return Boolean(hasFVM);
    }).length;

  // Filtri principali + ricerca + ruoli (OR)
  const normalizedQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);
  useEffect(() => {
    if (!selectedSquadra || !allData.length) { setFilteredData([]); return; }
    const res = allData.filter(p => {
      if (p.squadraFantacalcio !== selectedSquadra) return false;

      if (filterType === 'vivaio' && !(p.tipoAcquisto === 'Vivaio' || p.tipoAcquisto === 'Promosso da vivaio')) return false;

      const tipi = filterType === 'organico'
        ? TIPI_ACQUISTO.filter(t => t !== 'Vivaio')
        : TIPI_ACQUISTO;

      if (!tipi.includes(String(p.tipoAcquisto || ''))) return false;

      if (filterType === 'nonInListone') {
        const noList = !p.ultimoFVM || p.ultimoFVM === '#N/A' || p.ultimoFVM === '#N/D' || p.ultimoFVM === '';
        if (!noList) return false;
      }

      if (isValidDate(p.scadenzaIpotizzata)) {
        const scad = new Date(String(p.scadenzaIpotizzata));
        const isScad2025 = scad.getDate() === 1 && scad.getMonth() === 6 && scad.getFullYear() === 2025;
        const dopo = scad > new Date('2025-07-01');
        if (filterType === 'scadenza' && !isScad2025) return false;
        if (filterType === 'organico' && !dopo) return false;
        if (filterType === 'riconferme') {
          const tc = String(p.tipoContratto || '').toLowerCase();
          const hasDiritto = tc.includes('diritto') && !tc.includes('standard');
          if (!(hasDiritto && dopo)) return false;
        }
      } else {
        if (!['tutti', 'vivaio', 'nonInListone'].includes(filterType)) return false;
      }

      if (normalizedQuery) {
        const name = String(p.giocatore || '').toLowerCase();
        if (!name.includes(normalizedQuery)) return false;
      }

      if (selectedRoles.size > 0) {
        const rolesCanon = parseRoles(p.ruolo);
        const matches = rolesCanon.some(r => selectedRoles.has(r));
        if (!matches) return false;
      }

      return true;
    });
    setFilteredData(res);
  }, [selectedSquadra, filterType, allData, normalizedQuery, selectedRoles]);

  const clearSearchAndRoles = () => { setSearchQuery(''); setSelectedRoles(new Set<Role>()); };
  const toggleRole = (r: Role) => setSelectedRoles(prev => {
    const n = new Set(prev); n.has(r) ? n.delete(r) : n.add(r); return n;
  });

  // Home: squadre filtrate
  const squadreFiltrate = useMemo(() => {
    const q = homeQuery.trim().toLowerCase();
    if (!q) return squadre;
    return squadre.filter(s => s.toLowerCase().includes(q));
  }, [homeQuery, squadre]);

  // ---------- Calcolo XI migliore ----------
  const organicoPlayers = useMemo(() => {
    if (!selectedSquadra) return [] as (Player & { _roles: Role[]; _fvm: number })[];
    return allData
      .filter(p => p.squadraFantacalcio === selectedSquadra)
      .filter(p => {
        const organicoTypes = TIPI_ACQUISTO.filter(t => t !== 'Vivaio');
        if (!organicoTypes.includes(String(p.tipoAcquisto || ''))) return false;
        if (!isValidDate(p.scadenzaIpotizzata)) return false;
        const scad = new Date(String(p.scadenzaIpotizzata));
        if (!(scad > new Date('2025-07-01'))) return false;
        return getFVM(p) > 0;
      })
      .map(p => ({ ...p, _roles: parseRoles(p.ruolo), _fvm: getFVM(p) }))
      .sort((a, b) => b._fvm - a._fvm);
  }, [allData, selectedSquadra]);

  const assignLineupGreedy = (slots: Slot, players: (Player & { _roles: Role[]; _fvm: number })[]) => {
    // Questa definizione è solo per firma; usiamo quella sotto che lavora su array
    return [] as AssignedSlot[];
  };

  // greedy “scarcity first”: per ogni slot (ordinati per pochi eleggibili), assegna il miglior FVM disponibile
  function assignLineup(slots: Slot[], players: (Player & { _roles: Role[]; _fvm: number })[]): AssignedSlot[] {
    const assigned: (AssignedSlot | undefined)[] = [];
    const used = new Set<number | undefined>();
    const elig = slots.map((s, idx) => {
      const list = players.filter(p => !used.has(p.id) && p._roles.some(r => s.allowed.includes(r as Role)))
        .sort((a, b) => b._fvm - a._fvm);
      return { idx, slot: s, list };
    });
    // ordina per scarsità
    elig.sort((a, b) => a.list.length - b.list.length);

    for (const e of elig) {
      const candidate = e.list.find(p => !used.has(p.id));
      if (candidate) {
        used.add(candidate.id);
        const chosenRole = e.slot.allowed.find(r => candidate._roles.includes(r as Role)) || e.slot.allowed[0];
        assigned[e.idx] = { slot: e.slot, player: candidate, chosenRole };
      } else {
        assigned[e.idx] = { slot: e.slot, player: null, chosenRole: null };
      }
    }
    return assigned.map((a, i) => a ?? { slot: slots[i], player: null, chosenRole: null });
  }

  function evaluateFormation(key: FormationKey) {
    const slots = buildSlotsForFormation(key);
    const assigned = assignLineup(slots, organicoPlayers);
    const filled = assigned.filter(a => !!a.player).length;
    const sumFvm = assigned.reduce((s, a) => s + (a.player ? a.player._fvm : 0), 0);
    const bench = organicoPlayers.filter(p => !assigned.some(a => a.player && a.player.id === p.id));
    return { key, slots, assigned, filled, sumFvm, bench };
  }

  const bestLineup = useMemo(() => {
    if (!organicoPlayers.length) return null as null | ReturnType<typeof evaluateFormation>;
    const keys = formationChoice === 'auto' ? FORMATION_KEYS : [formationChoice];
    let best: ReturnType<typeof evaluateFormation> | null = null;
    for (const k of keys) {
      const ev = evaluateFormation(k);
      if (!best) best = ev;
      else {
        if (ev.filled > best.filled) best = ev;
        else if (ev.filled === best.filled && ev.sumFvm > best.sumFvm) best = ev;
      }
    }
    return best;
  }, [organicoPlayers, formationChoice]);

  // ======= UI =======

  if (!fileLoaded) {
    return (
      <div className={`${roboto.className} min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-3`}>
        <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
          <div className="text-center">
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-3">
              <Upload className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">Gestionale Fantacalcio</h2>
            <p className="text-gray-600 mb-4 text-sm">Carica il file Excel <span className="font-semibold">GESTIONALE_UFFICIALE.xlsx</span> per iniziare</p>

            {loading ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto mb-3"></div>
                <p className="text-gray-600 text-sm">Elaborazione del file in corso…</p>
              </div>
            ) : (
              <>
                <label className="block w-full">
                  <div className="flex items-center justify-center w-full h-28 px-4 transition bg-white border-2 border-gray-200 border-dashed rounded-lg cursor-pointer hover:border-green-400">
                    <div className="flex flex-col items-center space-y-1">
                      <Upload className="w-8 h-8 text-gray-400" />
                      <span className="font-medium text-gray-700 text-sm">Tocca per selezionare il file</span>
                      <span className="text-[11px] text-gray-500">Oppure trascina qui</span>
                    </div>
                  </div>
                  <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                </label>

                {error && <div className="mt-3 p-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">{error}</div>}

                <div className="mt-3 flex items-center justify-center gap-2">
                  <button onClick={loadDemoData} className="px-3 py-2 rounded-lg text-sm bg-gray-900 text-white hover:bg-black">
                    Carica dati demo
                  </button>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg text-left">
                  <p className="text-[11px] text-blue-800 font-semibold mb-1">Requisiti del file</p>
                  <ul className="text-[11px] text-blue-700 space-y-1">
                    <li>• Foglio obbligatorio: &quot;Gestionale&quot;</li>
                    <li>• Colonne: Giocatore, Squadra, Ruolo, ecc.</li>
                    <li>• Formato: .xlsx o .xls</li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${roboto.className} min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento dati…</p>
        </div>
      </div>
    );
  }

  // ===== HOME =====
  if (currentView === 'riepilogo') {
    return (
      <div className={`${roboto.className} min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-3 md:p-4`}>
        <div className="max-w-5xl mx-auto">
     {/* Header Home */}
<div className="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-4">
  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
      <Home className="text-green-600" /> Home - Riepilogo Squadre
    </h1>

    {/* Search + selettore + pulsanti */}
    <div className="flex w-full md:w-auto items-center gap-3">
      {/* Search squadre */}
      <div className="relative w-full md:w-80">
        <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        <input
          value={homeQuery}
          onChange={(e) => setHomeQuery(e.target.value)}
          placeholder="Cerca squadra…"
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        {homeQuery && (
          <button
            onClick={() => setHomeQuery('')}
            className="absolute right-2 top-2 h-7 w-7 rounded-md hover:bg-gray-100 flex items-center justify-center"
            aria-label="Pulisci ricerca squadre"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* Selettore + pulsanti */}
      <div className="flex items-center gap-2 shrink-0">
        <select
          value={selectedSquadra}
          onChange={(e) => setSelectedSquadra(e.target.value)}
          className="px-3 py-2 border rounded-lg"
          aria-label="Seleziona squadra"
        >
          {squadre.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <button
          onClick={() => setCurrentView('squadra')}
          className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          Vai al dettaglio
        </button>

        {/* <-- ECCO IL BOTTONE FAST MODE */}
        <Link
          href="/fast"
          className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
        >
          🎮 Fast Mode
        </Link>
      </div>
    </div>
  </div>
</div>


          {/* Tabella + Legenda */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden relative">
            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full text-sm">
                <thead className="bg-gradient-to-r from-green-600 to-green-700">
                  <tr>
                    <th className="px-4 md:px-6 py-3 md:py-4 text-left text-white font-semibold">Squadra</th>
                    <th className="px-4 md:px-6 py-3 text-center text-white font-semibold">Crediti</th>
                    <th className="px-4 md:px-6 py-3 text-center text-white font-semibold">Contratti Pluriennali</th>
                    <th className="px-4 md:px-6 py-3 text-center text-white font-semibold">Totale Ingaggi</th>
                    <th className="px-4 md:px-6 py-3 text-center text-white font-semibold">Possibili Crediti</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {squadreFiltrate.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-6 text-center text-gray-500">Nessuna squadra trovata</td></tr>
                  )}
                  {squadreFiltrate
                    .map(squadra => ({
                      squadra,
                      creditiAttuali: creditiSquadre[squadra] || 0,
                      possibiliCrediti: calculatePossibiliCrediti(squadra),
                      totaleIngaggi: calculateTotaleIngaggi(squadra),
                      contrattiPluriennali: calculateContrattiPluriennali(squadra)
                    }))
                    .sort((a, b) => b.possibiliCrediti - a.possibiliCrediti)
                    .map((item, idx) => (
                      <tr
                        key={item.squadra}
                        className={(idx % 2 === 0 ? 'bg-gray-50' : 'bg-white') + ' hover:bg-green-50 cursor-pointer'}
                        tabIndex={0}
                        onClick={() => { setSelectedSquadra(item.squadra); setCurrentView('squadra'); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSelectedSquadra(item.squadra); setCurrentView('squadra'); } }}
                        aria-label={`Vai al dettaglio di ${item.squadra}`}
                      >
                        <td className="px-6 py-4 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <span>{item.squadra}</span>
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-base font-semibold text-blue-600">{item.creditiAttuali}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-base font-semibold text-purple-600">{item.contrattiPluriennali}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-base font-semibold text-orange-600">{item.totaleIngaggi.toFixed(1)}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-base font-semibold text-green-600">{item.possibiliCrediti.toFixed(0)}</span>
                          <span className="text-[11px] text-gray-500 ml-2">(+{(item.possibiliCrediti - item.creditiAttuali).toFixed(0)})</span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Legenda */}
            <div className="p-3 md:p-4 bg-gray-50 border-t text-[12px] md:text-xs text-gray-600">
              <p className="mb-1"><strong>Legenda:</strong></p>
              <ul className="space-y-1">
                <li>• <strong>Contratti Pluriennali:</strong> in organico (scadenza &gt; 01/07/2025) presenti nel listone</li>
                <li>• <strong>Possibili Crediti:</strong> crediti attuali + valore dei giocatori in scadenza al 01/07/2025</li>
              </ul>
            </div>
          </div>

          {/* Widget Prossime partite Serie A */}
          <div className="mt-6 bg-white rounded-xl shadow p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Prossime partite Serie A (7 giorni)</h3>
            {matches.length === 0 ? (
              <p className="text-sm text-gray-500">Nessuna partita trovata.</p>
            ) : (
              <ul className="text-sm text-gray-800 grid md:grid-cols-2 gap-2">
                {matches.map((m, i) => {
                  const dt = new Date(m.utcDate);
                  return (
                    <li key={i} className="flex items-center justify-between border rounded-lg px-3 py-2">
                      <span className="font-medium">{m.homeTeam.name} – {m.awayTeam.name}</span>
                      <span className="text-gray-500">
                        {dt.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===== DETTAGLIO =====
  return (
    <div className={`${roboto.className} min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <Users className="text-green-600" /> Gestionale Fantacalcio
            </h1>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentView('riepilogo')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Home className="h-4 w-4" /> Home
              </button>
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span>File caricato</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cards */}
        {selectedSquadra && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Crediti Rimanenti</p>
                  <p className="text-2xl font-bold text-blue-600">{creditiSquadre[selectedSquadra] || 0}</p>
                </div>
                <CreditCard className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Totale Ingaggi</p>
                  <p className="text-2xl font-bold text-orange-600">{calculateTotaleIngaggi(selectedSquadra).toFixed(1)}</p>
                  <p className="text-xs text-gray-500">(ingaggio di competenza)</p>
                </div>
                <Users className="h-8 w-8 text-orange-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Possibili Crediti Totali</p>
                  <p className="text-2xl font-bold text-green-600">{calculatePossibiliCrediti(selectedSquadra).toFixed(0)}</p>
                  <p className="text-xs text-gray-500">(crediti + valore in scadenza)</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </div>
          </div>
        )}

        {/* Controlli + Search ruoli */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Squadra */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Seleziona Squadra</label>
              <div className="relative">
                <select
                  value={selectedSquadra}
                  onChange={(e) => setSelectedSquadra(e.target.value)}
                  className="w-full px-4 py-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                >
                  {squadre.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-3 h-5 w-5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Filtri base */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filtro Giocatori</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'tutti', label: 'Tutti', cls: 'bg-green-600' },
                  { key: 'scadenza', label: 'In Scadenza', cls: 'bg-red-600' },
                  { key: 'organico', label: 'In Organico', cls: 'bg-blue-600' },
                  { key: 'riconferme', label: 'Riconferme', cls: 'bg-purple-600' },
                  { key: 'nonInListone', label: 'Non in Lista', cls: 'bg-orange-600' },
                  { key: 'vivaio', label: <><Baby className="h-4 w-4 inline mr-1" />Vivaio</>, cls: 'bg-emerald-600' },
                ].map(({ key, label, cls }) => (
                  <button
                    key={key}
                    onClick={() => setFilterType(key as typeof filterType)}
                    className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${filterType === key ? `${cls} text-white` : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    {label as React.ReactNode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Search nella rosa + Toggle ruoli */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Cerca nella rosa</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={`Cerca nella rosa di ${selectedSquadra || 'squadra'}…`}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-2 h-7 w-7 rounded-md hover:bg-gray-100 flex items-center justify-center"
                    aria-label="Pulisci ricerca"
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">La ricerca è limitata alla squadra selezionata.</p>
            </div>

            {/* Toggle Ruoli (OR) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filtra per ruolo (OR)</label>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map(r => {
                  const active = selectedRoles.has(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleRole(r)}
                      aria-pressed={active}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                        active ? 'bg-green-600 text-white border-green-600' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {r}
                    </button>
                  );
                })}
                {selectedRoles.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedRoles(new Set<Role>())}
                    className="px-3 py-1.5 rounded-full text-sm font-medium border bg-white text-gray-700 hover:bg-gray-50"
                  >
                    Azzera
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ---------- BLOCCO: Oggi giocherebbero così ---------- */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Oggi giocherebbero così</h3>
              <p className="text-sm text-gray-500">Calcolo su organico (scadenza &gt; 01/07/2025) e FVM più alto, rispettando i ruoli Mantra.</p>
            </div>
            <div className="flex gap-2 items-end">
              <div className="w-full md:w-64">
                <label className="block text-sm font-medium text-gray-700 mb-1">Formazione</label>
                <select
                  value={formationChoice}
                  onChange={(e) => setFormationChoice(e.target.value as 'auto' | FormationKey)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                >
                  <option value="auto">Selezione automatica (migliore)</option>
                  {FORMATION_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <button
                onClick={() => setShowPitch(v => !v)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                title="Mostra/Nascondi campo"
              >
                <Eye className="h-4 w-4" />
                {showPitch ? 'Nascondi campo' : 'Oggi giocherebbero così'}
              </button>
            </div>
          </div>

          {/* Campo stilizzato (mostra solo se attivato) */}
          {showPitch && (
            <div className="mt-4 overflow-x-auto">
              <div className="min-w-[640px]">
                <div
                  className="relative w-full rounded-xl border"
                  style={{
                    paddingTop: '62%', // aspect ratio
                    background:
                      'linear-gradient(180deg, rgba(11,94,38,0.95), rgba(11,94,38,0.95)), repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 6%, rgba(255,255,255,0.02) 6%, rgba(255,255,255,0.02) 12%)',
                    boxShadow: 'inset 0 0 0 3px #fff, inset 0 0 0 6px rgba(255,255,255,0.35)'
                  }}
                >
                  {/* linee principali */}
                  <div className="absolute left-1/2 top-0 -translate-x-1/2 w-px h-full bg-white/70" />
                  <div className="absolute left-1/2 top-[31%] -translate-x-1/2 w-[18%] h-[32%] rounded-full border border-white/70" />
                  {/* area rigore inferiore */}
                  <div className="absolute left-[20%] bottom-0 w-[60%] h-[22%] border-t border-white/70" />
                  <div className="absolute left-[35%] bottom-0 w-[30%] h-[10%] border-t border-white/70" />
                  {/* area rigore superiore */}
                  <div className="absolute left-[20%] top-0 w-[60%] h-[22%] border-b border-white/70" />
                  <div className="absolute left-[35%] top-0 w-[30%] h-[10%] border-b border-white/70" />
                  {/* dischetto centrocampo */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full" />

                  {/* giocatori */}
                  {bestLineup && bestLineup.assigned.map((a, i) => {
                    const p = a.player;
                    const left = `${a.slot.x}%`;
                    const top = `${a.slot.y}%`;
                    const initials = p ? (p.giocatore.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()) : '-';
                    const label = p ? (p.giocatore.length > 14 ? p.giocatore.slice(0, 13) + '…' : p.giocatore) : '—';
                    return (
                      <div key={`pos-${i}`} style={{ left, top, transform: 'translate(-50%, -50%)' }} className="absolute text-center">
                        <div className={`relative mx-auto h-11 w-11 rounded-full flex items-center justify-center border-2 ${p ? 'bg-white/95 text-gray-900 border-emerald-600' : 'bg-white/30 text-white border-white/50'} shadow-lg`}>
                          {/* aureola */}
                          <div className="absolute -z-10 inset-0 rounded-full" style={{ boxShadow: '0 0 24px rgba(16,185,129,0.45)' }} />
                          <span className="text-[11px] font-bold">{initials}</span>
                        </div>
                        <div className="mt-1 text-[11px] font-medium text-white drop-shadow">
                          {label}
                        </div>
                        <div className="text-[10px] text-white/85">
                          {p ? `${a.chosenRole} • FVM ${p._fvm.toFixed(0)}` : a.slot.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* riepilogo punteggio / completezza */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-700">
            {bestLineup ? (
              <>
                <span><strong>Formazione:</strong> {formationChoice === 'auto' ? `${bestLineup.key} (migliore)` : bestLineup.key}</span>
                <span>•</span>
                <span><strong>Titolari:</strong> {bestLineup.filled}/11</span>
                <span>•</span>
                <span><strong>Somma FVM XI:</strong> {bestLineup.sumFvm.toFixed(0)}</span>
                {bestLineup.filled < 11 && (
                  <>
                    <span>•</span>
                    <span className="text-amber-700">XI incompleto: non ci sono abbastanza giocatori/ruoli in organico.</span>
                  </>
                )}
              </>
            ) : (
              <span className="text-gray-600">Nessun giocatore in organico disponibile per calcolare l’XI.</span>
            )}
          </div>

          {/* panchina */}
          {bestLineup && bestLineup.bench.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-800 mb-1">Panchina (migliori esclusi)</div>
              <div className="flex flex-wrap gap-2">
                {bestLineup.bench
                  .slice(0, 12)
                  .map(b => (
                    <span key={b.id} className="px-2 py-1 rounded-full bg-gray-100 border text-xs text-gray-800">
                      {b.giocatore} <span className="text-gray-500">({parseRoles(b.ruolo).join('/')})</span> • FVM {getFVM(b).toFixed(0)}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>
        {/* ---------- fine blocco XI ---------- */}

        {/* Statistiche (Dettaglio) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Totale Giocatori</p>
                <p className="text-2xl font-bold text-gray-800">{filteredData.length}</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Scadenza</p>
                <p className="text-2xl font-bold text-red-600">
                  {filteredData.filter(p => {
                    if (!isValidDate(p.scadenzaIpotizzata)) return false;
                    const s = new Date(String(p.scadenzaIpotizzata));
                    return s.getDate() === 1 && s.getMonth() === 6 && s.getFullYear() === 2025;
                  }).length}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-red-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Riconferme</p>
                <p className="text-2xl font-bold text-purple-600">
                  {filteredData.filter(p => {
                    if (!isValidDate(p.scadenzaIpotizzata)) return false;
                    const scad = new Date(String(p.scadenzaIpotizzata));
                    const dopo = scad > new Date('2025-07-01');
                    const hasDiritto = String(p.tipoContratto || '').toLowerCase().includes('diritto')
                      && !String(p.tipoContratto || '').toLowerCase().includes('standard');
                    return hasDiritto && dopo;
                  }).length}
                </p>
              </div>
              <FileText className="h-8 w-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Tabella Rosa */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-green-600 to-green-700">
            <h2 className="text-xl font-semibold text-white">Rosa {selectedSquadra}</h2>
          </div>
          <div className="overflow-x-auto relative">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giocatore</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ruolo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo Contratto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valore Mercato 25/26</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ingaggio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scadenza</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.length ? filteredData.map((p, i) => {
                  const scad = isValidDate(p.scadenzaIpotizzata) ? new Date(String(p.scadenzaIpotizzata)) : null;
                  const inScadenza = !!(scad && scad.getDate() === 1 && scad.getMonth() === 6 && scad.getFullYear() === 2025);
                  let rowBg = '';
                  if (p.tipoAcquisto === 'Vivaio') rowBg = 'bg-green-50';
                  else if (p.tipoAcquisto === 'Promosso da vivaio') rowBg = 'bg-blue-100';
                  else if (p.tipoContratto && (String(p.tipoContratto).toLowerCase().includes('obbligo') || String(p.tipoContratto).toLowerCase().includes('diritto'))) rowBg = 'bg-yellow-100';
                  return (
                    <tr key={`${p.id ?? i}-${p.giocatore}`} className={`hover:bg-gray-50 transition-colors ${rowBg}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <span className="text-sm font-medium text-gray-900">{p.giocatore}</span>
                          <div className="text-xs text-gray-500">{p.squadraSerieA !== '#N/A' ? p.squadraSerieA : '-'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {formatRuolo(p.ruolo)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.tipoContratto || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-900">{formatFVM(p.valoreXMercato)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs">
                          <div className="text-gray-700">
                            <span className="font-medium">Competenza:</span>{' '}
                            <span className="text-orange-600 font-semibold">{formatIngaggio(p.ingaggioReale)}</span>
                          </div>
                          <div className="text-gray-600">
                            <span className="font-medium">Giocatore:</span>{' '}
                            <span className="text-gray-800">{formatIngaggio(p.ingaggio36)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${inScadenza ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                          {formatDate(p.scadenzaIpotizzata)}
                        </span>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">Nessun giocatore trovato con i filtri selezionati</td></tr>
                )}

                {filteredData.length > 0 && (
                  <tr className="bg-gray-100 font-bold">
                    <td colSpan={3} className="px-6 py-3 text-right text-sm text-gray-900">TOTALI:</td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className="text-sm font-bold text-green-700">
                        {filteredData.reduce((sum, p) => sum + (Number(p.valoreXMercato) || 0), 0).toFixed(0)}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="text-xs text-orange-700 font-bold">
                        {filteredData.reduce((sum, p) => sum + (Number(p.ingaggioReale) || 0), 0).toFixed(1)}
                      </div>
                    </td>
                    <td className="px-6 py-3"></td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="pointer-events-none absolute right-2 bottom-2 text-xs text-gray-500 bg-white/80 rounded px-2 py-1 shadow-sm md:hidden">Scorri →</div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 cursor-pointer">
            <Upload className="h-4 w-4" />
            <span>Carica un file diverso</span>
            <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
};

export default FantacalcioManager;
