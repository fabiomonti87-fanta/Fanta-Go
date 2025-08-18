// src/lib/fast/players.ts
import * as XLSX from 'xlsx';
import { Player, ClassicRole } from '@/lib/fast/game';

function norm(s: unknown) {
  return String(s ?? '').trim();
}
function toNum(v: unknown): number {
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function normalizeRole(raw: string): ClassicRole | null {
  const t = raw.trim().toUpperCase();
  if (t === 'P' || t === 'POR' || t === 'GK') return 'P';
  if (t === 'D' || t === 'DEF') return 'D';
  if (t === 'C' || t === 'MID' || t === 'M') return 'C';
  if (t === 'A' || t === 'ATT' || t === 'FWD') return 'A';
  return null;
}

function findHeaderIndexes(header: any[]) {
  // normalizza header
  const cols = header.map((h) => norm(h).toLowerCase());

  const idxName =
    cols.findIndex((c) => /nome|giocatore|calciatore/.test(c)) ?? -1;
  const idxTeam =
    cols.findIndex((c) => /squadra|team|club/.test(c)) ?? -1;
  const idxRole =
    cols.findIndex((c) => /(^r$)|ruolo/.test(c)) ?? -1;

  // FVM: prova per header, fallback a colonna L (index 11)
  let idxFvm = cols.findIndex((c) => /fvm|quotazione\s*fvm|qt\.?\s*fvm|prezzo\s*fvm/.test(c));
  if (idxFvm < 0 && cols.length > 11) idxFvm = 11; // colonna L

  return { idxName, idxTeam, idxRole, idxFvm };
}

export function parsePlayersFromXLSX(buf: ArrayBuffer): Player[] {
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet =
    wb.Sheets['Quotazioni'] ||
    wb.Sheets['Listone'] ||
    wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

  if (!rows.length) return [];

  // trova prima riga valida come header (deve contenere almeno name + role)
  let headerRow = rows[0];
  let start = 1;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const h = rows[i];
    const { idxName, idxRole } = findHeaderIndexes(h);
    if (idxName >= 0 && idxRole >= 0) {
      headerRow = h;
      start = i + 1;
      break;
    }
  }

  const { idxName, idxTeam, idxRole, idxFvm } = findHeaderIndexes(headerRow);
  if (idxName < 0 || idxRole < 0 || idxFvm < 0) return [];

  const out: Player[] = [];
  for (let r = start; r < rows.length; r++) {
    const row = rows[r] || [];
    const name = norm(row[idxName]);
    const team = norm(row[idxTeam] ?? '');
    const roleRaw = norm(row[idxRole]);
    const price = toNum(row[idxFvm]);

    if (!name || !roleRaw || !price) continue;
    const role = normalizeRole(roleRaw);
    if (!role) continue;

    out.push({
      id: `${name}|${team}|${role}`,
      name,
      team,
      role,
      price,
    });
  }

  // ordina per ruolo, poi per prezzo asc
  out.sort((a, b) => a.role.localeCompare(b.role) || a.price - b.price);
  return out;
}
