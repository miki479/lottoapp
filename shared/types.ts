export type Category = "bus" | "train" | "weather" | "traffic";
export type Outcome = "yes" | "no";
export type BetStatus = "open" | "won" | "lost" | "void";

/** What the house offers. One row per bettable question. */
export type MarketEvent =
  | DelayEvent
  | RainEvent;

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

export interface DelayObservation {
  feedId: string;
  tripId: string;
  stopId: string;
  routeId: string;
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
