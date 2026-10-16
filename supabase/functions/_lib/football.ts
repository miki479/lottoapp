// Football helpers shared by the Edge Functions: team strengths from played matches, and the match-details source (API-Football).
import { tableFromResults, type LineupPlayer, type PlayerFacts, type TableRow } from "../_shared/shared/sport.ts";
import type { db } from "./common.ts";

type Db = ReturnType<typeof db>;

/** Standing of one league in its current season, built from the matches already played (the free league table lists only five teams). */
export async function loadTable(sb: Db, league: string): Promise<TableRow[]> {
  const { data } = await sb.from("team_form").select("season,home,away,hg,ag").eq("league", league).order("kickoff", { ascending: false }).limit(600);
  const rows = (data ?? []) as { season: string; home: string; away: string; hg: number; ag: number }[];
  if (rows.length === 0) return [];
  const season = rows[0]!.season;
  return tableFromResults(rows.filter((r) => r.season === season));
}

const API = "https://v3.football.api-sports.io";
export const apiKey = () => Deno.env.get("APIFOOTBALL_KEY") ?? "";

export interface ApiReply { ok: boolean; json: { response?: unknown[]; errors?: unknown } | null; remaining: number | null; error?: string }

/** One call to API-Football. `remaining` is what is left of today's free quota (read from the answer's headers). */
export async function apiFootball(path: string): Promise<ApiReply> {
  const key = apiKey();
  if (!key) return { ok: false, json: null, remaining: null, error: "no_key" };
  try {
    const res = await fetch(`${API}${path}`, { headers: { "x-apisports-key": key }, signal: AbortSignal.timeout(20_000) });
    const rem = Number(res.headers.get("x-ratelimit-requests-remaining"));
    const remaining = Number.isFinite(rem) && res.headers.has("x-ratelimit-requests-remaining") ? rem : null;
    if (!res.ok) return { ok: false, json: null, remaining, error: `http_${res.status}` };
    const json = await res.json();
    const errs = json?.errors;
    const hasErr = Array.isArray(errs) ? errs.length > 0 : errs && typeof errs === "object" ? Object.keys(errs).length > 0 : false;
    if (hasErr) return { ok: false, json, remaining, error: JSON.stringify(errs).slice(0, 200) };
    return { ok: true, json, remaining };
  } catch (e) { return { ok: false, json: null, remaining: null, error: String((e as Error).message ?? e).slice(0, 100) }; }
}

/** Are half-time scores, corners and cards available right now? True only if the last check of the source (every few hours) worked. */
export async function detailsAvailable(sb: Db): Promise<boolean> {
  const { data } = await sb.from("feed_health").select("last_ok_at").eq("feed_id", "apifootball").maybeSingle();
  return !!data?.last_ok_at && Date.now() - Date.parse(data.last_ok_at as string) < 8 * 3600_000;
}

interface ApiFixture { fixture?: { status?: { short?: string } }; teams?: { home?: { id?: number }; away?: { id?: number } }; score?: { halftime?: { home?: number | null; away?: number | null } } }
interface ApiStatTeam { team?: { id?: number }; statistics?: { type?: string; value?: number | string | null }[] }

const num = (v: unknown): number | null => { const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN; return Number.isFinite(n) ? n : null; };

export interface Details { status: string; htHome: number | null; htAway: number | null; corners: number | null; cards: number | null; reds: number | null }

