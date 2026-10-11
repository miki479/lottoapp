import type { DelayObservation, WeatherObservation } from "../types.ts";

/** Minimal shape of a decoded GTFS-RT FeedMessage (what gtfs-realtime-bindings returns). */
export interface RtFeed {
  header?: { timestamp?: number | string | null };
  entity?: RtEntity[];
}
export interface RtEntity {
  id?: string;
  vehicle?: {
    trip?: { tripId?: string | null; routeId?: string | null } | null;
    stopId?: string | null;
    currentStopSequence?: number | null;
    timestamp?: number | string | null;
  } | null;
  tripUpdate?: {
    trip?: { tripId?: string | null; routeId?: string | null } | null;
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

export interface DelayAdapterContext {
  feedId: string;
  timezone: string;
  /** Epoch seconds when the feed was fetched. */
  fetchedAt: number;
  schedule?: ScheduleLookup;
}

export type DelayAdapter = (feed: RtFeed, ctx: DelayAdapterContext) => DelayObservation[];
export type WeatherAdapter = (json: unknown, feedId: string) => WeatherObservation[];

export interface TrainJsonAdapterContext {
  feedId: string;
  /** Epoch seconds when the response was fetched. */
  fetchedAt: number;
  /** The trip id that was requested (see trainTripId). */
  tripId: string;
}
/** For per-train JSON APIs (ViaggiaTreno): one response describes one train. */
export type TrainJsonAdapter = (json: unknown, ctx: TrainJsonAdapterContext) => DelayObservation[];
