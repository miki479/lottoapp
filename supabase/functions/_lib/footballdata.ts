// football-data.org (v4): the official source for fixtures and final scores of the leagues on its free plan. The free plan allows 10 calls a minute and
// shows scores with a delay, so live scores stay with the scoreboard feed and every call here goes through a small gate.
import type { Fixture } from "../_shared/shared/sport.ts";
import { sameTeam } from "../_shared/shared/live.ts";

export const fdKey = () => (Deno.env.get("FOOTBDATA_KEY") ?? "").trim();
/** Our league names → football-data.org competition codes (the ones on the free plan). */
export const FD_CODES: Record<string, string> = {
  "Serie A": "SA", "Premier League": "PL", "La Liga": "PD", "Bundesliga": "BL1", "Ligue 1": "FL1", "Champions League": "CL", "Eredivisie": "DED", "Primeira Liga": "PPL",
};

const stamps: number[] = [];
async function gate(): Promise<void> {
  for (;;) {
    const t = Date.now();
    while (stamps.length && t - stamps[0]! > 60_000) stamps.shift();
    if (stamps.length < 8) { stamps.push(t); return; }
    await new Promise((r) => setTimeout(r, stamps[0]! + 60_050 - t));
  }
}

async function fd(path: string): Promise<any> { // deno-lint-ignore no-explicit-any
  const key = fdKey();
  if (!key) throw new Error("no_key");
  await gate();
  const r = await fetch(`https://api.football-data.org/v4${path}`, { headers: { "X-Auth-Token": key }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`fd_http_${r.status}`);
  return await r.json();
}

interface FdTeam { name?: string; shortName?: string }
interface FdMatch { id?: number; utcDate?: string; status?: string; homeTeam?: FdTeam; awayTeam?: FdTeam; score?: { duration?: string; fullTime?: { home?: number | null; away?: number | null } } }

/** The club's name as the rest of the app spells it: the known spelling that matches (TheSportsDB's, from the fixtures we already hold), else football-data's short name. */
export function knownName(t: FdTeam | undefined, known: readonly string[]): string {
  const cands = [t?.shortName, t?.name].filter((x): x is string => !!x);
  for (const c of cands) { const k = known.find((n) => sameTeam(n, c)); if (k) return k; }
  return cands[0] ?? "";
}

/** The matches of a competition between two dates that have not been played yet, as fixtures with the id "fd<match id>". */
export async function fdFixtures(league: string, fromIso: string, toIso: string, known: readonly string[]): Promise<Fixture[]> {
  const code = FD_CODES[league];
  if (!code) return [];
  const j = await fd(`/competitions/${code}/matches?dateFrom=${fromIso}&dateTo=${toIso}`);
  const out: Fixture[] = [];
  for (const m of (j?.matches ?? []) as FdMatch[]) {
    const k = Date.parse(String(m.utcDate ?? "")) / 1000, st = String(m.status ?? "");
    if (!m.id || !Number.isFinite(k) || !["SCHEDULED", "TIMED"].includes(st)) continue;
    const home = knownName(m.homeTeam, known), away = knownName(m.awayTeam, known);
    if (home && away) out.push({ eventId: `fd${m.id}`, league, home, away, kickoff: k });
  }
  return out;
}

/** The final score of one finished match: goals after the regular 90 minutes, and "AET" / "PEN" when extra time or penalties decided it (those bets are voided elsewhere). */
export async function fdResult(eventId: string): Promise<{ hg: number; ag: number; status: "FT" | "AET" | "PEN" } | null> {
  if (!/^fd\d+$/.test(eventId)) return null;
  const m = (await fd(`/matches/${eventId.slice(2)}`)) as FdMatch;
  if (m.status !== "FINISHED") return null;
  const hg = m.score?.fullTime?.home, ag = m.score?.fullTime?.away;
  if (typeof hg !== "number" || typeof ag !== "number") return null;
  const d = String(m.score?.duration ?? "REGULAR");
  return { hg, ag, status: d === "PENALTY_SHOOTOUT" ? "PEN" : d === "EXTRA_TIME" ? "AET" : "FT" };
}
