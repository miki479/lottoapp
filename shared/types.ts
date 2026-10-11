export type Category = "bus" | "train" | "weather" | "traffic" | "nature";
export type Outcome = "yes" | "no";
export type BetStatus = "open" | "won" | "lost" | "void";

/** What the house offers. One row per bettable question. */
export type MarketEvent =
  | DelayEvent
  | RainEvent
  | MetricEvent
  | QuakeEvent;

interface BaseEvent {
  id: string;
  cityId: string;
  /** Feed that must be healthy for this event to resolve. */
  feedId: string;
  /** Betting closes at this epoch (seconds). */
  closesAt: number;
  /** The moment the question is about (epoch seconds). */
  targetAt: number;
  /** Resolution is attempted until this epoch; after it, missing data means void. */
  deadlineAt: number;
}

/** "Will this scheduled bus/tram/train be more than N seconds late at this stop?" */
export interface DelayEvent extends BaseEvent {
  kind: "bus_delay_gt" | "train_delay_gt";
  category: "bus" | "train";
  routeId: string;
  /** Scheduled trip the question is about. */
  tripId: string;
  stopId: string;
  /** Position in the trip. Lets position-based feeds match a reading taken a stop or two later. */
  stopSequence?: number;
  /** "more than N seconds late" (strict). */
  thresholdSec: number;
}

export type BusDelayEvent = DelayEvent;

export interface RainEvent extends BaseEvent {
  kind: "rain_at";
  category: "weather";
  /** Rain means precipitation >= this many mm in the observed hour. */
  minMm: number;
}

/** "Will <metric> be at least <threshold> in the hour containing the target?" (temperature, gusts, snow, UV, air quality). */
export interface MetricEvent extends BaseEvent {
  kind: "metric_gt";
  category: "weather";
  metric: "temp" | "wind" | "snow" | "uv" | "aqi";
  threshold: number;
}

/** "Will an earthquake of magnitude >= minMag strike anywhere between closesAt and targetAt?" */
export interface QuakeEvent extends BaseEvent {
  kind: "quake_m";
  category: "nature";
  minMag: number;
}

export interface MetricObservation {
  feedId: string;
  metric: "temp" | "wind" | "snow" | "uv" | "aqi";
  hourStart: number;
  value: number;
  /** When it was fetched (epoch seconds): a reading fetched before its hour ended is still a forecast. */
  fetchedAt?: number;
}

/** Earthquakes reported by USGS in a window. */
export interface QuakeReading { count: number; maxMag: number | null }

export interface DelayObservation {
  feedId: string;
  tripId: string;
  stopId: string;
  routeId: string;
  /** Set by position-based feeds (the bus's last passed stop). */
  stopSequence?: number;
  /** When the delay was observed (epoch seconds). */
  observedAt: number;
  /** Seconds late; negative = early. */
  delaySec: number;
  /**
   * Only for TripUpdates, which are forecasts: the epoch at which the vehicle is predicted
   * to be at the stop. A reading counts as a fact only if it was taken near or after this time.
   */
  predictedAt?: number;
}

export interface WeatherObservation {
  feedId: string;
  /** Start of the observed hour (epoch seconds). */
  hourStart: number;
  precipitationMm: number;
  /** When it was fetched (epoch seconds). A value fetched before its hour ended is a forecast, not a measurement. */
  fetchedAt?: number;
}

export interface FeedHealth {
  feedId: string;
  /** Last time the feed was fetched and parsed successfully (epoch seconds). */
  lastOkAt: number | null;
}

export type Resolution =
  | { status: "pending" }
  | { status: "resolved"; outcome: Outcome; evidence: Record<string, number | string> }
  | { status: "void"; reason: VoidReason };

export type VoidReason = "feed_down" | "no_observation" | "implausible_data";
