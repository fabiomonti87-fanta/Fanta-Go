// src/app/api/player-stats/route.ts
import { NextRequest } from 'next/server';

export const revalidate = 0; // always fresh
export const dynamic = 'force-dynamic';

type FDTeam = {
  id: number;
  name: string;
  tla?: string;
  squad?: Array<{ id: number; name: string; position?: string; nationality?: string; dateOfBirth?: string }>;
};

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

function norm(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9 ]/gi, '')
    .toLowerCase()
    .trim();
}

async function fdFetch<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'X-Auth-Token': token },
    // Avoid caching in edge
    cache: 'no-store',
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`FD ${res.status} on ${url}: ${txt}`);
  }
  return res.json() as Promise<T>;
}

export async function GET(req: NextRequest) {
  try {
    const token = mustEnv('FOOTBALL_DATA_TOKEN');
    const { searchParams } = new URL(req.url);
    const playerName = searchParams.get('name') || '';
    const teamTLA = (searchParams.get('tla') || '').toUpperCase();

    if (!playerName || !teamTLA) {
      return new Response(JSON.stringify({ error: 'Missing name or tla' }), { status: 400 });
    }

    // 1) Trova il teamId della Serie A dal TLA
    // /v4/competitions/SA/teams?season=2024  (stagione 24/25)
    const comp = await fdFetch<{ teams: FDTeam[] }>(
      'https://api.football-data.org/v4/competitions/SA/teams?season=2024',
      token
    );
    const team = comp.teams.find(t => (t.tla || '').toUpperCase() === teamTLA);
    if (!team) {
      return new Response(JSON.stringify({ error: `Team with TLA ${teamTLA} not found in Serie A 24/25` }), { status: 404 });
    }

    // 2) Prendi la rosa per avere gli id persona
    // /v4/teams/{id}
    const teamFull = await fdFetch<FDTeam>(`https://api.football-data.org/v4/teams/${team.id}`, token); // :contentReference[oaicite:0]{index=0}
    const targetNorm = norm(playerName);

    // Tenta match esatto e poi contains
    const squad = teamFull.squad || [];
    let person = squad.find(p => norm(p.name) === targetNorm);
    if (!person) {
      person = squad.find(p => norm(p.name).includes(targetNorm) || targetNorm.includes(norm(p.name || '')));
    }

    if (!person) {
      return new Response(JSON.stringify({ error: `Player "${playerName}" not found in ${team.name}` }), { status: 404 });
    }

    // 3) Statistiche 2024/25 per persona: /v4/persons/{id}/matches?competitions=SA&dateFrom=2024-07-01&dateTo=2025-06-30
    const dateFrom = '2024-07-01';
    const dateTo = '2025-06-30';
    type PersonMatches = {
      aggregations?: {
        matchesOnPitch?: number;
        startingXI?: number;
        minutesPlayed?: number;
        goals?: number;
        assists?: number;
        yellowCards?: number;
        yellowRedCards?: number;
        redCards?: number;
        subbedOut?: number;
        subbedIn?: number;
      };
      matches?: Array<{
        utcDate: string;
        competition: { code: string; name: string };
        homeTeam: { name: string };
        awayTeam: { name: string };
        score: { fullTime: { home: number | null; away: number | null } };
      }>;
      person?: { id: number; name: string; position?: string };
      resultSet?: { first?: string; last?: string; count?: number };
    };

    const stats = await fdFetch<PersonMatches>(
      `https://api.football-data.org/v4/persons/${person.id}/matches?competitions=SA&dateFrom=${dateFrom}&dateTo=${dateTo}&limit=50`,
      token
    ); // Aggregations & filters: :contentReference[oaicite:1]{index=1}

    return new Response(
      JSON.stringify({
        team: { id: team.id, name: team.name, tla: team.tla },
        player: { id: person.id, name: person.name },
        season: '2024/25',
        range: { dateFrom, dateTo },
        aggregations: stats.aggregations || {},
        recentMatches: (stats.matches || []).slice(0, 10),
      }),
      { headers: { 'content-type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), { status: 500 });
  }
}
