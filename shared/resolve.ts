import { METRICS } from "./metrics.ts";
import { OCC_LEVELS, OCC_WINDOW_SEC, occupancyYes } from "./occupancy.ts";
import { evalMatch, FINISHED, type MatchObservation } from "./sport.ts";
import { CRYPTO_GRACE_SEC, isSpot, tickDef } from "./ticks.ts";
import { MIN_VEHICLES, MIN_WINDOW_SEC } from "./traffic.ts";
import type {
  DelayEvent,
  DelayObservation,
  FeedHealth,
  MarketEvent,
  MatchEvent,
  MetricEvent,
  MetricObservation,
  OccupancyEvent,
  OccupancyObservation,
  QuakeEvent,
  QuakeReading,
  RainEvent,
  Resolution,
  StrikeEvent,
  StrikeReading,
  TickEvent,
  TickObservation,
  TrafficEvent,
  TrafficObservation,
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
  metrics?: MetricObservation[];
  /** USGS result for the event's window (earthquake events only); null = USGS could not be read. */
  quake?: QuakeReading | null;
  /** Ministry list result for strike events; null = the list could not be read. */
  strike?: StrikeReading | null;
  traffic?: TrafficObservation[];
  ticks?: TickObservation[];
  occupancy?: OccupancyObservation[];
  match?: MatchObservation | null;
}

/** A bus delay reading counts only if taken within this window around the scheduled time. */
const BUS_WINDOW_BEFORE_SEC = 5 * 60;
const BUS_WINDOW_AFTER_SEC = 15 * 60;
/** A train's arrival is recorded when it happens: a very late train must still be read, not voided. */
const TRAIN_WINDOW_AFTER_SEC = 60 * 60;
/**
 * Position feeds are sampled every ~30 s and a bus can pass a stop between two samples.
 * A reading taken at the event's stop, or at most this many stops later, still counts.
 */
export const MAX_STOP_SKIP = 2;

/**
 * A forecast (TripUpdate) only counts if it was refreshed this close to the predicted passage,
 * or later. Earlier forecasts are guesses, not observations.
 */
export const FORECAST_FRESHNESS_SEC = 120;
/** Weather reading must come from the hour that contains the target instant. */
const HOUR = 3600;
/** USGS needs a little time to publish and review events after a window ends. */
const QUAKE_SETTLE_SEC = 30 * 60;

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
  const hourEnd = Math.floor(event.targetAt / HOUR) * HOUR + HOUR;
  const readyAt = event.kind === "rain_at" || event.kind === "metric_gt" || event.kind === "traffic_speed_lt" ? hourEnd : event.kind === "quake_m" ? event.targetAt + QUAKE_SETTLE_SEC : event.kind === "bus_full" ? event.targetAt + OCC_WINDOW_SEC : event.targetAt;
  if (now < readyAt) return { status: "pending" };

  const reading =
    event.kind === "rain_at" ? rainReading(event, input) :
    event.kind === "metric_gt" ? metricReading(event, input) :
    event.kind === "quake_m" ? quakeReading(event, input) :
    event.kind === "strike_on" ? strikeReading(event, input) :
    event.kind === "traffic_speed_lt" ? trafficReading(event, input) :
    event.kind === "tick_gt" ? tickReading(event, input) :
    event.kind === "match_bet" ? matchReading(event, input) :
    event.kind === "bus_full" ? occupancyReading(event, input) :
    delayReading(event, input);

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

function delayReading(event: DelayEvent, input: ResolveInput): Reading {
  const lo = event.targetAt - BUS_WINDOW_BEFORE_SEC;
  const hi = event.targetAt + (event.kind === "train_delay_gt" ? TRAIN_WINDOW_AFTER_SEC : BUS_WINDOW_AFTER_SEC);
  const matchesStop = (o: DelayObservation): boolean => {
    if (o.stopSequence !== undefined && event.stopSequence !== undefined) {
      return o.stopSequence >= event.stopSequence && o.stopSequence <= event.stopSequence + MAX_STOP_SKIP;
    }
    return o.stopId === event.stopId;
  };
  const candidates = input.delays
    .filter(
      (o) =>
        o.feedId === event.feedId &&
        o.tripId === event.tripId &&
        matchesStop(o) &&
        o.observedAt >= lo &&
        o.observedAt <= hi &&
        o.observedAt <= input.now &&
        (o.predictedAt === undefined || o.observedAt >= o.predictedAt - FORECAST_FRESHNESS_SEC),
    )
    // earliest stop first (closest to the question), then earliest time
    .sort((a, b) => (a.stopSequence ?? 0) - (b.stopSequence ?? 0) || a.observedAt - b.observedAt);
  // The reading closest to the event's stop counts: later ones include later travel.
  const first = candidates[0];
  if (!first) return { kind: "none" };
  if (!Number.isFinite(first.delaySec)) return { kind: "implausible" };
  return {
    kind: "ok",
    yes: first.delaySec > event.thresholdSec,
    evidence: { delaySec: first.delaySec, observedAt: first.observedAt, thresholdSec: event.thresholdSec },
  };
}

function metricReading(event: MetricEvent, input: ResolveInput): Reading {
  const hourStart = Math.floor(event.targetAt / HOUR) * HOUR;
  const obs = (input.metrics ?? []).find((m) => m.feedId === event.feedId && m.metric === event.metric && m.hourStart === hourStart);
  // A value fetched before its hour ended is still a forecast: wait for a fresher fetch.
  if (!obs || (obs.fetchedAt !== undefined && obs.fetchedAt < hourStart + HOUR)) return { kind: "none" };
  const def = METRICS[event.metric];
  if (!Number.isFinite(obs.value) || obs.value < def.min || obs.value > def.max) return { kind: "implausible" };
  return { kind: "ok", yes: obs.value >= event.threshold, evidence: { metric: event.metric, value: obs.value, hourStart, threshold: event.threshold } };
}

