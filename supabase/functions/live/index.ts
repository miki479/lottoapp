// Every minute: for the matches that are on now (or about to start) and have bets, read the live score from ESPN's public scoreboards and keep it in live_scores.
// One call per league and day, only for leagues that have such a match.
import { db, requireCron, safe } from "../_lib/common.ts";
import { ESPN_PATH, matchGame, parseEspn, type LiveGame } from "../_shared/shared/live.ts";

const UA = { "User-Agent": "LateLotto/0.1 (play-money game; https://latelotto.web.app)" };
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");

Deno.serve(safe(async (req) => {
  const denied = requireCron(req);
  if (denied) return denied;
  const sb = db(), now = Date.now();
  const { data } = await sb.from("markets").select("params").eq("kind", "match_bet").eq("status", "open").gte("params->>kickoff", String(Math.floor(now / 1000) - 5 * 3600)).lte("params->>kickoff", String(Math.floor(now / 1000) + 900)).limit(500);
  const fixtures = new Map<string, { eventId: string; league: string; home: string; away: string; kickoff: number }>();
  for (const m of data ?? []) {
    const p = m.params as { eventId?: string; league?: string; home?: string; away?: string; kickoff?: number };
    if (p.eventId && p.league && p.home && p.away && p.kickoff && ESPN_PATH[p.league]) fixtures.set(p.eventId, { eventId: p.eventId, league: p.league, home: p.home, away: p.away, kickoff: Number(p.kickoff) });
  }
  const byLeague = new Map<string, typeof fixtures extends Map<string, infer V> ? V[] : never>();
  for (const f of fixtures.values()) byLeague.set(f.league, [...(byLeague.get(f.league) ?? []), f]);
  const rows: Record<string, unknown>[] = [], notes: string[] = [];
  for (const [league, list] of byLeague) {
    const days = [...new Set(list.flatMap((f) => [ymd(f.kickoff * 1000), ymd(f.kickoff * 1000 + 3 * 3600_000)]))].slice(0, 3);
    const games: LiveGame[] = [];
    for (const d of days) {
      try {
        const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH[league]}/scoreboard?dates=${d}`, { headers: UA, signal: AbortSignal.timeout(8000) });
        if (r.ok) games.push(...parseEspn(await r.json()));
      } catch (e) { notes.push(`${league}: ${String((e as Error).message).slice(0, 60)}`); }
    }
    for (const f of list) {
      const g = matchGame(games, f);
      if (g && g.state !== "pre") rows.push({ event_id: f.eventId, league, home_score: g.hs, away_score: g.as, state: g.state, period: g.period, clock: g.clock, updated_at: new Date().toISOString() });
    }
  }
  if (rows.length) await sb.from("live_scores").upsert(rows, { onConflict: "event_id" });
  return Response.json({ fixtures: fixtures.size, updated: rows.length, notes });
}));
