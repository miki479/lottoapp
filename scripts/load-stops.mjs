// Loads the stops and routes of every real-time feed the "near me" functions can serve into Supabase (and, for feeds marked
// "nearbyTimetable", the stops' timetable for the next days). Idempotent: rows are upserted, and what a feed no longer lists is removed
// only after the new rows are in. Run daily (.github/workflows/markets.yml).
//
//   node scripts/load-stops.mjs [--feed start-trip-updates] [--gtfs-dir ./gtfs/start] [--days 3] [--now <epoch>] [--apply]
//
// Without --apply it only reads the feeds and prints what it would write. --apply needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { validateCity } from "../shared/cities.ts";
import { activeServiceIds } from "../shared/generator.ts";
import { addDays, localDateString } from "../shared/time.ts";
import { addDeparture, departureRows, nearbyFeeds, routeRecord, stopRecord } from "../shared/stops.ts";
import { supabaseUrl } from "./lib-env.mjs";
import { readAll } from "./lib-csv.mjs";
import { downloadGtfs, stopTimes } from "./lib-gtfs.mjs";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]?.startsWith("--") || all[i + 1] === undefined ? true : all[i + 1]]] : acc), []));
const SB = supabaseUrl(), KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const now = Number(args.now ?? Math.floor(Date.now() / 1000));
const days = Math.min(5, Math.max(1, Number(args.days ?? 3)));
const apply = args.apply === true;
if (apply && (!SB || !KEY)) throw new Error("--apply needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

async function sb(path, init = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal", ...(init.headers ?? {}) } });
  if (!r.ok) throw new Error(`Supabase ${path.split("?")[0]}: ${r.status} ${await r.text()}`);
}
/** Upserts in batches so a request stays small. */
async function upsert(table, onConflict, rows, size) {
  for (let i = 0; i < rows.length; i += size) await sb(`${table}?on_conflict=${onConflict}`, { method: "POST", body: JSON.stringify(rows.slice(i, i + size)) });
}

const cities = readdirSync(new URL("../cities/", import.meta.url)).filter((f) => f.endsWith(".json")).sort()
  .map((f) => validateCity(JSON.parse(readFileSync(new URL(`../cities/${f}`, import.meta.url), "utf8"))));
const feeds = nearbyFeeds(cities).filter((x) => !args.feed || x.feed.id === args.feed);
if (args.feed && feeds.length === 0) throw new Error(`--feed ${args.feed} is not a feed the near-me functions can serve (see nearbySupport in shared/nearby.ts)`);
console.error(`${feeds.length} feeds: ${feeds.map((x) => `${x.feed.id} (${x.support})`).join(", ")}`);

/** Stops and routes of one feed. Returns the number of stops. */
async function loadStopsAndRoutes({ city, feed }, dir, runAt) {
  // keyed by id: one row twice in a batch would make the upsert fail
  const stopsById = new Map(), routesById = new Map();
  for (const r of await readAll(join(dir, "stops.txt"))) { const s = stopRecord(r, feed.id, city.id); if (s) stopsById.set(s.stop_id, s); }
  for (const r of await readAll(join(dir, "routes.txt")).catch(() => [])) {
    if (feed.routeTypes && !feed.routeTypes.includes(Number(r.route_type || 3))) continue;
    const x = routeRecord(r, feed.id); if (x) routesById.set(x.route_id, x);
  }
  const stops = [...stopsById.values()], routes = [...routesById.values()];
  console.error(`[${feed.id}] ${stops.length} stops, ${routes.length} routes`);
  // a download that came back empty or broken must never wipe what is there
  if (stops.length === 0) throw new Error("no usable stops in stops.txt: nothing written");
  if (!apply) return stops.length;
  await upsert("gtfs_stops", "feed_id,stop_id", stops.map((s) => ({ ...s, loaded_at: runAt })), 1000);
  await upsert("gtfs_routes", "feed_id,route_id", routes.map((r) => ({ ...r, loaded_at: runAt })), 1000);
  // what the feed no longer lists (older than this run) goes away only now
  await sb(`gtfs_stops?feed_id=eq.${encodeURIComponent(feed.id)}&loaded_at=lt.${encodeURIComponent(runAt)}`, { method: "DELETE" });
  await sb(`gtfs_routes?feed_id=eq.${encodeURIComponent(feed.id)}&loaded_at=lt.${encodeURIComponent(runAt)}`, { method: "DELETE" });
  return stops.length;
}

/** For feeds whose TripUpdates only number their stops: every scheduled stop of every trip, by stop, for today and the next days (city-local). */
async function loadTimetable({ city, feed }, dir, runAt) {
  const routeIds = new Set();
  for (const r of await readAll(join(dir, "routes.txt"))) if (!feed.routeTypes || feed.routeTypes.includes(Number(r.route_type || 3))) routeIds.add(r.route_id);
  const trips = new Map();
  for (const t of await readAll(join(dir, "trips.txt"))) if (routeIds.has(t.route_id)) trips.set(t.trip_id, { service: t.service_id, routeId: t.route_id, headsign: (t.trip_headsign ?? "").slice(0, 60) });
  const calendar = await readAll(join(dir, "calendar.txt")).catch(() => []), exceptions = await readAll(join(dir, "calendar_dates.txt")).catch(() => []);
  const today = localDateString(now, city.timezone);
  for (let d = 0; d < days; d++) {
    const date = addDays(today, d), ymd = date.replaceAll("-", "");
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const services = activeServiceIds(ymd, weekday, calendar, exceptions);
    const byStop = new Map();
    let rows = 0;
    // one pass over stop_times per day keeps only that day's lists in memory
    for await (const st of stopTimes(dir)) {
      const trip = trips.get(st.trip_id);
      if (trip && services.has(trip.service) && addDeparture(byStop, st, trip)) rows++;
    }
    console.error(`[${feed.id}] ${date}: ${services.size} services, ${rows} scheduled stops at ${byStop.size} stops`);
    if (byStop.size === 0) continue;
    if (!apply) continue;
    await upsert("gtfs_departures", "feed_id,stop_id,service_date", departureRows(feed.id, date, byStop, runAt), 200);
    // stops that no longer have service on that day
    await sb(`gtfs_departures?feed_id=eq.${encodeURIComponent(feed.id)}&service_date=eq.${date}&loaded_at=lt.${encodeURIComponent(runAt)}`, { method: "DELETE" });
  }
  if (apply) await sb(`gtfs_departures?feed_id=eq.${encodeURIComponent(feed.id)}&service_date=lt.${addDays(today, -1)}`, { method: "DELETE" });
}

let failed = 0;
for (const f of feeds) {
  const runAt = new Date().toISOString();
  try {
    const dir = args["gtfs-dir"] && args.feed ? args["gtfs-dir"] : await downloadGtfs(f.feed, f.support === "timetable" ? undefined : ["routes.txt", "stops.txt"]);
    await loadStopsAndRoutes(f, dir, runAt);
    if (f.support === "timetable") await loadTimetable(f, dir, runAt);
  } catch (e) {
    failed++;
    console.error(`[${f.feed.id}] failed: ${String(e?.message ?? e).slice(0, 300)}`);
  }
}
console.error(apply ? "applied" : "dry run (nothing written)");
if (failed) { console.error(`${failed} feed(s) failed`); process.exitCode = 1; }
