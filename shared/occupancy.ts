import { computeOdds, yesProbability, type History } from "./odds.ts";
import { gtfsDayStart, parseGtfsTime } from "./time.ts";
import type { MarketInsert, StopTimeRow } from "./generator.ts";

/** How full a vehicle is, from GTFS-RT occupancy_status (0 empty ... 5 full). */
export const OCC_LEVELS = ["EMPTY", "MANY_SEATS_AVAILABLE", "FEW_SEATS_AVAILABLE", "STANDING_ROOM_ONLY", "CRUSHED_STANDING_ROOM_ONLY", "FULL"] as const;
/** Level names a reading can carry (a decoded protobuf gives the number, JSON the name). */
export function occupancyLevel(v: unknown): number | null {
  if (typeof v === "number") return Number.isInteger(v) && v >= 0 && v < OCC_LEVELS.length ? v : null;
  const i = OCC_LEVELS.indexOf(String(v) as (typeof OCC_LEVELS)[number]);
  return i >= 0 ? i : null;
}

/** The three questions: empty (level <= 0), few seats left or worse (>= 2), standing room or worse (>= 3). */
export type OccKind = "empty" | "few" | "standing";
export const OCC_BETS: Record<OccKind, { cmp: "lte" | "gte"; level: number; prior: number }> = {
  empty: { cmp: "lte", level: 0, prior: 0.35 },
  few: { cmp: "gte", level: 2, prior: 0.06 },
  standing: { cmp: "gte", level: 3, prior: 0.02 },
};

/** Does a reading answer "yes" to the question? */
export const occupancyYes = (cmp: "lte" | "gte", level: number, seen: number): boolean => (cmp === "lte" ? seen <= level : seen >= level);

/** A reading counts if the vehicle reported it this close to the moment the question is about. */
export const OCC_WINDOW_SEC = 5 * 60;

export interface OccupancyMarketArgs {
  cityId: string; tz: string; feedId: string; routeId: string; routeName: string; headsign: string; tripId: string;
  stop: StopTimeRow; stopName: string; serviceDayEpoch: number; kind: OccKind; history: History | null;
}

export function buildOccupancyMarket(a: OccupancyMarketArgs): MarketInsert {
  const bet = OCC_BETS[a.kind];
  const targetAt = gtfsDayStart(a.serviceDayEpoch, a.tz) + parseGtfsTime(a.stop.time);
  const odds = computeOdds(yesProbability(a.history, bet.prior));
  const iso = (t: number) => new Date(t * 1000).toISOString();
  return {
    city_id: a.cityId, category: "bus", kind: "bus_full", feed_id: a.feedId,
    params: { routeId: a.routeId, routeName: a.routeName, headsign: a.headsign, tripId: a.tripId, stopId: a.stop.stopId, stopName: a.stopName, stopSequence: a.stop.seq, scheduledTime: a.stop.time, occ: a.kind, cmp: bet.cmp, level: bet.level },
    closes_at: iso(targetAt - 10 * 60), target_at: iso(targetAt), deadline_at: iso(targetAt + 40 * 60),
    odds_yes: odds.yes, odds_no: odds.no,
  };
}
