// The "stops" board of a bus / train delay question: what to show for each stop of the trip and the trend of the delay. Pure, so the web app and the tests share it.
// The database (public.trip_stops) says what is known: the scheduled time of every stop, the delay measured at the stops the vehicle has reached,
// the feed's forecast where it gave one. This turns that into rows: the stops still ahead get a predicted time with the recovery assumption of the
// pricing model (`expectedDelay`), and every figure says which of the three it is.
import { expectedDelay, type DelayContext } from "./odds.ts";

/** One row of public.trip_stops(), as the API returns it (timestamps as ISO strings). */
export interface StopRow {
  seq: number;
  stop_id: string;
  name: string | null;
  sched_at: string;
  /** Measured at this stop, or the feed's forecast when `is_forecast`; null = nothing known. */
  delay_sec: number | null;
  seen_at: string | null;
  is_forecast: boolean | null;
  /** The last stop the vehicle is known to have reached. */
  is_current: boolean;
  /** The stop the question is about. */
  is_market: boolean;
  is_cancelled: boolean;
  /** The trip's latest delay (same on every row) and the one read about 12 minutes before it. */
  now_delay_sec: number | null;
  now_at: string | null;
  now_forecast: boolean | null;
  prev_delay_sec: number | null;
}

export type Trend = "better" | "worse" | "steady";
/** A change smaller than this is "steady": trains report whole minutes, a bus jitters by seconds. */
export const TREND_STEADY_SEC = 60;

/** Is the delay shrinking, growing or holding, against the reading some 10-15 minutes earlier? Null when there is nothing to compare with. Only lateness counts: early is as good as on time. */
export function trendOf(delaySec: number | null | undefined, prevSec: number | null | undefined): Trend | null {
  if (delaySec == null || prevSec == null || !Number.isFinite(delaySec) || !Number.isFinite(prevSec)) return null;
  const change = Math.max(0, delaySec) - Math.max(0, prevSec);
  return change >= TREND_STEADY_SEC ? "worse" : change <= -TREND_STEADY_SEC ? "better" : "steady";
}

/**
 * "actual"    measured when the vehicle got to the stop (a fact),
 * "forecast"  what the operator's feed predicts for the stop,
 * "predicted" ours: the last known delay carried to the stops ahead with the model's recovery,
 * "none"      nothing to say (a stop already passed without a reading, a cancelled stop, a trip with no data).
 */
export type Cell = "actual" | "forecast" | "predicted" | "none";

export interface BoardStop {
  seq: number;
  id: string;
  name: string;
  /** Scheduled time (epoch ms). */
  schedMs: number;
  cell: Cell;
  delaySec: number | null;
  /** schedMs + delay: when the vehicle was, or is expected to be, there (epoch ms). */
  atMs: number | null;
  /** Before, at or after the vehicle's position. */
  phase: "done" | "current" | "ahead";
  market: boolean;
  cancelled: boolean;
}

export interface Board {
  stops: BoardStop[];
  /** Index in `stops` of the vehicle's position, -1 when it has not started (or nothing says where it is). */
  currentIdx: number;
  /** True when the position is worked out from the clock because no stop has a measured reading. */
  currentEstimated: boolean;
  /** The delay right now, with its trend; null when there is no reading from the last half hour. */
  live: { delaySec: number; atMs: number; forecast: boolean; trend: Trend | null } | null;
}

export interface BoardOptions {
  nowMs: number;
  /** A train recovers more slowly than a bus (see `expectedDelay`). */
  train: boolean;
  /** Local hour and weekday: the rush hour changes how a delay evolves. */
  ctx?: DelayContext;
  /** Same, asked for the scheduled time (epoch ms) of each stop ahead; wins over `ctx`. A long trip crosses the edges of the rush hour. */
  ctxAt?: (ms: number) => DelayContext;
  /** Used when the row has no reading to compare with (the app's `LiveDelay.prev_delay_sec`). */
  fallbackPrevSec?: number | null;
}