/** Half-time score, corners and cards of one finished match (2 calls). Null when the source could not answer. */
export async function fetchDetails(apiId: string): Promise<{ details: Details | null; remaining: number | null; error?: string }> {
  const f = await apiFootball(`/fixtures?id=${encodeURIComponent(apiId)}`);
  if (!f.ok) return { details: null, remaining: f.remaining, error: f.error };
  const fx = (f.json?.response ?? [])[0] as ApiFixture | undefined;
  if (!fx) return { details: null, remaining: f.remaining, error: "empty" };
  const status = String(fx.fixture?.status?.short ?? "");
  const out: Details = { status, htHome: num(fx.score?.halftime?.home), htAway: num(fx.score?.halftime?.away), corners: null, cards: null, reds: null };
  if (!["FT", "AET", "PEN"].includes(status)) return { details: out, remaining: f.remaining };
  if (f.remaining !== null && f.remaining <= 4) return { details: out, remaining: f.remaining };
  const s = await apiFootball(`/fixtures/statistics?fixture=${encodeURIComponent(apiId)}`);
  const teams = (s.json?.response ?? []) as ApiStatTeam[];
  if (s.ok && teams.length === 2) {
    const pick = (t: ApiStatTeam, type: string) => num(t.statistics?.find((x) => x.type === type)?.value);
    const sum = (type: string) => { const a = teams.map((t) => pick(t, type)); return a.every((x) => x === null) ? null : a.reduce<number>((n, x) => n + (x ?? 0), 0); };
    // a team with no red card is reported as null: that is zero, as long as the statistics exist at all
    const corners = sum("Corner Kicks");
    const yellow = sum("Yellow Cards"), red = sum("Red Cards");
    if (corners !== null) out.corners = corners;
    if (yellow !== null || red !== null) { out.cards = (yellow ?? 0) + (red ?? 0); out.reds = red ?? 0; }
    else if (corners !== null) { out.cards = 0; out.reds = 0; }
  }
  return { details: out, remaining: s.remaining ?? f.remaining, error: s.ok ? undefined : s.error };
}

interface ApiLineup { startXI?: { player?: { id?: number; name?: string; pos?: string } }[] }

/** The starting elevens of a match (home first). Empty while the lineups are not published yet. */
export async function fetchLineup(apiId: string): Promise<{ players: LineupPlayer[]; remaining: number | null; error?: string }> {
  const r = await apiFootball(`/fixtures/lineups?fixture=${encodeURIComponent(apiId)}`);
  if (!r.ok) return { players: [], remaining: r.remaining, error: r.error };
  const teams = (r.json?.response ?? []) as ApiLineup[];
  if (teams.length !== 2) return { players: [], remaining: r.remaining };
  const players: LineupPlayer[] = [];
  teams.forEach((t, i) => { for (const x of t.startXI ?? []) { const p = x.player; if (p?.id && p.name && p.pos) players.push({ id: p.id, name: p.name, pos: p.pos, side: i === 0 ? "home" : "away" }); } });
  return { players, remaining: r.remaining };
}

interface ApiEvent { type?: string; detail?: string; player?: { id?: number | null }; assist?: { id?: number | null } }

/** Who scored, who made an assist and who took part in a substitution (a starter in a substitution is the one who went off). Null if the source could not answer. */
export async function fetchPlayerFacts(apiId: string): Promise<{ facts: PlayerFacts | null; remaining: number | null; error?: string }> {
  const r = await apiFootball(`/fixtures/events?fixture=${encodeURIComponent(apiId)}`);
  if (!r.ok) return { facts: null, remaining: r.remaining, error: r.error };
  const ev = (r.json?.response ?? []) as ApiEvent[];
  const facts: PlayerFacts = { goals: [], assists: [], subs: [] };
  for (const e of ev) {
    if (e.type === "Goal" && e.detail !== "Own Goal" && e.detail !== "Missed Penalty") { if (e.player?.id) facts.goals.push(e.player.id); if (e.assist?.id) facts.assists.push(e.assist.id); }
    if (e.type === "subst") { if (e.player?.id) facts.subs.push(e.player.id); if (e.assist?.id) facts.subs.push(e.assist.id); }
  }
  return { facts, remaining: r.remaining };
}

