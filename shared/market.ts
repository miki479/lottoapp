import { tzOffsetSec } from "./time.ts";
import type { DelayEvent, MarketEvent, MetricEvent, QuakeEvent, RainEvent, StrikeEvent, TickEvent, TrafficEvent } from "./types.ts";

/** A row of public.markets as returned by Supabase (timestamps are ISO strings). */
export interface MarketRow {
  id: string;
  city_id: string;
  category: "bus" | "train" | "weather" | "traffic" | "nature" | "strike" | "finance" | "culture" | "sport";
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
  if (row.kind === "metric_gt") {
    const ev: MetricEvent = { ...base, kind: "metric_gt", category: "weather", metric: p.metric as MetricEvent["metric"], threshold: Number(p.threshold) };
    return ev;
  }
  if (row.kind === "quake_m") {
    const ev: QuakeEvent = { ...base, kind: "quake_m", category: "nature", minMag: Number(p.minMag), circle: Array.isArray(p.circle) && p.circle.length === 3 ? (p.circle.map(Number) as [number, number, number]) : undefined, bbox: Array.isArray(p.bbox) && p.bbox.length === 4 ? (p.bbox.map(Number) as [number, number, number, number]) : undefined };
    return ev;
  }
  if (row.kind === "strike_on") {
    const ev: StrikeEvent = { ...base, kind: "strike_on", category: "strike", guid: String(p.guid), date: String(p.date) };
    return ev;
  }
  if (row.kind === "traffic_speed_lt") {
    const ev: TrafficEvent = { ...base, kind: "traffic_speed_lt", category: "traffic", siteId: String(p.siteId), direction: Number(p.direction) === 2 ? 2 : 1, thresholdKmh: Number(p.thresholdKmh) };
    return ev;
  }
  if (row.kind === "tick_gt") {
    const cat = row.category === "finance" || row.category === "culture" ? row.category : "nature";
    const ev: TickEvent = { ...base, kind: "tick_gt", category: cat, series: String(p.series), threshold: Number(p.threshold) };
    return ev;
  }
  throw new Error(`Unknown market kind: ${row.kind}`);
}

/** Key under which the outcome of an event is accumulated for future odds. */
export function historyKey(ev: MarketEvent, tz: string): { kind: string; routeId: string; hourOfDay: number; threshold: number } {
  const local = ev.targetAt + tzOffsetSec(ev.targetAt, tz);
  const hourOfDay = Math.floor((((local % 86400) + 86400) % 86400) / 3600);
  if (ev.kind === "rain_at") return { kind: ev.kind, routeId: "", hourOfDay, threshold: 0 };
  if (ev.kind === "metric_gt") return { kind: ev.kind, routeId: ev.metric, hourOfDay, threshold: Math.round(ev.threshold * 10) };
  if (ev.kind === "traffic_speed_lt") return { kind: ev.kind, routeId: `${ev.siteId}|${ev.direction}`, hourOfDay, threshold: ev.thresholdKmh };
  if (ev.kind === "tick_gt") return { kind: ev.kind, routeId: ev.series, hourOfDay, threshold: Math.round(ev.threshold) };
  if (ev.kind === "strike_on") return { kind: ev.kind, routeId: "", hourOfDay, threshold: 0 };
  if (ev.kind === "quake_m") return { kind: ev.kind, routeId: "", hourOfDay, threshold: Math.round(ev.minMag * 10) + (ev.bbox || ev.circle ? 1000 : 0) };
  return { kind: ev.kind, routeId: ev.routeId, hourOfDay, threshold: ev.thresholdSec };
}
