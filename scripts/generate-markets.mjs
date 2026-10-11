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
import { localDayStart, tzOffsetSec } from "../shared/time.ts";
import { trainTripId } from "../shared/adapters/viaggiatreno.ts";
import { historyKey } from "../shared/market.ts";
import { marketToEvent } from "../shared/market.ts";
import { supabaseUrl } from "./lib-env.mjs";
import { readAll, readTable } from "./lib-csv.mjs";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]?.startsWith("--") || all[i + 1] === undefined ? true : all[i + 1]]] : acc), []));
const city = validateCity(JSON.parse(readFileSync(new URL(`../cities/${args.city}.json`, import.meta.url), "utf8")));
const now = Number(args.now ?? Math.floor(Date.now() / 1000));
const max = Number(args.max ?? 30);
const SB = supabaseUrl(), KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  const wanted = new Set(["agency.txt", "routes.txt", "trips.txt", "stop_times.txt", "stops.txt", "calendar.txt", "calendar_dates.txt"]);
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()), { filter: (f) => wanted.has(f.name) });
  const dir = mkdtempSync(join(tmpdir(), "gtfs-"));
  for (const [name, bytes] of Object.entries(files)) if (name.endsWith(".txt")) writeFileSync(join(dir, name.replaceAll("/", "_")), bytes);
  return dir;
}

async function delayMarkets(feed) {
  const dir = await gtfsDir(feed);
  const out = { markets: [], schedule: [] };
  // Today and tomorrow (city-local): markets are bettable up to ~30 h ahead.
  for (const offset of [0, 1]) {
    if (out.markets.length >= max) break;
    const r = await delayMarketsForDay(feed, dir, now + offset * 86400, max - out.markets.length);
    out.markets.push(...r.markets); out.schedule.push(...r.schedule);
  }
  return out;
}

async function delayMarketsForDay(feed, dir, dayEpoch, budget) {
  const { ymd, weekday } = localYmd(dayEpoch, city.timezone);
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
  const shuffled = trips.map((t) => [rand(), t]).sort((a, b) => a[0] - b[0]).map((x) => x[1]).slice(0, budget * 6);
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
    if (markets.length >= budget) break;
    const stops = (byTrip.get(trip.trip_id) ?? []).filter((s) => s.time).sort((a, b) => a.seq - b.seq);
    const stop = pickTargetStop(stops, rand);
    if (!stop) continue;
    const draft = buildDelayMarket({ cityId: city.id, tz: city.timezone, feedId: feed.id, category: feed.category, routeId: trip.route_id, routeName: routes.get(trip.route_id), headsign: trip.trip_headsign, tripId: trip.trip_id, stop, stopName: stopNames.get(stop.stopId) ?? stop.stopId, serviceDayEpoch: dayEpoch, thresholdSec: threshold, history: null });
    const targetAt = Date.parse(draft.target_at) / 1000;
    if (Date.parse(draft.closes_at) / 1000 <= now + 300 || targetAt > now + 30 * 3600) continue; // bettable window
    // Re-price with real history now that the event exists.
    const key = historyKey(marketToEvent({ ...draft, id: "x" }), city.timezone);
    const priced = buildDelayMarket({ ...{ cityId: city.id, tz: city.timezone, feedId: feed.id, category: feed.category, routeId: trip.route_id, routeName: routes.get(trip.route_id), headsign: trip.trip_headsign, tripId: trip.trip_id, stop, stopName: stopNames.get(stop.stopId) ?? stop.stopId, serviceDayEpoch: dayEpoch, thresholdSec: threshold }, history: hist(key) });
    markets.push(priced);
    if (feed.kind === "vehicle_positions") {
      const sd = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
      for (const s of stops) schedule.push({ feed_id: feed.id, trip_id: trip.trip_id, stop_sequence: s.seq, stop_id: s.stopId, scheduled_time: s.time, service_date: sd });
    }
  }
  return { markets, schedule };
}

// ---- ViaggiaTreno: no static timetable, so candidates come from the departure boards of the hub stations ----
const VT_TRAIN_DEADLINE_SEC = 90 * 60; // trains are read when they arrive; allow for late ones
const pad = (n) => String(n).padStart(2, "0");
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** The date format the API expects ("Mon Oct 12 2026 10:00:00 GMT+0200"), always in the city's timezone. */
function vtDate(epoch) {
  const off = tzOffsetSec(epoch, city.timezone), d = new Date((epoch + off) * 1000);
  const sign = off < 0 ? "-" : "+", a = Math.abs(off);
  return encodeURIComponent(`${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCDate())} ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} GMT${sign}${pad(Math.floor(a / 3600))}${pad(Math.floor((a % 3600) / 60))}`);
}
const hms = (secs) => `${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}`;

