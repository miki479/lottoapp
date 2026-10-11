import { delayFromPosition, delayFromTripUpdate } from "../delay.ts";
import type { DelayObservation } from "../types.ts";
import type { DelayAdapter } from "./types.ts";

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Vehicle positions + static timetable → delay at the last passed stop (Toei). */
export const vehiclePositionsAdapter: DelayAdapter = (feed, ctx) => {
  const out: DelayObservation[] = [];
  if (!ctx.schedule) return out;
  for (const e of feed.entity ?? []) {
    const v = e.vehicle;
    const tripId = v?.trip?.tripId;
    const seq = v?.currentStopSequence;
    const observedAt = num(v?.timestamp);
    if (!tripId || seq == null || observedAt === null) continue;
    const sched = ctx.schedule(tripId, seq);
    if (!sched) continue;
    // A reported stop_id that disagrees with the timetable means the trip was re-routed: skip.
    if (v?.stopId && v.stopId !== sched.stopId) continue;
    const delaySec = delayFromPosition(observedAt, sched.time, ctx.timezone);
    if (delaySec === null) continue;
    out.push({ feedId: ctx.feedId, tripId, stopId: sched.stopId, routeId: v?.trip?.routeId ?? "", observedAt, delaySec });
  }
  return out;
};

/** TripUpdates with explicit delays (Keisei). */
export const tripUpdatesAdapter: DelayAdapter = (feed, ctx) => {
  const out: DelayObservation[] = [];
  const headerTs = num(feed.header?.timestamp) ?? ctx.fetchedAt;
  for (const e of feed.entity ?? []) {
    const tu = e.tripUpdate;
    const tripId = tu?.trip?.tripId;
    if (!tripId) continue;
    for (const stu of tu?.stopTimeUpdate ?? []) {
      if (!stu.stopId) continue;
      const delaySec = delayFromTripUpdate(stu);
      if (delaySec === null) continue;
      out.push({ feedId: ctx.feedId, tripId, stopId: stu.stopId, routeId: tu?.trip?.routeId ?? "", observedAt: headerTs, delaySec });
    }
  }
  return out;
};
