import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status   = searchParams.get('status')   ?? 'SCHEDULED';
  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo   = searchParams.get('dateTo')   ?? '';
  const url = new URL('https://api.football-data.org/v4/competitions/SA/matches');
  if (status)   url.searchParams.set('status', status);
  if (dateFrom) url.searchParams.set('dateFrom', dateFrom);
  if (dateTo)   url.searchParams.set('dateTo', dateTo);

  const resp = await fetch(url.toString(), {
    headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_TOKEN ?? '' },
    next: { revalidate: 60 } // caching 60s lato server
  });

  if (!resp.ok) {
    // inoltra il codice d'errore dell'upstream (utile per debug: 401/403/429…)
    return NextResponse.json({ error: 'Upstream error' }, { status: resp.status });
  }
  const data = await resp.json();
  return NextResponse.json(data);
}
