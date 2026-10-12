import { computeOdds } from "./odds.ts";

/** Football (soccer): one market = one bet on one match, settled from the final score. */
export type MatchBet = "home_win" | "over_2_5" | "btts";

export interface Fixture { eventId: string; league: string; home: string; away: string; kickoff: number }
export interface TableRow { team: string; played: number; points: number; goalsFor: number; goalsAgainst: number }

export interface MatchMarketInsert {
  city_id: "world"; category: "sport"; kind: "match_bet"; feed_id: "sportsdb";
  params: { league: string; eventId: string; home: string; away: string; bet: MatchBet; kickoff: number; testOnly?: boolean };
  closes_at: string; target_at: string; deadline_at: string; odds_yes: number; odds_no: number; dedupe_key: string;
}

/** Full time is about 105 minutes after kick-off; the score is read after that. */
export const MATCH_LENGTH_SEC = 110 * 60;

const poissonCdf = (k: number, lambda: number) => { let term = Math.exp(-lambda), sum = term; for (let i = 1; i <= k; i++) { term *= lambda / i; sum += term; } return sum; };
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Prior chances from the league table: points per game for the winner, goals per game for the totals. A plain estimate, not a model. */
export function matchPriors(home?: TableRow, away?: TableRow): Record<MatchBet, number> {
  const ppg = (r?: TableRow) => (r && r.played > 0 ? r.points / r.played : 1.4);
  const gpg = (r?: TableRow) => (r && r.played > 0 ? (r.goalsFor + r.goalsAgainst) / r.played : 2.6);
  const total = (gpg(home) + gpg(away)) / 2;
  return {
    home_win: clamp(0.42 + 0.14 * (ppg(home) - ppg(away)), 0.12, 0.8),
    over_2_5: clamp(1 - poissonCdf(2, total), 0.2, 0.8),
    btts: clamp(0.34 + 0.1 * total, 0.3, 0.7),
  };
}

export function buildMatchMarkets(fixtures: Fixture[], table: TableRow[], now: number, testOnly: boolean): MatchMarketInsert[] {
  const by = new Map(table.map((r) => [r.team, r]));
  const out: MatchMarketInsert[] = [];
  for (const f of fixtures) {
    if (f.kickoff - 600 <= now + 300 || f.kickoff > now + 7 * 86400) continue;
    const pri = matchPriors(by.get(f.home), by.get(f.away));
    for (const bet of ["home_win", "over_2_5", "btts"] as MatchBet[]) {
      const odds = computeOdds(pri[bet]);
      out.push({
        city_id: "world", category: "sport", kind: "match_bet", feed_id: "sportsdb",
        params: { league: f.league, eventId: f.eventId, home: f.home, away: f.away, bet, kickoff: f.kickoff, ...(testOnly ? { testOnly: true } : {}) },
        closes_at: new Date((f.kickoff - 300) * 1000).toISOString(), target_at: new Date((f.kickoff + MATCH_LENGTH_SEC) * 1000).toISOString(), deadline_at: new Date((f.kickoff + 12 * 3600) * 1000).toISOString(),
        odds_yes: odds.yes, odds_no: odds.no, dedupe_key: `sport|${f.eventId}|${bet}`,
      });
    }
  }
  return out;
}

export interface MatchObservation { eventId: string; homeGoals: number | null; awayGoals: number | null; status: string; fetchedAt: number }
export const FINISHED = new Set(["FT", "AET", "PEN", "Match Finished"]);
