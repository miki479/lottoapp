import type { DelayObservation, WeatherObservation } from "../types.ts";

/** Minimal shape of a decoded GTFS-RT FeedMessage (what gtfs-realtime-bindings returns). */
export interface RtFeed {
  header?: { timestamp?: number | string | null };
  entity?: RtEntity[];
}
/** Trip descriptor. Some feeds (Helsinki) have no tripId: the trip is told by route, direction, service day and start time. */
export interface RtTrip { tripId?: string | null; routeId?: string | null; directionId?: number | null; startDate?: string | null; startTime?: string | null }
export interface RtEntity {
  id?: string;
  vehicle?: {
    trip?: RtTrip | null;
    stopId?: string | null;
    currentStopSequence?: number | null;
    timestamp?: number | string | null;
  } | null;
  tripUpdate?: {
    trip?: RtTrip | null;
    stopTimeUpdate?: Array<{
      stopSequence?: number | null;
      stopId?: string | null;
      arrival?: { delay?: number | null; time?: number | string | null } | null;
      departure?: { delay?: number | null; time?: number | string | null } | null;
    }> | null;
  } | null;
}

/** Scheduled time lookup built from the static GTFS (stop_times) by the nightly job. */
export type ScheduleLookup = (tripId: string, stopSequence: number) => { stopId: string; time: string } | null;
/** Same timetable, found by stop id when the feed gives no stop sequence. */
export type ScheduleByStop = (tripId: string, stopId: string) => { seq: number; stopId: string; time: string } | null;

export interface DelayAdapterContext {
  feedId: string;
  timezone: string;
  /** Epoch seconds when the feed was fetched. */
  fetchedAt: number;
  schedule?: ScheduleLookup;
  scheduleByStop?: ScheduleByStop;
  /** How to name a trip that has no tripId: "route_dir_start" = routeId|directionId|startDate|startTime. */
  tripKey?: "route_dir_start";
}

export type DelayAdapter = (feed: RtFeed, ctx: DelayAdapterContext) => DelayObservation[];
export type WeatherAdapter = (json: unknown, feedId: string) => WeatherObservation[];