function matchReading(event: MatchEvent, input: ResolveInput): Reading {
  const o = input.match;
  // Only a final score counts: a live or postponed match stays pending, then is voided at the deadline.
  if (!o || !FINISHED.has(o.status) || o.homeGoals === null || o.awayGoals === null) return { kind: "none" };
  if (o.homeGoals < 0 || o.awayGoals < 0 || o.homeGoals > 30 || o.awayGoals > 30) return { kind: "implausible" };
  const bad = (x: number | null | undefined, max: number) => x !== null && x !== undefined && (!Number.isFinite(x) || x < 0 || x > max);
  if (bad(o.htHome, o.homeGoals) || bad(o.htAway, o.awayGoals) || bad(o.corners, 40) || bad(o.cards, 20) || bad(o.reds, 6)) return { kind: "implausible" };
  const yes = evalMatch(event.bet, { hg: o.homeGoals, ag: o.awayGoals, htHome: o.htHome, htAway: o.htAway, corners: o.corners, cards: o.cards, reds: o.reds, players: o.players });
  // half-time, corners or cards missing: wait for them, then void and refund at the deadline
  if (yes === null) return { kind: "none" };
  return { kind: "ok", yes, evidence: { home: o.homeGoals, away: o.awayGoals, bet: event.bet, ...(o.htHome !== null && o.htHome !== undefined ? { htHome: o.htHome, htAway: o.htAway ?? 0 } : {}), ...(o.corners !== null && o.corners !== undefined ? { corners: o.corners } : {}), ...(o.cards !== null && o.cards !== undefined ? { cards: o.cards } : {}) } };
}

/** The vehicle's own report closest to the moment of the question, within a few minutes of it. */
function occupancyReading(event: OccupancyEvent, input: ResolveInput): Reading {
  const near = (input.occupancy ?? []).filter((o) => o.tripId === event.tripId && o.feedId === event.feedId && Math.abs(o.at - event.targetAt) <= OCC_WINDOW_SEC && o.at <= input.now)
    .sort((a, b) => Math.abs(a.at - event.targetAt) - Math.abs(b.at - event.targetAt))[0];
  if (!near) return { kind: "none" };
  if (!Number.isInteger(near.level) || near.level < 0 || near.level >= OCC_LEVELS.length) return { kind: "implausible" };
  return { kind: "ok", yes: occupancyYes(event.cmp, event.level, near.level), evidence: { level: near.level, status: OCC_LEVELS[near.level]!, threshold: event.level, at: near.at } };
}

function tickReading(event: TickEvent, input: ResolveInput): Reading {
  const obs = (input.ticks ?? []).find((o) => o.series === event.series && o.at === event.targetAt);
  // The number only counts if it was read once the instant had passed (and, for a price, still close to it).
  if (!obs || obs.fetchedAt < event.targetAt || (isSpot(event.series) && obs.fetchedAt > event.targetAt + CRYPTO_GRACE_SEC)) return { kind: "none" };
  const def = tickDef(event.series);
  if (!def || !Number.isFinite(obs.value) || obs.value < def.min || obs.value > def.max) return { kind: "implausible" };
  return { kind: "ok", yes: obs.value >= event.threshold, evidence: { series: event.series, value: obs.value, threshold: event.threshold } };
}

function trafficReading(event: TrafficEvent, input: ResolveInput): Reading {
  const hourStart = Math.floor(event.targetAt / HOUR) * HOUR;
  const obs = (input.traffic ?? []).find((o) => o.feedId === event.feedId && o.siteId === event.siteId && o.direction === event.direction && o.hourStart === hourStart);
  // The hourly average only counts once the hour was almost over when it was read, and with enough vehicles to mean something.
  if (!obs || obs.measuredAt < hourStart + MIN_WINDOW_SEC || obs.vehicles < MIN_VEHICLES) return { kind: "none" };
  if (!Number.isFinite(obs.avgKmh) || obs.avgKmh < 0 || obs.avgKmh > 250) return { kind: "implausible" };
  return { kind: "ok", yes: obs.avgKmh < event.thresholdKmh, evidence: { avgKmh: obs.avgKmh, vehicles: obs.vehicles, thresholdKmh: event.thresholdKmh, hourStart } };
}

function strikeReading(event: StrikeEvent, input: ResolveInput): Reading {
  if (!input.strike) return { kind: "none" };
  return { kind: "ok", yes: input.strike.present, evidence: { present: input.strike.present ? 1 : 0, date: event.date } };
}

function quakeReading(event: QuakeEvent, input: ResolveInput): Reading {
  const q = input.quake;
  if (!q) return { kind: "none" };
  if (!Number.isFinite(q.count) || q.count < 0) return { kind: "implausible" };
  return { kind: "ok", yes: q.count > 0, evidence: { count: q.count, maxMag: q.maxMag ?? 0, minMag: event.minMag } };
}

function rainReading(event: RainEvent, input: ResolveInput): Reading {
  const hourStart = Math.floor(event.targetAt / HOUR) * HOUR;
  const obs = input.weather.find((w) => w.feedId === event.feedId && w.hourStart === hourStart);
  if (!obs || (obs.fetchedAt !== undefined && obs.fetchedAt < hourStart + HOUR)) return { kind: "none" };
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
