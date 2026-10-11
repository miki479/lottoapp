// Build the day's markets from a city's static GTFS and (optionally) write them to Supabase.
//
//   node scripts/generate-markets.mjs --city tokyo --feed toei-bus-vehicle --gtfs-dir ./gtfs/toei [--max 30] [--apply]
//   node scripts/generate-markets.mjs --city tokyo --weather [--apply]
//
// Without --gtfs-dir the feed's staticGtfsUrl is downloaded and unzipped to a temp dir.
// Without --apply it only prints what it would create. Needs SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY for --apply and for reading odds history.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { validateCity } from "../shared/cities.ts";
import { activeServiceIds, buildDelayMarket, buildWeatherMarkets, localYmd, pickTargetStop, seededRandom } from "../shared/generator.ts";
import { historyKey } from "../shared/market.ts";
import { marketToEvent } from "../shared/market.ts";
import { readAll, readTable } from "./lib-csv.mjs";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]?.startsWith("--") || all[i + 1] === undefined ? true : all[i + 1]]] : acc), []));
const city = validateCity(JSON.parse(readFileSync(new URL(`../cities/${args.city}.json`, import.meta.url), "utf8")));
const now = Number(args.now ?? Math.floor(Date.now() / 1000));
const max = Number(args.max ?? 30);
const SB = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function sb(path, init = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal", ...(init.headers ?? {}) } });
  if (!r.ok) throw new Error(`Supabase ${path}: ${r.status} ${await r.text()}`);
  return r.status === 204 || init.method === "POST" ? null : r.json();
}

async function historyLookup() {
  if (!SB || !KEY) return () => null;
  const rows = await sb(`odds_history?city_id=eq.${city.id}&select=kind,route_id,hour_of_day,threshold,n,yes`);
  const m = new Map(rows.map((r) => [`${r.kind}|${r.route_id}|${r.hour_of_day}|${r.threshold}`, { n: r.n, yes: r.yes }]));
  return (k) => m.get(`${k.kind}|${k.routeId}|${k.hourOfDay}|${k.threshold}`) ?? null;
}

async function gtfsDir(feed) {
  if (args["gtfs-dir"]) return args["gtfs-dir"];
  if (!feed.staticGtfsUrl) throw new Error(`feed ${feed.id} has no staticGtfsUrl: pass --gtfs-dir`);
  const res = await fetch(feed.staticGtfsUrl, { redirect: "follow", signal: AbortSignal.timeout(300000) });
  if (!res.ok) throw new Error(`GTFS download failed: ${res.status}`);
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
  const dir = mkdtempSync(join(tmpdir(), "gtfs-"));
  for (const [name, bytes] of Object.entries(files)) if (name.endsWith(".txt")) writeFileSync(join(dir, name.replaceAll("/", "_")), bytes);
  return dir;
}

