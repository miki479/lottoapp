// "What is about to pass near me": the pure part (request checking, arrivals from a decoded GTFS-RT feed, the market a player
// can open from one arrival, a rate limiter). The Edge Functions `nearby` and `stop-offer` and the loader script wrap it.
import { isStopSkipped, isTripGone, tripIdOf } from "./adapters/gtfsrt.ts";
import type { RtFeed } from "./adapters/types.ts";
import type { FeedConfig } from "./cities.ts";
import { delayFromTripUpdate, MAX_EARLY_SEC, MAX_LATE_SEC } from "./delay.ts";
import { roundCoord, validPoint } from "./geo.ts";
import { buildDelayMarket, type MarketInsert } from "./generator.ts";
import { computeOdds, liveYesProbability, yesProbability, type History } from "./odds.ts";
import { gtfsDayStart, zonedEpoch } from "./time.ts";

export const MAX_STOPS = 3;
export const MAX_RADIUS_M = 250;
export const MIN_RADIUS_M = 30;
/** Arrivals are listed up to this far ahead. */
export const HORIZON_SEC = 45 * 60;
/** A bus that is just leaving is still listed for a minute. */
export const GRACE_SEC = 60;
/** A market can be opened from an arrival when its scheduled time is this far away (closing comes a little before it). */
export const OFFER_MIN_LEAD_SEC = 5 * 60;
export const OFFER_MAX_LEAD_SEC = 60 * 60;
/** Bets on a nearby question close this long before the scheduled time (the house questions close 10 minutes before: too early for someone already at the stop). */
export const NEARBY_CLOSE_BEFORE_SEC = 3 * 60;
export const MAX_ARRIVALS = 12;
export const MAX_ARRIVALS_PER_STOP = 6;
export const NEARBY_PER_USER_PER_DAY = 8;
export const NEARBY_OPEN_PER_USER = 4;

/** How a feed can feed this: "direct" = its TripUpdates name the stop and give a time; "timetable" = they only number the stops, so the stop's timetable (table gtfs_departures) is needed too. */
export type NearbySupport = "direct" | "timetable";

export function nearbySupport(feed: FeedConfig): NearbySupport | null {
  if (feed.type !== "gtfs-rt" || !feed.staticGtfsUrl || feed.heavy) return null; // heavy feeds are too big to decode on demand
  if (feed.kind === "trip_updates") return "direct";
  if ((feed.kind === "trip_updates_seq" || feed.kind === "trip_updates_times") && feed.nearbyTimetable && !feed.tripKey) return "timetable";
  return null; // position-only feeds have no arrivals
}

export interface NearbyRequest { lat: number; lon: number; radiusM: number }

/** The request body, checked and rounded to a ~100 m grid (the server never works with anything finer). Null when it is not a usable position. */
export function parseNearbyRequest(body: unknown): NearbyRequest | null {
  const b = body as { lat?: unknown; lon?: unknown; radiusM?: unknown } | null;
  if (!b || typeof b !== "object" || !validPoint(b.lat, b.lon)) return null;
  const r = typeof b.radiusM === "number" && Number.isFinite(b.radiusM) ? Math.round(b.radiusM) : MAX_RADIUS_M;
  return { lat: roundCoord(b.lat as number), lon: roundCoord(b.lon as number), radiusM: Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, r)) };
}

/** Sliding-window limiter by key (the user id). Kept in the memory of one function instance; `nearby_hit` in the database is the shared counter. */
export function createRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    /** True when the call is allowed (and counted). */
    hit(key: string, nowMs: number): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => t > nowMs - windowMs);
      if (recent.length >= max) { hits.set(key, recent); return false; }
      recent.push(nowMs);
      hits.set(key, recent);
      // idle keys are dropped now and then so the map cannot grow without bound
      if (hits.size > 2000) for (const [k, v] of hits) if (!v.some((t) => t > nowMs - windowMs)) hits.delete(k);
      return true;
    },
  };
}

// ---- timetable (feeds whose TripUpdates only number the stops) ----

/** One scheduled stop of a trip at a stop, as stored in gtfs_departures.trips: [tripId, stopSequence, seconds after the service day start, routeId, headsign]. */
export type TimetableCell = [string, number, number, string, string];

export interface ScheduledStop { tripId: string; stopId: string; seq: number; at: number; routeId: string; headsign: string; date: string; secs: number }

/** The start of a GTFS service day given its date ("YYYY-MM-DD"). */
export const serviceDayStart = (date: string, tz: string) => gtfsDayStart(zonedEpoch(date, 12 * 3600, tz), tz);

/** The service day an instant can be written against, with the seconds after its start (never negative, also on days when the clocks change). */
export function serviceDayOf(epoch: number, tz: string): { dayEpoch: number; secs: number } {
  const start = gtfsDayStart(epoch, tz);
  if (epoch >= start) return { dayEpoch: epoch, secs: epoch - start };
  const before = epoch - 12 * 3600;
  return { dayEpoch: before, secs: epoch - gtfsDayStart(before, tz) };
}