async function trainMarkets(feed) {
  const base = (process.env.VIAGGIATRENO_BASE_URL ?? feed.url).replace(/\/$/, "");
  const headers = { "User-Agent": "LateLotto-markets/0.1", ...(process.env.RELAY_SECRET ? { "x-relay-secret": process.env.RELAY_SECRET } : {}) };
  const vt = async (path) => {
    const res = await fetch(`${base}/${path}`, { headers, signal: AbortSignal.timeout(20000) });
    const text = await res.text();
    if (!res.ok || /Access Denied/i.test(text)) throw new Error(`ViaggiaTreno ${path.split("/")[0]}: HTTP ${res.status} ${text.slice(0, 80).replace(/s+/g, " ")}`);
    return text.trim() ? JSON.parse(text) : null;
  };
  if (!feed.stations?.length) throw new Error(`feed ${feed.id} has no "stations"`);

  // Trains that have not left yet, from the boards over the next hours.
  const candidates = new Map();
  for (const st of feed.stations) {
    for (const h of [0, 2, 4, 6, 8, 10, 12]) {
      const board = (await vt(`partenze/${st}/${vtDate(now + h * 3600)}`).catch((e) => (console.error(e.message), null))) ?? [];
      for (const x of board) {
        if (!x.nonPartito || !x.numeroTreno || !x.dataPartenzaTreno || !x.codOrigine) continue;
        candidates.set(trainTripId(x.codOrigine, x.numeroTreno, x.dataPartenzaTreno), x);
      }
    }
  }
  console.error(`[${feed.id}] ${candidates.size} trains on the boards`);
  const { ymd } = localYmd(now, city.timezone);
  const rand = seededRandom(`${city.id}-${feed.id}-${ymd}-${Math.floor(now / 21600)}`);
  const shuffled = [...candidates.entries()].map((e) => [rand(), e]).sort((a, b) => a[0] - b[0]).map((x) => x[1]).slice(0, max * 3);

  const hist = await historyLookup();
  const markets = [];
  for (const [tripId, x] of shuffled) {
    if (markets.length >= max) break;
    const t = await vt(`andamentoTreno/${x.codOrigine}/${x.numeroTreno}/${x.dataPartenzaTreno}`).catch((e) => (console.error(e.message), null));
    if (!t?.fermate || t.provvedimento === 1) continue; // unknown or cancelled
    const dayEpoch = Math.floor(x.dataPartenzaTreno / 1000);
    const base0 = localDayStart(dayEpoch, city.timezone);
    const names = new Map(t.fermate.map((f) => [f.id, f.stazione]));
    const stops = t.fermate
      .filter((f) => f.id && f.programmata && f.progressivo != null && f.programmata / 1000 > now + 900)
      .map((f) => ({ seq: f.progressivo, stopId: f.id, time: hms(Math.floor(f.programmata / 1000) - base0), timepoint: true }))
      .filter((s) => !s.time.startsWith("-"))
      .sort((a, b) => a.seq - b.seq);
    const stop = pickTargetStop(stops, rand);
    if (!stop) continue;
    const common = { cityId: city.id, tz: city.timezone, feedId: feed.id, category: "train", routeId: (t.categoria || x.categoriaDescrizione || "").trim() || "train", routeName: `${(x.categoriaDescrizione || "").trim()} ${x.numeroTreno}`.trim(), headsign: x.destinazione ?? "", tripId, stop, stopName: names.get(stop.stopId) ?? stop.stopId, serviceDayEpoch: dayEpoch, thresholdSec: 300 };
    const draft = buildDelayMarket({ ...common, history: null });
    const targetAt = Date.parse(draft.target_at) / 1000;
    if (Date.parse(draft.closes_at) / 1000 <= now + 300 || targetAt > now + 30 * 3600) continue;
    const priced = buildDelayMarket({ ...common, history: hist(historyKey(marketToEvent({ ...draft, id: "x" }), city.timezone)) });
    markets.push({ ...priced, deadline_at: new Date((targetAt + VT_TRAIN_DEADLINE_SEC) * 1000).toISOString() });
  }
  return { markets, schedule: [] };
}

let markets = [], schedule = [];
if (args.weather) {
  const feed = city.feeds.find((f) => f.category === "weather");
  if (!feed) throw new Error(`${city.id} has no weather feed`);
  const args = { cityId: city.id, tz: city.timezone, feedId: feed.id, localHours: [8, 12, 15, 18, 21] };
  markets = [
    ...buildWeatherMarkets({ ...args, nowEpoch: now }),
    // tomorrow: just after local midnight, so every hour of that day is still open
    ...buildWeatherMarkets({ ...args, nowEpoch: localDayStart(now + 86400, city.timezone) + 1 }),
  ];
} else {
  const feed = city.feeds.find((f) => f.id === args.feed);
  if (!feed) throw new Error(`--feed must be one of: ${city.feeds.map((f) => f.id).join(", ")}`);
  ({ markets, schedule } = feed.type === "viaggiatreno" ? await trainMarkets(feed) : await delayMarkets(feed));
}
console.error(`${markets.length} markets, ${schedule.length} schedule rows`);
console.log(JSON.stringify({ markets: markets.slice(0, args.apply ? 0 : 5), scheduleSample: schedule.slice(0, 2) }, null, 2));
if (args.apply) {
  if (!SB || !KEY) throw new Error("--apply needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  for (let i = 0; i < schedule.length; i += 500) await sb("trip_schedule", { method: "POST", body: JSON.stringify(schedule.slice(i, i + 500)) });
  // Same key = same question: re-runs skip what already exists instead of duplicating it.
  const keyed = markets.map((m) => ({ ...m, dedupe_key: [m.city_id, m.kind, m.feed_id, m.params.tripId ?? "", m.params.stopId ?? "", Math.floor(Date.parse(m.target_at) / 1000)].join("|") }));
  if (keyed.length) await sb("markets?on_conflict=dedupe_key", { method: "POST", body: JSON.stringify(keyed), headers: { Prefer: "resolution=ignore-duplicates,return=minimal" } });
  console.error("applied");
}