async function delayMarkets(feed) {
  const dir = await gtfsDir(feed);
  const { ymd } = localYmd(now, city.timezone);
  const { weekday } = localYmd(now, city.timezone);
  const services = activeServiceIds(ymd, weekday, await readAll(join(dir, "calendar.txt")).catch(() => []), await readAll(join(dir, "calendar_dates.txt")).catch(() => []));
  const routes = new Map();
  for (const r of await readAll(join(dir, "routes.txt"))) {
    if (feed.routeTypes && !feed.routeTypes.includes(Number(r.route_type || 3))) continue;
    routes.set(r.route_id, r.route_short_name || r.route_long_name || r.route_id);
  }
  const trips = (await readAll(join(dir, "trips.txt"))).filter((t) => services.has(t.service_id) && routes.has(t.route_id));
  console.error(`[${feed.id}] ${ymd}: ${services.size} services, ${routes.size} routes, ${trips.length} trips today`);
  if (trips.length === 0) return { markets: [], schedule: [] };

  // Sample candidates deterministically, then read stop_times only for them.
  const rand = seededRandom(`${city.id}-${feed.id}-${ymd}`);
  const shuffled = trips.map((t) => [rand(), t]).sort((a, b) => a[0] - b[0]).map((x) => x[1]).slice(0, max * 6);
  const wanted = new Map(shuffled.map((t) => [t.trip_id, t]));
  const byTrip = new Map();
  for await (const st of readTable(join(dir, "stop_times.txt"))) {
    if (!wanted.has(st.trip_id)) continue;
    const arr = byTrip.get(st.trip_id) ?? [];
    arr.push({ seq: Number(st.stop_sequence), stopId: st.stop_id, time: st.arrival_time || st.departure_time, timepoint: st.timepoint === "1" });
    byTrip.set(st.trip_id, arr);
  }
  const stopNames = new Map();
  for (const s of await readAll(join(dir, "stops.txt"))) stopNames.set(s.stop_id, s.stop_name);
  const hist = await historyLookup();
  const markets = [], schedule = [];
  const threshold = feed.category === "train" ? 300 : 180;
  for (const trip of shuffled) {
    if (markets.length >= max) break;
    const stops = (byTrip.get(trip.trip_id) ?? []).filter((s) => s.time).sort((a, b) => a.seq - b.seq);
    const stop = pickTargetStop(stops, rand);
    if (!stop) continue;
    const draft = buildDelayMarket({ cityId: city.id, tz: city.timezone, feedId: feed.id, category: feed.category, routeId: trip.route_id, routeName: routes.get(trip.route_id), headsign: trip.trip_headsign, tripId: trip.trip_id, stop, stopName: stopNames.get(stop.stopId) ?? stop.stopId, serviceDayEpoch: now, thresholdSec: threshold, history: null });
    const targetAt = Date.parse(draft.target_at) / 1000;
    if (Date.parse(draft.closes_at) / 1000 <= now + 300 || targetAt > now + 20 * 3600) continue; // bettable window
    // Re-price with real history now that the event exists.
    const key = historyKey(marketToEvent({ ...draft, id: "x" }), city.timezone);
    const priced = buildDelayMarket({ ...{ cityId: city.id, tz: city.timezone, feedId: feed.id, category: feed.category, routeId: trip.route_id, routeName: routes.get(trip.route_id), headsign: trip.trip_headsign, tripId: trip.trip_id, stop, stopName: stopNames.get(stop.stopId) ?? stop.stopId, serviceDayEpoch: now, thresholdSec: threshold }, history: hist(key) });
    markets.push(priced);
    if (feed.kind === "vehicle_positions") {
      const sd = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
      for (const s of stops) schedule.push({ feed_id: feed.id, trip_id: trip.trip_id, stop_sequence: s.seq, stop_id: s.stopId, scheduled_time: s.time, service_date: sd });
    }
  }
  return { markets, schedule };
}

let markets = [], schedule = [];
if (args.weather) {
  const feed = city.feeds.find((f) => f.category === "weather");
  if (!feed) throw new Error(`${city.id} has no weather feed`);
  markets = buildWeatherMarkets({ cityId: city.id, tz: city.timezone, feedId: feed.id, nowEpoch: now, localHours: [8, 12, 15, 18, 21] });
} else {
  const feed = city.feeds.find((f) => f.id === args.feed);
  if (!feed) throw new Error(`--feed must be one of: ${city.feeds.map((f) => f.id).join(", ")}`);
  ({ markets, schedule } = await delayMarkets(feed));
}
console.error(`${markets.length} markets, ${schedule.length} schedule rows`);
console.log(JSON.stringify({ markets: markets.slice(0, args.apply ? 0 : 5), scheduleSample: schedule.slice(0, 2) }, null, 2));
if (args.apply) {
  if (!SB || !KEY) throw new Error("--apply needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  for (let i = 0; i < schedule.length; i += 500) await sb("trip_schedule", { method: "POST", body: JSON.stringify(schedule.slice(i, i + 500)) });
  if (markets.length) await sb("markets", { method: "POST", body: JSON.stringify(markets) });
  console.error("applied");
}
