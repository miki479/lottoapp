/**
 * The figures at the top of "My bets" and its tab badge, pure. The daily results come from the server (my_balance_series), the rest is arithmetic on them.
 */

/** One day of results: what was won or lost that day in credits, and how many bets were settled. */
export interface DayNet { day: string; net: number; bets: number }

export interface BetSummary {
  /** The worst day of the window: only a day that lost; null when none did. */
  worstDay: { day: string; net: number } | null;
  /** How far the running result is under its highest point (0 when it is at the top). */
  drawdown: number;
  /** The days counted, with something settled. */
  days: number;
}

/** The worst day and the fall from the peak of the running result over the days given (oldest first). */
export function summarize(series: readonly DayNet[]): BetSummary {
  let run = 0, peak = 0, worst: DayNet | null = null;
  for (const d of series) {
    run += d.net; peak = Math.max(peak, run);
    if (d.net < 0 && (!worst || d.net < worst.net)) worst = d;
  }
  return { worstDay: worst ? { day: worst.day, net: worst.net } : null, drawdown: Math.max(0, peak - run), days: series.filter((d) => d.bets > 0 || d.net !== 0).length };
}

interface Timed { status: string; markets: { target_at?: string } }
interface TimedParlay { status: string; parlay_legs: { markets: { target_at?: string } }[] }
const dayOf = (ms: number, tz?: string) => new Intl.DateTimeFormat("en-CA", tz ? { timeZone: tz } : undefined).format(new Date(ms));

/** The open bets (and multiples) that are settled today, or are already past their time and only wait for the result: the number on the tab. */
export function resolvingToday(bets: readonly Timed[], parlays: readonly TimedParlay[], nowMs: number, tz?: string): number {
  const today = dayOf(nowMs, tz), due = (iso?: string) => { const t = Date.parse(iso ?? ""); return Number.isFinite(t) && dayOf(t, tz) <= today; };
  const singles = bets.filter((b) => b.status === "open" && due(b.markets.target_at)).length;
  // a multiple is settled when its last leg is
  const multiples = parlays.filter((x) => x.status === "open" && x.parlay_legs.length > 0 && due(x.parlay_legs.map((l) => l.markets.target_at ?? "").sort().pop())).length;
  return singles + multiples;
}
