import type { Cancellation } from "./adapters/types.ts";

/** A cancellation only concerns the trips of the day it was reported for: a bus trip cancelled on Monday runs again on Tuesday. */
export const CANCEL_WINDOW_SEC = 18 * 3600;

/** The open delay questions that a cancellation makes pointless: the same trip, close in time to the report, and either the whole trip or that very stop. */
export function cancelledMarkets<M extends { feed_id: string; target_at?: string; params: Record<string, unknown> }>(markets: M[], rows: (Cancellation & { feed_id: string; detectedAt?: number })[]): M[] {
  const near = (m: M, r: { detectedAt?: number }) => r.detectedAt === undefined || !m.target_at || Math.abs(Date.parse(m.target_at) / 1000 - r.detectedAt) <= CANCEL_WINDOW_SEC;
  return markets.filter((m) => {
    const trip = String(m.params.tripId ?? ""), stop = String(m.params.stopId ?? "");
    return trip !== "" && rows.some((r) => r.feed_id === m.feed_id && r.tripId === trip && (r.stopId === null || r.stopId === stop) && near(m, r));
  });
}
