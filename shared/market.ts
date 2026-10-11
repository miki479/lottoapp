import { tzOffsetSec } from "./time.ts";
import type { DelayEvent, MarketEvent, RainEvent } from "./types.ts";

/** A row of public.markets as returned by Supabase (timestamps are ISO strings). */
export interface MarketRow {
  id: string;
  city_id: string;
  category: "bus" | "train" | "weather" | "traffic";
  kind: string;
  feed_id: string;
  params: Record<string, unknown>;
  closes_at: string;
  target_at: string;
  deadline_at: string;
}

const epoch = (iso: string) => Math.floor(Date.parse(iso) / 1000);

export function marketToEvent(row: MarketRow): MarketEvent {
  const base = {
    id: row.id,
    cityId: row.city_id,
    feedId: row.feed_id,
    closesAt: epoch(row.closes_at),
    targetAt: epoch(row.target_at),
    deadlineAt: epoch(row.deadline_at),
  };
  const p = row.params;
  if (row.kind === "bus_delay_gt" || row.kind === "train_delay_gt") {
    const ev: DelayEvent = {
      ...base,
      kind: row.kind,
      category: row.kind === "bus_delay_gt" ? "bus" : "train",
      routeId: String(p.routeId ?? ""),
      tripId: String(p.tripId),
      stopId: String(p.stopId),
      stopSequence: p.stopSequence === undefined ? undefined : Number(p.stopSequence),
      thresholdSec: Number(p.thresholdSec),
    };
    return ev;
  }
  if (row.kind === "rain_at") {
    const ev: RainEvent = { ...base, kind: "rain_at", category: "weather", minMm: Number(p.minMm ?? 0.1) };
    return ev;
  }
  throw new Error(`Unknown market kind: ${row.kind}`);
}

/** Key under which the outcome of an event is accumulated for future odds. */
export function historyKey(ev: MarketEvent, tz: string): { kind: string; routeId: string; hourOfDay: number; threshold: number } {
  const local = ev.targetAt + tzOffsetSec(ev.targetAt, tz);
  const hourOfDay = Math.floor((((local % 86400) + 86400) % 86400) / 3600);
  if (ev.kind === "rain_at") return { kind: ev.kind, routeId: "", hourOfDay, threshold: 0 };
  return { kind: ev.kind, routeId: ev.routeId, hourOfDay, threshold: ev.thresholdSec };
}
