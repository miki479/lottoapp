import { computeOdds, DEFAULT_YES_PROBABILITY, yesProbability, type History } from "./odds.ts";
import { localDayStart, parseGtfsTime, tzOffsetSec } from "./time.ts";

export interface CalendarRow {
  service_id: string;
  monday: string; tuesday: string; wednesday: string; thursday: string; friday: string; saturday: string; sunday: string;
  start_date: string; end_date: string;
}
export interface CalendarDateRow { service_id: string; date: string; exception_type: string }
export interface StopTimeRow { seq: number; stopId: string; time: string; timepoint: boolean }

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

/** Local calendar date as "YYYYMMDD" and weekday (0 = Sunday) for an instant in `tz`. */
export function localYmd(epochSec: number, tz: string): { ymd: string; weekday: number } {
  const d = new Date((epochSec + tzOffsetSec(epochSec, tz)) * 1000);
  return { ymd: d.toISOString().slice(0, 10).replaceAll("-", ""), weekday: d.getUTCDay() };
}

/** Service ids running on a given date, following GTFS calendar.txt + calendar_dates.txt. */
export function activeServiceIds(ymd: string, weekday: number, calendar: CalendarRow[], dates: CalendarDateRow[]): Set<string> {
  const active = new Set<string>();
  for (const c of calendar) {
    if (c.start_date <= ymd && ymd <= c.end_date && c[DAY_NAMES[weekday]!] === "1") active.add(c.service_id);
  }
  for (const d of dates) {
    if (d.date !== ymd) continue;
    if (d.exception_type === "1") active.add(d.service_id);
    else if (d.exception_type === "2") active.delete(d.service_id);
  }
  return active;
}

/** Small deterministic PRNG so the same day always yields the same market list. */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a stop in the middle half of the trip, preferring timepoints (where schedules are meaningful). */
export function pickTargetStop(stops: StopTimeRow[], rand: () => number): StopTimeRow | null {
  if (stops.length < 4) return null;
  const lo = Math.floor(stops.length * 0.25);
  const hi = Math.ceil(stops.length * 0.75);
  const middle = stops.slice(lo, hi);
  const pool = middle.some((s) => s.timepoint) ? middle.filter((s) => s.timepoint) : middle;
  return pool[Math.floor(rand() * pool.length)] ?? null;
}

export interface MarketInsert {
  city_id: string;
  category: "bus" | "train" | "weather";
  kind: "bus_delay_gt" | "train_delay_gt" | "rain_at";
  feed_id: string;
  params: Record<string, unknown>;
  closes_at: string;
  target_at: string;
  deadline_at: string;
  odds_yes: number;
  odds_no: number;
}

const iso = (e: number) => new Date(e * 1000).toISOString();
const CLOSE_BEFORE_SEC = 10 * 60;
const DEADLINE_AFTER_SEC = 30 * 60;

export interface DelayMarketArgs {
  cityId: string;
  tz: string;
  feedId: string;
  category: "bus" | "train";
  routeId: string;
  routeName: string;
  headsign: string;
  tripId: string;
  stop: StopTimeRow;
  stopName: string;
  serviceDayEpoch: number;
  thresholdSec: number;
  history: History | null;
  flashMultiplier?: number;
}

export function buildDelayMarket(a: DelayMarketArgs): MarketInsert {
  const kind = a.category === "bus" ? "bus_delay_gt" : "train_delay_gt";
  const targetAt = localDayStart(a.serviceDayEpoch, a.tz) + parseGtfsTime(a.stop.time);
  const odds = computeOdds(yesProbability(a.history, DEFAULT_YES_PROBABILITY[kind]), a.flashMultiplier ?? 1);
  return {
    city_id: a.cityId,
    category: a.category,
    kind,
    feed_id: a.feedId,
    params: {
      routeId: a.routeId, routeName: a.routeName, headsign: a.headsign, tripId: a.tripId,
      stopId: a.stop.stopId, stopName: a.stopName, stopSequence: a.stop.seq,
      scheduledTime: a.stop.time, thresholdSec: a.thresholdSec,
    },
    closes_at: iso(targetAt - CLOSE_BEFORE_SEC),
    target_at: iso(targetAt),
    deadline_at: iso(targetAt + DEADLINE_AFTER_SEC),
    odds_yes: odds.yes,
    odds_no: odds.no,
  };
}

/** Rain markets for the given local hours of the local day containing `nowEpoch`, only those still open. */
export function buildWeatherMarkets(opts: {
  cityId: string; tz: string; feedId: string; nowEpoch: number; localHours: number[]; history?: (hour: number) => History | null; minMm?: number;
}): MarketInsert[] {
  const dayStart = localDayStart(opts.nowEpoch, opts.tz);
  const out: MarketInsert[] = [];
  for (const h of opts.localHours) {
    const targetAt = dayStart + h * 3600 + 1800; // mid-hour, the answer comes from the whole hour
    if (targetAt - CLOSE_BEFORE_SEC <= opts.nowEpoch) continue;
    const odds = computeOdds(yesProbability(opts.history?.(h) ?? null, DEFAULT_YES_PROBABILITY.rain_at));
    out.push({
      city_id: opts.cityId, category: "weather", kind: "rain_at", feed_id: opts.feedId,
      params: { minMm: opts.minMm ?? 0.1, localHour: h },
      closes_at: iso(targetAt - CLOSE_BEFORE_SEC),
      target_at: iso(targetAt),
      deadline_at: iso(Math.floor(targetAt / 3600) * 3600 + 3600 + 4 * 3600),
      odds_yes: odds.yes, odds_no: odds.no,
    });
  }
  return out;
}
