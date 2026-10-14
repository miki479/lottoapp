import type { MarketRow } from "./format.ts";
import type { LiveDelay } from "./types.ts";

/**
 * The rows of the train board: the Italian trains that are running (one row per trip), the ones with a live reading first, then the next departures so the
 * board is never empty. Built only from what the app already knows (open questions and their live delays); nothing here is estimated.
 */
export interface BoardRow {
  m: MarketRow;
  /** Seconds late right now; 0 for a row without a reading. */
  delay: number;
  /** Change since the previous reading (seconds); 0 when there is none. */
  trend: number;
  /** True when a real reading (not a forecast) stands behind the row. */
  live: boolean;
  /** When that reading was taken (ms), 0 for a row without one. */
  at: number;
}

/** More than this many seconds late counts as "late" on the board. */
export const LATE_SEC = 300;

export function boardRows(markets: readonly MarketRow[], live: Record<string, LiveDelay>, nowMs: number, minRows: number): BoardRow[] {
  const seen = new Set<string>();
  const out: BoardRow[] = [], spare: BoardRow[] = [];
  for (const m of markets) {
    if (m.category !== "train" || m.kind !== "train_delay_gt" || m.params.ladderOf || m.city_id !== "italia" || Date.parse(m.closes_at) <= nowMs) continue;
    const key = String(m.params.tripId ?? m.id);
    if (seen.has(key)) continue;
    const l = live[m.id];
    if (l && !l.is_forecast) { seen.add(key); out.push({ m, delay: l.delay_sec, trend: l.prev_delay_sec === null ? 0 : l.delay_sec - l.prev_delay_sec, live: true, at: Date.parse(l.observed_at) || 0 }); }
    else spare.push({ m, delay: 0, trend: 0, live: false, at: 0 });
  }
  for (const r of spare.sort((a, b) => Date.parse(a.m.target_at) - Date.parse(b.m.target_at))) {
    if (out.length >= minRows) break;
    const key = String(r.m.params.tripId ?? r.m.id);
    if (seen.has(key)) continue;
    seen.add(key); out.push(r);
  }
  return out;
}

export interface BoardStats {
  /** Trains with a real reading. */
  live: number;
  /** Share of those that are more than five minutes late (0..1), null without readings. */
  lateShare: number | null;
  /** Mean delay of those, whole minutes (never below 0), null without readings. */
  avgMin: number | null;
  /** The most recent reading (ms), null without readings: the "updated at" of the board. */
  updatedAt: number | null;
}

export function boardStats(rows: readonly BoardRow[]): BoardStats {
  const l = rows.filter((r) => r.live);
  if (!l.length) return { live: 0, lateShare: null, avgMin: null, updatedAt: null };
  return {
    live: l.length,
    lateShare: l.filter((r) => r.delay > LATE_SEC).length / l.length,
    avgMin: Math.max(0, Math.round(l.reduce((a, r) => a + Math.max(0, r.delay), 0) / l.length / 60)),
    updatedAt: Math.max(...l.map((r) => r.at)) || null,
  };
}

/** Which way the board sorts: the most delayed first, or the best odds first. */
export type BoardTab = "late" | "odds";
export const bestOdds = (m: Pick<MarketRow, "odds_yes" | "odds_no">): number => Math.max(Number(m.odds_yes), Number(m.odds_no));
export const bestSide = (m: Pick<MarketRow, "odds_yes" | "odds_no">): "yes" | "no" => (Number(m.odds_yes) >= Number(m.odds_no) ? "yes" : "no");

export function sortBoard(rows: readonly BoardRow[], tab: BoardTab): BoardRow[] {
  return [...rows].sort((a, b) => (tab === "late" ? b.delay - a.delay || Date.parse(a.m.target_at) - Date.parse(b.m.target_at) : bestOdds(b.m) - bestOdds(a.m)));
}
