import { delayFromPosition, delayFromTripUpdate, MAX_EARLY_SEC, MAX_LATE_SEC } from "../delay.ts";
import { occupancyLevel } from "../occupancy.ts";
import { gtfsDayStart, parseGtfsTime } from "../time.ts";
import type { DelayObservation } from "../types.ts";
import type { Cancellation, DelayAdapter, RtFeed, RtTrip } from "./types.ts";

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

/**
 * TripUpdates with an explicit delay per stop_sequence and no stop id or time (START Romagna, via BusOne): the stop comes from the
 * static timetable. The delay of a stop already passed is the one measured at the passage (a fact, no predictedAt); for the stops
 * ahead it is a forecast, so the resolver's freshness rule applies.
 */
export const tripUpdatesSeqAdapter: DelayAdapter = (feed, ctx) => {
  const out: DelayObservation[] = [];
  if (!ctx.schedule) return out;
  const headerTs = num(feed.header?.timestamp) ?? ctx.fetchedAt;
  for (const e of feed.entity ?? []) {
    const tu = e.tripUpdate;
    const tripId = tripIdOf(tu?.trip, ctx.tripKey);
    if (!tripId) continue;
    const y = tu?.trip?.startDate;
    // the service day the trip belongs to (the date is read at noon so a daylight-saving change cannot move it)
    const dayStart = y && /^\d{8}$/.test(y) ? gtfsDayStart(Date.UTC(+y.slice(0, 4), +y.slice(4, 6) - 1, +y.slice(6, 8), 12) / 1000, ctx.timezone) : gtfsDayStart(headerTs, ctx.timezone);
    for (const stu of tu?.stopTimeUpdate ?? []) {
      if (stu.stopSequence == null) continue;
      const sched = ctx.schedule(tripId, stu.stopSequence);
      if (!sched) continue;
      if (stu.stopId && stu.stopId !== sched.stopId) continue; // re-routed
      const delaySec = delayFromTripUpdate(stu);
      if (delaySec === null || delaySec < MAX_EARLY_SEC || delaySec > MAX_LATE_SEC) continue;
      const predictedAt = dayStart + parseGtfsTime(sched.time) + delaySec;
      out.push({ feedId: ctx.feedId, tripId, stopId: sched.stopId, stopSequence: stu.stopSequence, routeId: tu?.trip?.routeId ?? "", observedAt: headerTs, delaySec, ...(predictedAt > headerTs ? { predictedAt } : {}) });
    }
  }
  return out;
};

/** Occupancy reported by the vehicles of a VehiclePositions feed, one reading per trip (vehicles without a reading are skipped). */
export function parseOccupancy(feed: RtFeed, fetchedAt: number): { tripId: string; at: number; level: number }[] {
  const out: { tripId: string; at: number; level: number }[] = [];
  for (const e of feed.entity ?? []) {
    const v = e.vehicle as (NonNullable<RtFeed["entity"]>[number]["vehicle"] & { occupancyStatus?: unknown }) | null | undefined;
    const tripId = v?.trip?.tripId;
    const level = occupancyLevel(v?.occupancyStatus);
    if (!tripId || level === null) continue;
    out.push({ tripId, at: num(v?.timestamp) ?? fetchedAt, level });
  }
  return out;
}

/** Latest position of each vehicle that is on a trip. */
export function parseVehiclePositions(feed: RtFeed, fetchedAt: number): { tripId: string; at: number; lat: number; lon: number; bearing: number | null }[] {
  const out: { tripId: string; at: number; lat: number; lon: number; bearing: number | null }[] = [];
  for (const e of feed.entity ?? []) {
    const v = e.vehicle as (NonNullable<RtFeed["entity"]>[number]["vehicle"] & { position?: { latitude?: number; longitude?: number; bearing?: number } | null }) | null | undefined;
    const tripId = v?.trip?.tripId;
    const lat = v?.position?.latitude, lon = v?.position?.longitude;
    if (!tripId || typeof lat !== "number" || typeof lon !== "number" || !(Math.abs(lat) <= 90 && Math.abs(lon) <= 180) || (lat === 0 && lon === 0)) continue;
    out.push({ tripId, at: num(v?.timestamp) ?? fetchedAt, lat, lon, bearing: typeof v?.position?.bearing === "number" ? v.position.bearing : null });
  }
  return out;
}

/** GTFS-RT ScheduleRelationship: a trip is CANCELED (3) or DELETED (6); one stop is SKIPPED (1). The decoder gives numbers or names, both are read. */
export const isTripGone = (v: number | string | null | undefined) => v === 3 || v === 6 || v === "CANCELED" || v === "DELETED";
export const isStopSkipped = (v: number | string | null | undefined) => v === 1 || v === "SKIPPED";

/** Cancelled trips and skipped stops announced by the TripUpdates of a feed. */
export function cancellationsFromTripUpdates(feed: RtFeed, tripKey?: "route_dir_start", schedule?: (tripId: string, seq: number) => { stopId: string } | null): Cancellation[] {
  const out: Cancellation[] = [];
  for (const e of feed.entity ?? []) {
    const tu = e.tripUpdate;
    const tripId = tripIdOf(tu?.trip, tripKey);
    if (!tripId) continue;
    if (isTripGone(tu?.trip?.scheduleRelationship)) { out.push({ tripId, stopId: null }); continue; }
    for (const stu of tu?.stopTimeUpdate ?? []) {
      if (!isStopSkipped(stu.scheduleRelationship)) continue;
      const stopId = stu.stopId ?? (stu.stopSequence != null ? schedule?.(tripId, stu.stopSequence)?.stopId : null);
      if (stopId) out.push({ tripId, stopId });
    }
  }
  return out;
}