/** The bookmakers' quotes of one match (API-Football): needs one call. Empty when there are none yet. */
export async function fetchBookQuotes(apiId: string): Promise<{ books: import("../_shared/shared/sport.ts").BookQuotes; remaining: number | null; error?: string }> {
  const r = await apiFootball(`/odds?fixture=${encodeURIComponent(apiId)}`);
  if (!r.ok) return { books: [], remaining: r.remaining, error: r.error };
  const books = ((r.json?.response ?? [])[0] as { bookmakers?: import("../_shared/shared/sport.ts").BookQuotes } | undefined)?.bookmakers ?? [];
  return { books, remaining: r.remaining };
}

// ---- European football: the free TheSportsDB tier lists only 3 matches a day, so fixtures are also read from the ESPN scoreboard and strengths from the ESPN standings. ----
import { ESPN_PATH, parseEspn, sameTeam, type LiveGame } from "../_shared/shared/live.ts";
import { alignNames, findRow, FORM_SOURCES, mergeForm, parseEspnTable, UEFA_SLUG } from "../_shared/shared/form.ts";
import type { Fixture, LeagueCfg } from "../_shared/shared/sport.ts";

// ESPN answers 403 to any User-Agent that carries a web address, so this one is a plain product token
const ESPN_UA = { "User-Agent": "LateLotto/0.1 (play-money game)" };

// The free TheSportsDB key answers 429 above 30 calls a minute: every call waits here until fewer than 26 were made in the last 60 seconds.
const tsdbStamps: number[] = [];
export async function tsdbGate(): Promise<void> {
  for (;;) {
    const t = Date.now();
    while (tsdbStamps.length && t - tsdbStamps[0]! > 60_000) tsdbStamps.shift();
    if (tsdbStamps.length < 26) { tsdbStamps.push(t); return; }
    await new Promise((r) => setTimeout(r, tsdbStamps[0]! + 60_050 - t));
  }
}
const tableCache = new Map<string, { at: number; rows: TableRow[] }>();
/** One ESPN standings table (cached for 20 minutes; empty when the source does not answer). */
export async function espnTable(slug: string): Promise<TableRow[]> {
  const hit = tableCache.get(slug);
  if (hit && Date.now() - hit.at < 20 * 60_000) return hit.rows;
  try {
    const r = await fetch(`https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings`, { headers: ESPN_UA, signal: AbortSignal.timeout(8000) });
    const rows = r.ok ? parseEspnTable(await r.json()) : [];
    if (rows.length) tableCache.set(slug, { at: Date.now(), rows });
    return rows.length ? rows : hit?.rows ?? [];
  } catch { return hit?.rows ?? []; }
}

/** Strengths of the clubs of a league's fixtures: a UEFA competition adds the cup games to the club's domestic ones; a domestic league uses its own full table. Empty when the source is down. */
export async function deepTable(league: LeagueCfg, names: string[]): Promise<TableRow[]> {
  if (league.euro) {
    const [cup, ...dom] = await Promise.all([espnTable(UEFA_SLUG[league.name]!), ...FORM_SOURCES.map((s) => espnTable(s.slug))]);
    return mergeForm(names, [{ rows: cup ?? [], tier: 1 }, ...dom.map((rows, i) => ({ rows, tier: FORM_SOURCES[i]!.tier }))]);
  }
  const path = ESPN_PATH[league.name];
  return path ? alignNames(await espnTable(path.replace("soccer/", "")), names) : [];
}

/** Is this club in the Italian top flight (for the "nearby" list: a foreign fixture is local at the Italian club's town)? */
export async function isItalianClub(name: string): Promise<boolean> { return !!findRow(name, await espnTable("ita.1")); }

/**
 * Fixtures of the next 7 days that the day-by-day listing (3 matches a day on the free tier) did not show: the ESPN scoreboard names them, and TheSportsDB
 * gives the real event with its id and crests, found by "Home_vs_Away" in the season (ESPN's spelling first, then TheSportsDB's own spelling of each club,
 * then the next match of either club). Games that already have a market are skipped, and a game that cannot be matched is not tried again for six hours.
 */
