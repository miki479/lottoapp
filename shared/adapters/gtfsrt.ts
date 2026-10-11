import { delayFromPosition, delayFromTripUpdate } from "../delay.ts";
import type { DelayObservation } from "../types.ts";
import type { DelayAdapter, RtTrip } from "./types.ts";

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** The id a trip is known by: its tripId, or (feeds without one) route|direction|service day|start time, the same key the market generator writes. */
export function tripIdOf(trip: RtTrip | null | undefined, mode?: "route_dir_start"): string | null {
  if (!trip) return null;
  if (mode === "route_dir_start") {
    if (!trip.routeId || !trip.startDate || !trip.startTime) return null;
    return `${trip.routeId}|${trip.directionId ?? 0}|${trip.startDate}|${trip.startTime}`;
  }
  return trip.tripId ?? null;
}

/** Vehicle positions + static timetable → delay at the last passed stop (Toei). */
export const vehiclePositionsAdapter: DelayAdapter = (feed, ctx) => {
  const out: DelayObservation[] = [];
  if (!ctx.schedule) return out;
  for (const e of feed.entity ?? []) {
    const v = e.vehicle;
    const tripId = tripIdOf(v?.trip, ctx.tripKey);
    const seq = v?.currentStopSequence;
    const observedAt = num(v?.timestamp);
    if (!tripId || seq == null || observedAt === null) continue;
    const sched = ctx.schedule(tripId, seq);
    if (!sched) continue;
    // A reported stop_id that disagrees with the timetable means the trip was re-routed: skip.
    if (v?.stopId && v.stopId !== sched.stopId) continue;
    const delaySec = delayFromPosition(observedAt, sched.time, ctx.timezone);
    if (delaySec === null) continue;
    out.push({ feedId: ctx.feedId, tripId, stopId: sched.stopId, stopSequence: seq, routeId: v?.trip?.routeId ?? "", observedAt, delaySec });
  }
  return out;
};

/** TripUpdates with explicit delays (Keisei). */
export const tripUpdatesAdapter: DelayAdapter = (feed, ctx) => {
  const out: DelayObservation[] = [];
  const headerTs = num(feed.header?.timestamp) ?? ctx.fetchedAt;
  for (const e of feed.entity ?? []) {
    const tu = e.tripUpdate;
    const tripId = tripIdOf(tu?.trip, ctx.tripKey);
    if (!tripId) continue;
    for (const stu of tu?.stopTimeUpdate ?? []) {
      if (!stu.stopId) continue;
      const delaySec = delayFromTripUpdate(stu);
      if (delaySec === null) continue;
      // TripUpdates are forecasts. Without a predicted time we cannot tell fact from forecast: skip.
      const predictedAt = num(stu.arrival?.time) ?? num(stu.departure?.time);
      if (predictedAt === null) continue;
      out.push({ feedId: ctx.feedId, tripId, stopId: stu.stopId, routeId: tu?.trip?.routeId ?? "", observedAt: headerTs, delaySec, predictedAt });
    }
  }
  return out;
};

/**
 * TripUpdates that carry only predicted TIMES, no delay field (GTT Torino, many US/Nordic feeds):
 * delay = predicted time - scheduled time of the same stop_sequence (from the static timetable).
 * Like every TripUpdate this is a forecast, so `predictedAt` is kept and the resolver's freshness rule applies.
 */
export const tripUpdatesTimesAdapter: DelayAdapter = (feed, ctx) => {
  const out: DelayObservation[] = [];
  if (!ctx.schedule) return out;
  const headerTs = num(feed.header?.timestamp) ?? ctx.fetchedAt;
  for (const e of feed.entity ?? []) {
    const tu = e.tripUpdate;
    const tripId = tripIdOf(tu?.trip, ctx.tripKey);
    if (!tripId) continue;
    for (const stu of tu?.stopTimeUpdate ?? []) {
      const predictedAt = num(stu.arrival?.time) ?? num(stu.departure?.time);
      if (predictedAt === null) continue;
      // Most feeds number the stops; some (Helsinki) only give the stop id.
      const byStop = stu.stopSequence == null && stu.stopId && ctx.scheduleByStop ? ctx.scheduleByStop(tripId, stu.stopId) : null;
      const seq = stu.stopSequence ?? byStop?.seq;
      if (seq == null) continue;
      const sched = byStop ? { stopId: byStop.stopId, time: byStop.time } : ctx.schedule(tripId, seq);
      if (!sched) continue;
      // A reported stop_id that disagrees with the timetable means the trip was re-routed: skip.
      if (stu.stopId && stu.stopId !== sched.stopId) continue;
      const delaySec = delayFromPosition(predictedAt, sched.time, ctx.timezone);
      if (delaySec === null) continue;
      out.push({ feedId: ctx.feedId, tripId, stopId: sched.stopId, stopSequence: seq, routeId: tu?.trip?.routeId ?? "", observedAt: headerTs, delaySec, predictedAt });
    }
  }
  return out;
};
