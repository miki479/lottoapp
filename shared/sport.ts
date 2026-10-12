import { computeOdds } from "./odds.ts";

/** Football (soccer): one market = one bet on one match, settled from the final score. One match, many "reasons". */
export type MatchBet = "home_win" | "draw" | "away_win" | "over_1_5" | "over_2_5" | "over_3_5" | "btts" | "home_clean" | "away_clean";
export const MATCH_BETS: MatchBet[] = ["home_win", "draw", "away_win", "over_1_5", "over_2_5", "over_3_5", "btts", "home_clean", "away_clean"];
/** The ones every fixture gets automatically; the rest are created on request, never twice. */
export const AUTO_BETS: MatchBet[] = ["home_win", "over_2_5", "btts"];
export const AUTO_BETS_LOWER: MatchBet[] = ["home_win", "over_2_5"];

export const LEAGUES: { id: string; name: string; top: boolean }[] = [
  { id: "4332", name: "Serie A", top: true }, { id: "4394", name: "Serie B", top: false },
  { id: "5340", name: "Serie C - A", top: false }, { id: "5339", name: "Serie C - B", top: false }, { id: "5341", name: "Serie C - C", top: false },
];

export interface Fixture { eventId: string; league: string; home: string; away: string; kickoff: number }
export interface TableRow { team: string; played: number; points: number; goalsFor: number; goalsAgainst: number }
export interface Geo { lat: number; lon: number }

export interface MatchMarketInsert {
  city_id: "world"; category: "sport"; kind: "match_bet"; feed_id: "sportsdb"; lat?: number; lon?: number;
  params: { league: string; eventId: string; home: string; away: string; bet: MatchBet; kickoff: number; priors: Record<MatchBet, number>; local?: "true"; testOnly?: boolean };
  closes_at: string; target_at: string; deadline_at: string; odds_yes: number; odds_no: number; dedupe_key: string;
}

/** Full time is about 105 minutes after kick-off; the score is read after that. */
export const MATCH_LENGTH_SEC = 110 * 60;

/** Town where a club plays when its name is not the town's name (for the "nearby" lists). */
export const CLUB_TOWN: Record<string, string> = {
  "Inter Milan": "Milano", "AC Milan": "Milano", "Juventus": "Torino", "Lazio": "Roma", "Atalanta": "Bergamo", "Fiorentina": "Firenze", "Hellas Verona": "Verona", "Genoa": "Genova", "Sampdoria": "Genova",
  "Juventus Next Gen": "Torino", "Spezia": "La Spezia", "Reggiana": "Reggio Emilia", "Virtus Entella": "Chiavari", "Carrarese": "Carrara", "Mantova": "Mantova", "Sudtirol": "Bolzano", "SudTirol": "Bolzano",
};

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const factorial = (n: number) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
const pois = (k: number, l: number) => Math.exp(-l) * Math.pow(l, k) / factorial(k);

/** Scoring rates from the league table (goals for/against per game, a little home advantage); a plain estimate, not a forecast model. */
function rates(home?: TableRow, away?: TableRow): [number, number] {
  const gf = (r?: TableRow) => (r && r.played > 0 ? r.goalsFor / r.played : 1.3), ga = (r?: TableRow) => (r && r.played > 0 ? r.goalsAgainst / r.played : 1.3);
  return [clamp(((gf(home) + ga(away)) / 2) * 1.08, 0.4, 3.2), clamp(((gf(away) + ga(home)) / 2) * 0.94, 0.3, 3)];
}

/** Chance of every bet from independent Poisson goals. */
export function matchPriors(home?: TableRow, away?: TableRow): Record<MatchBet, number> {
  const [lh, la] = rates(home, away);
  const p = { home_win: 0, draw: 0, away_win: 0, over_1_5: 0, over_2_5: 0, over_3_5: 0, btts: 0, home_clean: 0, away_clean: 0 } as Record<MatchBet, number>;
  for (let h = 0; h <= 10; h++) for (let a = 0; a <= 10; a++) {
    const w = pois(h, lh) * pois(a, la);
    if (h > a) p.home_win += w; else if (h === a) p.draw += w; else p.away_win += w;
    if (h + a >= 2) p.over_1_5 += w; if (h + a >= 3) p.over_2_5 += w; if (h + a >= 4) p.over_3_5 += w;
    if (h > 0 && a > 0) p.btts += w; if (a === 0) p.home_clean += w; if (h === 0) p.away_clean += w;
  }
  for (const k of MATCH_BETS) p[k] = Math.round(clamp(p[k], 0.04, 0.96) * 1000) / 1000;
  return p;
}

export const evalBet = (bet: MatchBet, h: number, a: number): boolean =>
  bet === "home_win" ? h > a : bet === "draw" ? h === a : bet === "away_win" ? a > h : bet === "over_1_5" ? h + a >= 2 : bet === "over_2_5" ? h + a >= 3 : bet === "over_3_5" ? h + a >= 4
  : bet === "btts" ? h > 0 && a > 0 : bet === "home_clean" ? a === 0 : h === 0;

export function matchMarket(f: Fixture, bet: MatchBet, priors: Record<MatchBet, number>, geo: Geo | undefined, testOnly: boolean, custom?: { by: string | null }): MatchMarketInsert {
  const odds = computeOdds(clamp(priors[bet], 0.1, 0.9));
  return {
    city_id: "world", category: "sport", kind: "match_bet", feed_id: "sportsdb", ...(geo ? { lat: geo.lat, lon: geo.lon } : {}),
    params: { league: f.league, eventId: f.eventId, home: f.home, away: f.away, bet, kickoff: f.kickoff, priors, ...(geo ? { local: "true" as const } : {}), ...(testOnly ? { testOnly: true } : {}), ...(custom ? { custom: "true", by: custom.by } : {}) } as MatchMarketInsert["params"],
    closes_at: new Date((f.kickoff - 300) * 1000).toISOString(), target_at: new Date((f.kickoff + MATCH_LENGTH_SEC) * 1000).toISOString(), deadline_at: new Date((f.kickoff + 12 * 3600) * 1000).toISOString(),
    odds_yes: odds.yes, odds_no: odds.no, dedupe_key: `sport|${f.eventId}|${bet}`,
  };
}

export function buildMatchMarkets(fixtures: Fixture[], table: TableRow[], now: number, testOnly: boolean, geo: Map<string, Geo>, top: boolean): MatchMarketInsert[] {
  const by = new Map(table.map((r) => [r.team, r]));
  const out: MatchMarketInsert[] = [];
  for (const f of fixtures) {
    if (f.kickoff - 600 <= now + 300 || f.kickoff > now + 7 * 86400) continue;
    const pri = matchPriors(by.get(f.home), by.get(f.away));
    for (const bet of top ? AUTO_BETS : AUTO_BETS_LOWER) out.push(matchMarket(f, bet, pri, geo.get(f.home), testOnly));
  }
  return out;
}

export interface MatchObservation { eventId: string; homeGoals: number | null; awayGoals: number | null; status: string; fetchedAt: number }
export const FINISHED = new Set(["FT", "AET", "PEN", "Match Finished"]);
