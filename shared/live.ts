// Live scores for the matches people have bet on, from the ESPN public scoreboards (unofficial, personal non-commercial use: see the note in docs). Pure parsing and matching.
/** Our league names → the ESPN scoreboard path. Leagues without an entry simply have no live score. */
export const ESPN_PATH: Record<string, string> = {
  "Serie A": "soccer/ita.1", "Serie B": "soccer/ita.2", "Premier League": "soccer/eng.1", "La Liga": "soccer/esp.1", "Bundesliga": "soccer/ger.1", "Ligue 1": "soccer/fra.1",
  "Champions League": "soccer/uefa.champions", "Europa League": "soccer/uefa.europa", "NBA": "basketball/nba", "NHL": "hockey/nhl", "NFL": "football/nfl", "MLB": "baseball/mlb",
};

export interface LiveGame { home: string; away: string; hs: number; as: number; state: "pre" | "in" | "post"; period: number | null; clock: string; startMs: number }

const STOP = new Set(["fc", "cf", "ac", "as", "sc", "us", "ssc", "afc", "calcio", "club", "the", "de", "la", "le", "1", "2", "ud", "cd", "sd", "rc", "ca"]);
const tokens = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((t) => t && !STOP.has(t));
/** True when two spellings of a team probably name the same side ("AS Roma" / "Roma", "Inter" / "Inter Milan", "Hellas Verona" / "Verona"). */
export function sameTeam(a: string, b: string): boolean {
  const x = tokens(a), y = tokens(b);
  if (!x.length || !y.length) return false;
  const sx = x.join(" "), sy = y.join(" ");
  if (sx === sy || sx.includes(sy) || sy.includes(sx)) return true;
  const common = x.filter((t) => y.includes(t)).length;
  return common / Math.min(x.length, y.length) >= 0.5 && common >= 1;
}

type Espn = { events?: { date?: string; status?: { type?: { state?: string }; period?: number; displayClock?: string }; competitions?: { competitors?: { homeAway?: string; score?: string; team?: { displayName?: string; shortDisplayName?: string; name?: string } }[] }[] }[] };
export function parseEspn(j: unknown): LiveGame[] {
  const out: LiveGame[] = [];
  for (const e of (j as Espn)?.events ?? []) {
    const c = e.competitions?.[0]?.competitors ?? [], h = c.find((x) => x.homeAway === "home"), a = c.find((x) => x.homeAway === "away");
    const state = e.status?.type?.state;
    if (!h || !a || (state !== "pre" && state !== "in" && state !== "post")) continue;
    out.push({
      home: h.team?.displayName ?? h.team?.name ?? "", away: a.team?.displayName ?? a.team?.name ?? "", hs: Number(h.score) || 0, as: Number(a.score) || 0, state,
      period: Number.isFinite(e.status?.period) ? (e.status!.period as number) : null, clock: String(e.status?.displayClock ?? ""), startMs: Date.parse(e.date ?? ""),
    });
  }
  return out.filter((g) => g.home && g.away && Number.isFinite(g.startMs));
}

/** The game that is our fixture: both teams match and it starts within 6 hours of the kick-off we know. */
export function matchGame(games: readonly LiveGame[], f: { home: string; away: string; kickoff: number }): LiveGame | null {
  return games.find((g) => Math.abs(g.startMs / 1000 - f.kickoff) <= 6 * 3600 && sameTeam(g.home, f.home) && sameTeam(g.away, f.away)) ?? null;
}
