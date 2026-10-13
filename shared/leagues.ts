/**
 * Monthly leagues. Five leagues named after the avatar-decoration metals. At the end of each month, among the players who
 * bet at least once, the top 10 of a league (by credits) and anyone with 1,000,000+ credits move up one league. Everyone's
 * balance restarts from a base that grows a little with the league. A month without a single bet moves a player down one league
 * (bronze stays bronze; the credits are kept, lifted to the new league's base if lower). Fake credits only.
 * public.close_league_season() (latest: supabase/migrations/0111_league_demotion.sql, then 0113) mirrors these rules.
 */
export const LEAGUES = ["bronze", "silver", "gold", "platinum", "diamond"] as const;
export type LeagueId = (typeof LEAGUES)[number];
export const MAX_LEAGUE = LEAGUES.length - 1;
export const PROMOTE_TOP = 10;
/** The promotion line is the top quarter of the ranked players of a league, at most PROMOTE_TOP: fewer than 4 players promote nobody by rank. */
export const promoteSlots = (ranked: number): number => Math.min(PROMOTE_TOP, Math.floor(Math.max(0, ranked) / 4));
export const PROMOTE_CREDITS = 1_000_000;
export const BASE_CREDITS = 1000;
export const LEAGUE_BONUS = 150;
/** The ring unlocked on reaching each league (none for the first). Same ids as DECORATIONS in looks.ts. */
export const LEAGUE_RING: (string | null)[] = [null, "silver", "gold", "platinum", "diamond"];

export const clampLeague = (n: number): number => (Number.isFinite(n) ? Math.min(MAX_LEAGUE, Math.max(0, Math.trunc(n))) : 0);
/** Balance after the monthly reset for a player who ends up in this league. */
export const resetBalance = (leagueAfter: number): number => BASE_CREDITS + LEAGUE_BONUS * clampLeague(leagueAfter);

export interface SeasonPlayer { id: string; league: number; credits: number; played: boolean }
export interface SeasonResult { id: string; leagueBefore: number; leagueAfter: number; credits: number; rank: number | null; newCredits: number }

/** Rank = 1 + number of players in the same league with more credits (ties share a rank, like SQL rank()). Ties at the 10th place all move up. */
export function closeSeason(players: SeasonPlayer[]): SeasonResult[] {
  const out: SeasonResult[] = [];
  for (const p of players) {
    const before = clampLeague(p.league);
    if (!p.played) {
      // inactive players drop one league (bronze stays) and keep their credits
      // a month without a single bet moves you down one league (bronze stays bronze); the credits are kept, lifted to the new league's base if lower
      const after = Math.max(0, before - 1);
      out.push({ id: p.id, leagueBefore: before, leagueAfter: after, credits: p.credits, rank: null, newCredits: Math.max(p.credits, resetBalance(after)) });
      continue;
    }
    const rank = 1 + players.filter((o) => o.played && clampLeague(o.league) === before && o.credits > p.credits).length;
    const ranked = players.filter((o) => o.played && clampLeague(o.league) === before).length;
    const up = before < MAX_LEAGUE && (rank <= promoteSlots(ranked) || p.credits >= PROMOTE_CREDITS);
    const after = up ? before + 1 : before;
    out.push({ id: p.id, leagueBefore: before, leagueAfter: after, credits: p.credits, rank, newCredits: resetBalance(after) });
  }
  return out;
}

/** Credits still needed to reach the promotion line: the 10th place credits if there are 10 or more players (reaching them is enough, ties share the place), otherwise the 1,000,000 line. Null when already at the top league. */
export function promotionGap(league: number, credits: number, tenth: number | null): number | null {
  if (clampLeague(league) >= MAX_LEAGUE) return null;
  const line = Math.min(tenth ?? PROMOTE_CREDITS, PROMOTE_CREDITS);
  return Math.max(0, line - credits);
}

/** Whole days until the next month starts (UTC), at least 1 as the season counter in the app does. */
export function leagueDaysLeft(now = new Date()): number {
  return Math.max(1, Math.ceil((Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - now.getTime()) / 86400000));
}
