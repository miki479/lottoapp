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
