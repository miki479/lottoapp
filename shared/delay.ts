import { gtfsDayStart, parseGtfsTime } from "./time.ts";

/** Plausibility window for a computed delay. Outside it the reading is discarded, never used. */
export const MAX_EARLY_SEC = -15 * 60;
export const MAX_LATE_SEC = 3 * 60 * 60;

/**
 * Delay for vehicle-position feeds that carry no delay field (Toei).
 *
 * `current_stop_sequence` is interpreted as the last stop the bus has passed
 * ("last_passed_stop"); this must be calibrated on collected data before it is used
 * to settle bets, see docs/phase0-findings.md.
 *
 * @param observedAt  vehicle timestamp (epoch seconds)
 * @param scheduledGtfsTime  arrival/departure time at that stop, "HH:MM:SS"
 * @param tz  IANA timezone of the agency
 * @returns seconds late, or null if the reading is implausible
 */
export function delayFromPosition(observedAt: number, scheduledGtfsTime: string, tz: string): number | null {
  const dayStart = gtfsDayStart(observedAt, tz);
  let scheduled = dayStart + parseGtfsTime(scheduledGtfsTime);
  // Trips after midnight are published as 24:xx on the previous service day.
  if (observedAt - scheduled > 12 * 3600) scheduled += 24 * 3600;
  else if (scheduled - observedAt > 12 * 3600) scheduled -= 24 * 3600;
  const delay = observedAt - scheduled;
  return delay < MAX_EARLY_SEC || delay > MAX_LATE_SEC ? null : delay;
}

/** Delay from a GTFS-RT TripUpdate stop_time_update (Keisei): prefer arrival, fall back to departure. */
export function delayFromTripUpdate(stu: {
  arrival?: { delay?: number | null } | null;
  departure?: { delay?: number | null } | null;
}): number | null {
  const d = stu.arrival?.delay ?? stu.departure?.delay;
  if (typeof d !== "number" || !Number.isFinite(d)) return null;
  return d < MAX_EARLY_SEC || d > MAX_LATE_SEC ? null : d;
}
