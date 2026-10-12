import type { Cancellation } from "./adapters/types.ts";

/** The open delay questions that a cancellation makes pointless: the same trip, and either the whole trip or that very stop. */
export function cancelledMarkets<M extends { feed_id: string; params: Record<string, unknown> }>(markets: M[], rows: (Cancellation & { feed_id: string })[]): M[] {
  const whole = new Set(rows.filter((r) => r.stopId === null).map((r) => `${r.feed_id}|${r.tripId}`));
  const stops = new Set(rows.filter((r) => r.stopId !== null).map((r) => `${r.feed_id}|${r.tripId}|${r.stopId}`));
  return markets.filter((m) => {
    const trip = String(m.params.tripId ?? "");
    return trip !== "" && (whole.has(`${m.feed_id}|${trip}`) || stops.has(`${m.feed_id}|${trip}|${String(m.params.stopId ?? "")}`));
  });
}
