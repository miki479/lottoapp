import type {
  BusDelayEvent,
  DelayObservation,
  FeedHealth,
  MarketEvent,
  RainEvent,
  Resolution,
  WeatherObservation,
} from "./types.ts";

export interface ResolveInput {
  event: MarketEvent;
  now: number;
  feed: FeedHealth;
  /** Seconds after which a feed with no successful fetch is considered down. */
  staleAfterSec: number;
  delays: DelayObservation[];
  weather: WeatherObservation[];
}

/** A bus delay reading counts only if taken within this window around the scheduled time. */
const BUS_WINDOW_BEFORE_SEC = 5 * 60;
const BUS_WINDOW_AFTER_SEC = 15 * 60;
/** Weather reading must come from the hour that contains the target instant. */
const HOUR = 3600;

/**
 * Decide the outcome of an event. The contract:
 *  - never resolve without a valid observation inside the allowed window;
 *  - while the deadline has not passed, a missing observation just means "pending";
 *  - once the deadline has passed with no valid observation (feed down, trip never seen,
 *    implausible value), void: stakes are refunded, the house never guesses.
 */
export function resolveEvent(input: ResolveInput): Resolution {
  const { event, now } = input;
  // Rain is measured over the whole hour containing the target, so wait for that hour to end.
  const readyAt = event.kind === "rain_at" ? Math.floor(event.targetAt / HOUR) * HOUR + HOUR : event.targetAt;
  if (now < readyAt) return { status: "pending" };

  const reading = event.kind === "bus_delay_gt" ? busReading(event, input) : rainReading(event, input);

  if (reading.kind === "none") {
    if (now < event.deadlineAt) return { status: "pending" };
    return { status: "void", reason: feedWasDown(input) ? "feed_down" : "no_observation" };
  }
  if (reading.kind === "implausible") return { status: "void", reason: "implausible_data" };

  return { status: "resolved", outcome: reading.yes ? "yes" : "no", evidence: reading.evidence };
}

type Reading =
  | { kind: "none" }
  | { kind: "implausible" }
  | { kind: "ok"; yes: boolean; evidence: Record<string, number | string> };

function busReading(event: BusDelayEvent, input: ResolveInput): Reading {
  const lo = event.targetAt - BUS_WINDOW_BEFORE_SEC;
  const hi = event.targetAt + BUS_WINDOW_AFTER_SEC;
  const candidates = input.delays
    .filter(
      (o) =>
        o.feedId === event.feedId &&
        o.tripId === event.tripId &&
        o.stopId === event.stopId &&
        o.observedAt >= lo &&
        o.observedAt <= hi &&
        o.observedAt <= input.now,
    )
    .sort((a, b) => a.observedAt - b.observedAt);
  // The first reading at the stop is the one that counts: later ones include later travel.
  const first = candidates[0];
  if (!first) return { kind: "none" };
  if (!Number.isFinite(first.delaySec)) return { kind: "implausible" };
  return {
    kind: "ok",
    yes: first.delaySec > event.thresholdSec,
    evidence: { delaySec: first.delaySec, observedAt: first.observedAt, thresholdSec: event.thresholdSec },
  };
}

function rainReading(event: RainEvent, input: ResolveInput): Reading {
  const hourStart = Math.floor(event.targetAt / HOUR) * HOUR;
  const obs = input.weather.find((w) => w.feedId === event.feedId && w.hourStart === hourStart);
  if (!obs) return { kind: "none" };
  if (!Number.isFinite(obs.precipitationMm) || obs.precipitationMm < 0) return { kind: "implausible" };
  return {
    kind: "ok",
    yes: obs.precipitationMm >= event.minMm,
    evidence: { precipitationMm: obs.precipitationMm, hourStart, minMm: event.minMm },
  };
}

function feedWasDown(input: ResolveInput): boolean {
  const { feed, staleAfterSec, event } = input;
  if (feed.lastOkAt === null) return true;
  // Down if the last good fetch is too old relative to the moment the answer was due.
  return feed.lastOkAt < event.targetAt - staleAfterSec || input.now - feed.lastOkAt > staleAfterSec;
}
