// Turning static GTFS rows into what the "near me" tables hold. Pure, so the loader script and the tests share it.
import type { CityConfig, FeedConfig } from "./cities.ts";
import { usableFeeds } from "./cities.ts";
import { validPoint } from "./geo.ts";
import { nearbySupport, type NearbySupport, type TimetableCell } from "./nearby.ts";
import { parseGtfsTime } from "./time.ts";

export interface StopRecord { feed_id: string; stop_id: string; name: string; lat: number; lon: number; city_id: string }
export interface RouteRecord { feed_id: string; route_id: string; short_name: string; long_name: string; route_type: number | null }

type Row = Record<string, string | undefined>;

/** A row of stops.txt as a stop to keep, or null when it is not a place a vehicle stops at (entrances, nodes) or has no usable position. */
export function stopRecord(row: Row, feedId: string, cityId: string): StopRecord | null {
  const id = row.stop_id?.trim(), name = row.stop_name?.trim();
  if (!id || !name) return null;
  const type = (row.location_type ?? "").trim();
  if (type !== "" && type !== "0") return null; // 1 station, 2 entrance, 3 node, 4 boarding area
  const lat = Number(row.stop_lat), lon = Number(row.stop_lon);
  if (!row.stop_lat || !row.stop_lon || !validPoint(lat, lon)) return null;
  return { feed_id: feedId, stop_id: id, name: name.slice(0, 120), lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6, city_id: cityId };
}

export function routeRecord(row: Row, feedId: string): RouteRecord | null {
  const id = row.route_id?.trim();
  if (!id) return null;
  const type = Number(row.route_type);
  return { feed_id: feedId, route_id: id, short_name: (row.route_short_name ?? "").trim().slice(0, 40), long_name: (row.route_long_name ?? "").trim().slice(0, 120), route_type: Number.isInteger(type) ? type : null };
}

/** Adds one stop_times row to the per-stop lists. Returns false when the row has no usable time or number. */
export function addDeparture(byStop: Map<string, TimetableCell[]>, st: Row, trip: { routeId: string; headsign: string }): boolean {
  const stopId = st.stop_id, tripId = st.trip_id, seq = Number(st.stop_sequence);
  const t = st.arrival_time || st.departure_time;
  if (!stopId || !tripId || !t || !Number.isInteger(seq)) return false;
  let secs: number;
  try { secs = parseGtfsTime(t); } catch { return false; }
  const cell: TimetableCell = [tripId, seq, secs, trip.routeId, trip.headsign];
  const list = byStop.get(stopId);
  if (list) list.push(cell); else byStop.set(stopId, [cell]);
  return true;
}

export interface DepartureRow { feed_id: string; stop_id: string; service_date: string; trips: TimetableCell[]; loaded_at: string }

/** The gtfs_departures rows of one service day, each stop's list in time order. */
export function departureRows(feedId: string, date: string, byStop: Map<string, TimetableCell[]>, loadedAt: string): DepartureRow[] {
  return [...byStop].map(([stop_id, trips]) => ({ feed_id: feedId, stop_id, service_date: date, trips: trips.sort((a, b) => a[2] - b[2] || a[1] - b[1]), loaded_at: loadedAt }));
}

export interface NearbyFeed { city: CityConfig; feed: FeedConfig; support: NearbySupport }

/** Every feed the "near me" tables are kept for: usable (licence read, category on), one entry per feed id even when several cities list it, and only those the functions can serve. */
export function nearbyFeeds(cities: readonly CityConfig[]): NearbyFeed[] {
  const seen = new Set<string>(), out: NearbyFeed[] = [];
  for (const city of cities) {
    for (const feed of usableFeeds(city, false)) {
      const support = nearbySupport(feed);
      if (!support || seen.has(feed.id)) continue;
      seen.add(feed.id);
      out.push({ city, feed, support });
    }
  }
  return out;
}