export const hms = (secs: number) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(secs / 3600))}:${p(Math.floor((secs % 3600) / 60))}:${p(secs % 60)}`;
};

/** Rows of gtfs_departures into scheduled stops with their epoch time. Cells that are not what the loader writes are skipped. */
export function decodeTimetable(rows: { stop_id: string; service_date: string; trips: unknown }[], tz: string): ScheduledStop[] {
  const out: ScheduledStop[] = [];
  for (const r of rows) {
    if (!Array.isArray(r.trips)) continue;
    const start = serviceDayStart(r.service_date, tz);
    for (const c of r.trips as unknown[]) {
      if (!Array.isArray(c) || typeof c[0] !== "string" || !Number.isInteger(c[1]) || !Number.isInteger(c[2])) continue;
      out.push({ tripId: c[0], stopId: r.stop_id, seq: c[1] as number, at: start + (c[2] as number), routeId: typeof c[3] === "string" ? c[3] : "", headsign: typeof c[4] === "string" ? c[4] : "", date: r.service_date, secs: c[2] as number });
    }
  }
  return out;
}

// ---- arrivals from a decoded real-time feed ----

export interface RawArrival {
  tripId: string;
  routeId: string;
  headsign: string;
  stopId: string;
  stopSequence: number | null;
  /** When the vehicle is expected (epoch seconds). */
  predictedAt: number;
  /** The timetable time, when it is known: predicted minus delay, or the timetable itself. */
  scheduledAt: number | null;
  delaySec: number | null;
  /** Service date and seconds after its start, when the timetable gave them (needed to write the trip's schedule row). */
  date: string | null;
  secs: number | null;
}

type Stu = NonNullable<NonNullable<NonNullable<RtFeed["entity"]>[number]["tripUpdate"]>["stopTimeUpdate"]>[number];

const time = (v: number | string | null | undefined): number | null => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
};
const predictedOf = (stu: Stu) => time(stu.arrival?.time) ?? time(stu.departure?.time);
/** NO_DATA: the feed says it knows nothing about this stop. */
const noData = (v: number | string | null | undefined) => v === 2 || v === "NO_DATA";
const usable = (stu: Stu) => !isStopSkipped(stu.scheduleRelationship) && !noData(stu.scheduleRelationship);

export interface ArrivalOptions {
  kind: string | undefined;
  stopIds: ReadonlySet<string>;
  now: number;
  tripKey?: "route_dir_start";
  /** Scheduled stops at the wanted stops (for feeds that only number their stops). */
  timetable?: readonly ScheduledStop[];
  horizonSec?: number;
  graceSec?: number;
}

/**
 * The vehicles the feed expects at the wanted stops soon. Only what the resolver could later read is returned: a trip the feed lists at
 * that stop with a time (or, for feeds that number their stops, an explicit delay on that very stop number). Cancelled trips and skipped
 * stops are left out. Soonest first.
 */
export function extractArrivals(feed: RtFeed, o: ArrivalOptions): RawArrival[] {
  const from = o.now - (o.graceSec ?? GRACE_SEC), to = o.now + (o.horizonSec ?? HORIZON_SEC);
  const out: RawArrival[] = [];
  const keep = (a: RawArrival) => { if (a.predictedAt >= from && a.predictedAt <= to) out.push(a); };

  if (o.kind === "trip_updates") {
    for (const e of feed.entity ?? []) {
      const tu = e.tripUpdate, tripId = tripIdOf(tu?.trip, o.tripKey);
      if (!tu || !tripId || isTripGone(tu.trip?.scheduleRelationship)) continue;
      for (const stu of tu.stopTimeUpdate ?? []) {
        if (!stu.stopId || !o.stopIds.has(stu.stopId) || !usable(stu)) continue;
        const predictedAt = predictedOf(stu);
        if (predictedAt === null) continue; // the adapter ignores a stop without a time too: it could never settle a question
        const delaySec = delayFromTripUpdate(stu);
        keep({ tripId, routeId: tu.trip?.routeId ?? "", headsign: "", stopId: stu.stopId, stopSequence: stu.stopSequence ?? null, predictedAt, scheduledAt: delaySec === null ? null : predictedAt - delaySec, delaySec, date: null, secs: null });
      }
    }
  } else if (o.kind === "trip_updates_seq" || o.kind === "trip_updates_times") {
    // the stops of the timetable that are close in time, matched to what the feed says about those trips
    const wanted = new Map<string, ScheduledStop[]>();
    for (const s of o.timetable ?? []) {
      // scheduled up to 45 minutes ago (a late vehicle) or a quarter of an hour past the horizon (an early one)
      if (s.at < o.now - MAX_LATE_SEC / 4 || s.at > to - MAX_EARLY_SEC) continue;
      const list = wanted.get(s.tripId);
      if (list) list.push(s); else wanted.set(s.tripId, [s]);
    }
    for (const e of feed.entity ?? []) {
      const tu = e.tripUpdate, tripId = tripIdOf(tu?.trip, o.tripKey);
      if (!tu || !tripId || isTripGone(tu.trip?.scheduleRelationship)) continue;
      for (const s of wanted.get(tripId) ?? []) {
        const stu = (tu.stopTimeUpdate ?? []).find((x) => (x.stopSequence != null ? x.stopSequence === s.seq : x.stopId != null && x.stopId === s.stopId));
        if (!stu || !usable(stu) || (stu.stopId && stu.stopId !== s.stopId)) continue; // a different stop id means the trip was re-routed
        let predictedAt: number | null, delaySec: number | null;
        if (o.kind === "trip_updates_seq") {
          delaySec = delayFromTripUpdate(stu);
          predictedAt = delaySec === null ? null : s.at + delaySec;
        } else {
          predictedAt = predictedOf(stu);
          delaySec = predictedAt === null ? null : predictedAt - s.at;
          if (delaySec !== null && (delaySec < MAX_EARLY_SEC || delaySec > MAX_LATE_SEC)) continue;
        }
        if (predictedAt === null) continue;
        keep({ tripId, routeId: s.routeId || (tu.trip?.routeId ?? ""), headsign: s.headsign, stopId: s.stopId, stopSequence: s.seq, predictedAt, scheduledAt: s.at, delaySec, date: s.date, secs: s.secs });
      }
    }
  }
  const seen = new Set<string>();
  return out.sort((a, b) => a.predictedAt - b.predictedAt).filter((a) => { const k = `${a.tripId}|${a.stopId}|${a.stopSequence ?? ""}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