/** Turns the rows of trip_stops into the board: for each stop its time and what kind of figure it is, and where the vehicle is. */
export function buildBoard(rows: readonly StopRow[], o: BoardOptions): Board {
  const list = [...rows].sort((a, b) => a.seq - b.seq);
  const n = list.length;
  const first = list[0];
  const sched = list.map((r) => Date.parse(r.sched_at));
  const known = list.map((r) => (r.delay_sec != null && Number.isFinite(r.delay_sec) ? { d: r.delay_sec, fact: r.is_forecast === false } : null));

  const nowAt = first?.now_at ? Date.parse(first.now_at) : NaN;
  const live = first && first.now_delay_sec != null && Number.isFinite(nowAt)
    ? { delaySec: first.now_delay_sec, atMs: nowAt, forecast: first.now_forecast === true, trend: trendOf(first.now_delay_sec, first.prev_delay_sec ?? o.fallbackPrevSec ?? null) }
    : null;

  // where the vehicle is: the last stop with a measured reading; without one, the last stop whose time (plus the delay we know of) has passed
  let cur = list.findIndex((r) => r.is_current);
  let currentEstimated = false;
  if (cur < 0) {
    const forecast = known.find((k) => k !== null);
    const d = live?.delaySec ?? forecast?.d ?? null;
    if (d !== null) {
      for (let i = n - 1; i >= 0; i--) if (!list[i]!.is_cancelled && sched[i]! + d * 1000 <= o.nowMs) { cur = i; break; }
      currentEstimated = cur >= 0;
    }
  }

  // stops served between two positions: a cancelled stop takes no time, so it does not count as a stop of recovery
  const served: number[] = [0];
  for (let i = 0; i < n; i++) served.push(served[i]! + (list[i]!.is_cancelled ? 0 : 1));
  const hops = (from: number, to: number) => served[to + 1]! - served[from + 1]!;

  const stops: BoardStop[] = [];
  let prevKnown: { idx: number; d: number } | null = null;
  for (let i = 0; i < n; i++) {
    const r = list[i]!, k = known[i]!;
    let cell: Cell = "none", delaySec: number | null = null;
    if (k && !r.is_cancelled) {
      cell = k.fact ? "actual" : "forecast"; delaySec = k.d;
      prevKnown = { idx: i, d: k.d };
    } else if (!r.is_cancelled && (i > cur || (i === cur && currentEstimated))) {
      if (prevKnown) { cell = "predicted"; delaySec = Math.round(expectedDelay(prevKnown.d, hops(prevKnown.idx, i), o.train, o.ctxAt ? o.ctxAt(sched[i]!) : o.ctx)); }
      else {
        // ahead of the vehicle and before the first figure we have: that figure, as it is (the recovery only runs forwards)
        const next = known.findIndex((x, j) => j > i && x !== null && !list[j]!.is_cancelled);
        if (next >= 0) { cell = "predicted"; delaySec = known[next]!.d; }
      }
    }
    stops.push({
      seq: r.seq, id: r.stop_id, name: r.name ?? "", schedMs: sched[i]!, cell, delaySec,
      atMs: delaySec === null ? null : sched[i]! + delaySec * 1000,
      phase: i < cur ? "done" : i === cur ? "current" : "ahead",
      market: r.is_market, cancelled: r.is_cancelled,
    });
  }
  return { stops, currentIdx: cur, currentEstimated, live };
}

/** Green for a punctual (or early) stop, amber for a little late, orange past the question's line (strictly more than the line, like the question); null when there is no figure. */
export type Tone = "ok" | "late" | "over";
export function toneOf(delaySec: number | null, limitSec: number): Tone | null {
  if (delaySec === null) return null;
  return delaySec > limitSec ? "over" : delaySec < 60 ? "ok" : "late";
}
