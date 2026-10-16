import { computeOdds, yesProbability, type History } from "./odds.ts";
import { addDays, localDateString, zonedEpoch } from "./time.ts";

/** One road measuring station of a traffic feed, as listed in the city file. */
export interface TrafficStation {
  /** Id in the provider's system. */
  id: string | number;
  /** Short name shown in the question ("Länsiväylä, Keilaniemi"). */
  name: string;
  /** Where each direction leads ("Helsinki", "Espoo"). */
  toward: [string, string];
  /** Typical free-flow speed per direction (km/h), measured at night: the question asks about falling well below it. */
  freeKmh: [number, number];
}

/** What a provider tells us about one direction of one station for the current hour. */
export interface TrafficReading {
  direction: 1 | 2;
  /** Average speed over the fixed 60-minute window (km/h). */
  avgKmh: number;
  /** Vehicles counted in the same window. */
  vehicles: number;
  /** Start of that window (epoch seconds). */
  windowStart: number;
  /** When the provider last updated the value (epoch seconds). */
  measuredAt: number;
}

interface DtSensor { name?: string; value?: number | null; timeWindowStart?: string | null; measuredTime?: string | null }

/**
 * Digitraffic (Finland) TMS station data → one reading per direction.
 * Uses the fixed 60-minute average speed: its window starts on the hour, so the value read just before the hour ends is the hour's average.
 */
export function parseDigitrafficTms(json: unknown): TrafficReading[] {
  const sensors = (json as { sensorValues?: DtSensor[] } | null)?.sensorValues;
  if (!Array.isArray(sensors)) return [];
  const by = new Map(sensors.map((s) => [String(s.name), s]));
  const out: TrafficReading[] = [];
  for (const d of [1, 2] as const) {
    const sp = by.get(`KESKINOPEUS_60MIN_KIINTEA_SUUNTA${d}`), ct = by.get(`OHITUKSET_60MIN_KIINTEA_SUUNTA${d}`);
    const ws = Date.parse(String(sp?.timeWindowStart ?? "")) / 1000, ms = Date.parse(String(sp?.measuredTime ?? "")) / 1000;
    if (typeof sp?.value !== "number" || !Number.isFinite(ws) || !Number.isFinite(ms)) continue;
    out.push({ direction: d, avgKmh: sp.value, vehicles: typeof ct?.value === "number" ? ct.value : 0, windowStart: ws, measuredAt: ms });
  }
  return out;
}

/** A reading only settles a question if the hour was (nearly) over when it was taken and enough vehicles drove past. */
export const MIN_WINDOW_SEC = 55 * 60;
export const MIN_VEHICLES = 5;

/** "Congested" = average speed under 75% of the free-flow speed, rounded to 5 km/h. */
export const thresholdKmh = (freeKmh: number): number => Math.max(5, Math.round((freeKmh * 0.75) / 5) * 5);

/** Rush hours worth a question (local time), and the prior chance of falling under the threshold then (an estimate until history exists). */
export const RUSH_HOURS: Record<number, number> = { 8: 0.4, 17: 0.4 };

export interface TrafficMarketInsert {
  city_id: string; category: "traffic"; kind: "traffic_speed_lt"; feed_id: string;
  params: { siteId: string; siteName: string; direction: 1 | 2; toward: string; thresholdKmh: number; freeKmh: number; localHour: number };
  closes_at: string; target_at: string; deadline_at: string; odds_yes: number; odds_no: number; dedupe_key: string;
}

/** One question per station, direction and rush hour of today and tomorrow that is still open. `history(site|dir, hour, threshold)` feeds the odds when available. */
export function buildTrafficMarkets(o: {
  cityId: string; feedId: string; tz: string; nowEpoch: number; stations: TrafficStation[];
  history?: (key: string, hour: number, threshold: number) => History | null;
}): TrafficMarketInsert[] {
  const out: TrafficMarketInsert[] = [];
  const today = localDateString(o.nowEpoch, o.tz), days = [today, addDays(today, 1)];
  for (const day of days) {
    for (const st of o.stations) {
      for (const dir of [1, 2] as const) {
        const free = st.freeKmh[dir - 1]!, thr = thresholdKmh(free);
        for (const [hStr, prior] of Object.entries(RUSH_HOURS)) {
          const h = Number(hStr), hourStart = zonedEpoch(day, h * 3600, o.tz);
          const target = hourStart + 1800;
          if (target - 600 <= o.nowEpoch + 300) continue;
          const p = yesProbability(o.history?.(`${st.id}|${dir}`, h, thr) ?? null, prior);
          const odds = computeOdds(p);
          out.push({
            city_id: o.cityId, category: "traffic", kind: "traffic_speed_lt", feed_id: o.feedId,
            params: { siteId: String(st.id), siteName: st.name, direction: dir, toward: st.toward[dir - 1]!, thresholdKmh: thr, freeKmh: free, localHour: h },
            closes_at: new Date((target - 600) * 1000).toISOString(), target_at: new Date(target * 1000).toISOString(),
            deadline_at: new Date((hourStart + 3600 + 4 * 3600) * 1000).toISOString(),
            odds_yes: odds.yes, odds_no: odds.no, dedupe_key: `${o.feedId}|${st.id}|${dir}|${hourStart}`,
          });
        }
      }
    }
  }
  return out;
}