/** True when a market can still be opened for a vehicle scheduled at this time. */
export const offerWindowOk = (scheduledAt: number | null, now: number): boolean =>
  scheduledAt !== null && scheduledAt - now >= OFFER_MIN_LEAD_SEC && scheduledAt - now <= OFFER_MAX_LEAD_SEC;

// ---- the market opened from one arrival ----

export interface StopMarketArgs {
  cityId: string;
  tz: string;
  feedId: string;
  category: "bus" | "train";
  routeId: string;
  routeName: string;
  headsign: string;
  tripId: string;
  stopId: string;
  stopName: string;
  stopLat: number;
  stopLon: number;
  stopSequence: number | null;
  /** Timetable time of the vehicle at the stop; with `date`/`secs` from the timetable the service day is exact. */
  scheduledAt: number;
  date?: string | null;
  secs?: number | null;
  /** The delay the feed predicts for this stop right now: a market opened for a bus already running late must not be priced as if nothing was known. */
  delaySec: number | null;
  history: History | null;
  priorYes: number;
  occBonus?: boolean;
  posEst?: boolean;
  now: number;
}

/** The dedupe key of generate-markets, so a question made here and one made by the generator for the same trip, stop and time are one question. */
export const delayDedupeKey = (m: Pick<MarketInsert, "city_id" | "kind" | "feed_id" | "params" | "target_at">) =>
  [m.city_id, m.kind, m.feed_id, m.params.tripId ?? "", m.params.stopId ?? "", Math.floor(Date.parse(m.target_at) / 1000)].join("|");

export function buildStopMarket(a: StopMarketArgs): MarketInsert & { dedupe_key: string } {
  const exact = a.date && a.secs != null;
  const day = exact ? { dayEpoch: zonedEpoch(a.date!, 12 * 3600, a.tz), secs: a.secs! } : serviceDayOf(a.scheduledAt, a.tz);
  const thresholdSec = a.category === "train" ? 300 : 180;
  const base = buildDelayMarket({
    cityId: a.cityId, tz: a.tz, feedId: a.feedId, category: a.category, routeId: a.routeId, routeName: a.routeName, headsign: a.headsign, tripId: a.tripId,
    stop: { seq: a.stopSequence ?? 0, stopId: a.stopId, time: hms(day.secs), timepoint: true }, stopName: a.stopName, serviceDayEpoch: day.dayEpoch,
    thresholdSec, history: a.history, priorYes: a.priorYes,
  });
  const targetAt = Date.parse(base.target_at) / 1000;
  const pHist = yesProbability(a.history, a.priorYes);
  const minutes = Math.max(0, (targetAt - a.now) / 60);
  const p = a.delaySec === null ? pHist : liveYesProbability(pHist, a.delaySec, thresholdSec, Math.min(15, Math.max(1, Math.round(minutes / 2))), a.category === "train");
  const odds = computeOdds(p);
  const params: Record<string, unknown> = { ...base.params, nearby: true, pPrior: Math.round(a.priorYes * 1000) / 1000, stopLat: a.stopLat, stopLon: a.stopLon };
  if (a.stopSequence === null) delete params.stopSequence;
  if (a.posEst) params.posEst = true;
  if (a.occBonus && base.kind === "bus_delay_gt") params.occBonus = true;
  const out = { ...base, params, closes_at: new Date((targetAt - NEARBY_CLOSE_BEFORE_SEC) * 1000).toISOString(), odds_yes: odds.yes, odds_no: odds.no };
  return { ...out, dedupe_key: delayDedupeKey(out) };
}
