export type Category = "bus" | "weather" | "traffic";
export type Outcome = "yes" | "no";
export type BetStatus = "open" | "won" | "lost" | "void";

/** What the house offers. One row per bettable question. */
export type MarketEvent =
  | BusDelayEvent
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

export interface BusDelayEvent extends BaseEvent {
  kind: "bus_delay_gt";
  category: "bus";
  routeId: string;
  /** Scheduled trip the question is about. */
  tripId: string;
  stopId: string;
  /** "more than N seconds late" (strict). */
  thresholdSec: number;
}

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