// deno-lint-ignore no-explicit-any
export async function discoverFixtures(sb: Db, base: string, league: LeagueCfg, now: number, known: Fixture[], getJson: (u: string) => Promise<any>, maxCalls = 30, deadline = Date.now() + 70_000): Promise<{ fixtures: Fixture[]; seen: number; todo: number; missing: string[]; err: string }> {
  const path = ESPN_PATH[league.name];
  if (!path) return { fixtures: [], seen: 0, todo: 0, missing: [], err: "" };
  const games: LiveGame[] = [];
  let err = "";
  for (let d = 0; d < 7; d++) {
    const day = new Date((now + d * 86400) * 1000).toISOString().slice(0, 10).replaceAll("-", "");
    try { const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${day}`, { headers: ESPN_UA, signal: AbortSignal.timeout(8000) }); if (r.ok) games.push(...parseEspn(await r.json())); else err = `HTTP ${r.status}`; } catch (e) { err = String((e as Error).message ?? e).slice(0, 60); }
  }
  const gameKey = (g: LiveGame) => `fx:${g.home}|${g.away}|${new Date(g.startMs).toISOString().slice(0, 10)}`;
  const { data: rows } = await sb.from("team_ids").select("team,sportsdb_id,sportsdb_name,tried_at");
  const info = new Map<string, { id: string | null; name: string | null }>(), triedAt = new Map<string, number>();
  for (const r of rows ?? []) {
    const team = r.team as string, at = Date.parse(r.tried_at as string);
    if (team.startsWith("fx:")) triedAt.set(team, at);
    else if (r.sportsdb_id || Date.now() - at < 3 * 86400_000) info.set(team, { id: (r.sportsdb_id as string | null) ?? null, name: (r.sportsdb_name as string | null) ?? null });
  }
  const todo = games.filter((g) => g.state === "pre" && g.startMs / 1000 > now + 900 && g.startMs / 1000 < now + 7 * 86400 && !known.some((f) => Math.abs(f.kickoff - g.startMs / 1000) <= 6 * 3600 && sameTeam(f.home, g.home) && sameTeam(f.away, g.away)))
    .sort((a, b) => a.startMs - b.startMs);
  let calls = 0;
  const pause = () => new Promise((r) => setTimeout(r, 150));
  const room = () => calls < maxCalls && Date.now() < deadline;
  const call = async (file: string) => { calls++; await pause(); return await getJson(`${base}/${file}`); };
  const season = (ms: number) => { const d = new Date(ms), y = d.getUTCFullYear(); return d.getUTCMonth() >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`; };
  const fixtureOf = (e: Record<string, string>): Fixture => ({ eventId: e.idEvent!, league: league.name, home: e.strHomeTeam!, away: e.strAwayTeam!, kickoff: Date.parse(`${e.strTimestamp}Z`) / 1000, ...(e.idAPIfootball ? { apiId: e.idAPIfootball } : {}), ...(e.strHomeTeamBadge ? { homeBadge: e.strHomeTeamBadge } : {}), ...(e.strAwayTeamBadge ? { awayBadge: e.strAwayTeamBadge } : {}) });
  const isGame = (e: Record<string, string>, g: LiveGame) => !!e.idEvent && sameTeam(e.strHomeTeam ?? "", g.home) && sameTeam(e.strAwayTeam ?? "", g.away) && Math.abs(Date.parse(`${e.strTimestamp}Z`) - g.startMs) <= 6 * 3600_000;
  /** The upcoming event of the season named "Home vs Away". */
  const byName = async (home: string, away: string, g: LiveGame): Promise<Fixture | null> => {
    const q = `${home}_vs_${away}`.trim().replace(/\s+/g, "_");
    const evs = ((await call(`searchevents.php?e=${encodeURIComponent(q)}&s=${season(g.startMs)}`))?.event ?? []) as Record<string, string>[];
    const e = evs.find((x) => isGame(x, g));
    return e ? fixtureOf(e) : null;
  };
  /** TheSportsDB soccer teams whose name matches the query. */
  const search = async (q: string): Promise<Record<string, string>[]> => {
    const cands = ((await call(`searchteams.php?t=${encodeURIComponent(q)}`))?.teams ?? []) as Record<string, string>[];
    return cands.filter((c) => c.strSport === "Soccer" && !/\b(women|ladies|u\d\d|ii|b)\b/i.test(c.strTeam ?? ""));
  };
  /** The id and TheSportsDB's own spelling of a club (a second try with the most telling word when the full ESPN spelling finds nothing). */
  const team = async (espn: string): Promise<{ id: string | null; name: string | null }> => {
    const hit = info.get(espn);
    if (hit && (hit.name || !hit.id)) return hit;
    if (hit?.id) { // known id, spelling not yet stored
      if (!room()) return hit;
      const t = ((await call(`lookupteam.php?id=${hit.id}`))?.teams ?? [])[0] as Record<string, string> | undefined;
      const v = { id: hit.id, name: t?.strTeam ?? null };
      info.set(espn, v); await sb.from("team_ids").upsert({ team: espn, sportsdb_id: v.id, sportsdb_name: v.name, tried_at: new Date().toISOString() });
      return v;
    }
    if (!room()) return { id: null, name: null };
    const mk = (c: Record<string, string>[]) => findRow(espn, c.map((x) => ({ team: x.strTeam!, played: 0, points: 0, goalsFor: 0, goalsAgainst: 0 })));
    let soccer = await search(espn), row = mk(soccer);
    if (!row && !soccer.length && room()) {
      const word = espn.normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^A-Za-z0-9]+/).filter((w) => w.length >= 4 && !/^(real|club|city|united|sporting|fk|sk|fc)$/i.test(w)).sort((a, b) => b.length - a.length)[0];
      if (word && word.toLowerCase() !== espn.toLowerCase()) { soccer = await search(word); row = mk(soccer); }
    }
    const v = { id: row ? soccer.find((c) => c.strTeam === row.team)?.idTeam ?? null : null, name: row?.team ?? null };
    info.set(espn, v);
    await sb.from("team_ids").upsert({ team: espn, sportsdb_id: v.id, sportsdb_name: v.name, tried_at: new Date().toISOString() });
    return v;
  };
  const out: Fixture[] = [], missing: string[] = [];
  for (const g of todo) {
    if (Date.now() - (triedAt.get(gameKey(g)) ?? 0) < 6 * 3600_000) { missing.push(`${g.home}-${g.away}`); continue; }
    if (!room()) { missing.push(`${g.home}-${g.away}`); continue; }
    let found: Fixture | null = null, gaveUp = false;
    try {
      found = await byName(g.home, g.away, g);
      if (!found && room()) {
        const h = await team(g.home), a = await team(g.away), hn = h.name ?? g.home, an = a.name ?? g.away;
        if ((hn !== g.home || an !== g.away) && room()) found = await byName(hn, an, g);
        for (const t of [h, a]) { // the next match of either club
          if (found || !t.id || !room()) continue;
          const e = ((await call(`eventsnext.php?id=${t.id}`))?.events ?? [] as Record<string, string>[]).find((x: Record<string, string>) => isGame(x, g));
          if (e) found = fixtureOf(e);
        }
        gaveUp = !found && room();
      }
    } catch { /* a call failed: the next run tries again */ }
    if (found && !out.some((f) => f.eventId === found!.eventId)) out.push(found);
    else if (!found) { missing.push(`${g.home}-${g.away}`); if (gaveUp) await sb.from("team_ids").upsert({ team: gameKey(g), sportsdb_id: null, tried_at: new Date().toISOString() }); }
  }
  return { fixtures: out, seen: games.length, todo: todo.length, missing, err };
}
