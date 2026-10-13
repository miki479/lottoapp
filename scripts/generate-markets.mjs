// Build the day's markets from a city's static GTFS and (optionally) write them to Supabase.
//
//   node scripts/generate-markets.mjs --city tokyo --feed toei-bus-vehicle --gtfs-dir ./gtfs/toei [--max 30] [--apply]
//   node scripts/generate-markets.mjs --city tokyo --weather [--apply]
//
// Without --gtfs-dir the feed's staticGtfsUrl is downloaded and unzipped to a temp dir.
// Without --apply it only prints what it would create. Needs SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY for --apply and for reading odds history.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { validateCity } from "../shared/cities.ts";
import { activeServiceIds, buildDelayMarket, buildWeatherMarkets, localYmd, pickTargetStop, seededRandom } from "../shared/generator.ts";
import { addDays, gtfsDayStart, localDateString, tzOffsetSec, zonedEpoch } from "../shared/time.ts";
import { buildOccupancyMarket } from "../shared/occupancy.ts";
import { DEFAULT_YES_PROBABILITY, learnedPrior } from "../shared/odds.ts";
import { readdirSync } from "node:fs";
import { trainTripId } from "../shared/adapters/viaggiatreno.ts";
import { historyKey } from "../shared/market.ts";
import { marketToEvent } from "../shared/market.ts";
import { supabaseUrl } from "./lib-env.mjs";
import { readAll } from "./lib-csv.mjs";
import { downloadGtfs, hdrs, stopTimes } from "./lib-gtfs.mjs";

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

/** Chance of "late" learned from every settled question of the same country and category (shrunk toward the fixed guess), so a country where buses are rarely late is not priced like one where they often are. */
async function learnedPriorYes(category) {
  const kind = category === "train" ? "train_delay_gt" : "bus_delay_gt", base = DEFAULT_YES_PROBABILITY[kind];
  if (!SB || !KEY) return base;
  const same = readdirSync(new URL("../cities/", import.meta.url)).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(new URL(`../cities/${f}`, import.meta.url), "utf8"))).filter((c) => c.country === city.country).map((c) => c.id);
  const rows = await sb(`markets?category=eq.${category}&kind=eq.${kind}&status=eq.resolved&params->>ladderOf=is.null&city_id=in.(${same.join(",")})&select=outcome&limit=1000`);
  const yes = rows.filter((r) => r.outcome === "yes").length;
  const p = learnedPrior(yes, rows.length, base);
  console.error(`[${city.country} ${category}] chance of "late": ${(p * 100).toFixed(1)}% (${yes} of ${rows.length} settled, guess ${(base * 100).toFixed(0)}%)`);
  return p;
}

async function historyLookup() {
  if (!SB || !KEY) return () => null;
  const rows = await sb(`odds_history?city_id=eq.${city.id}&select=kind,route_id,hour_of_day,threshold,n,yes`);
  const m = new Map(rows.map((r) => [`${r.kind}|${r.route_id}|${r.hour_of_day}|${r.threshold}`, { n: r.n, yes: r.yes }]));
  return (k) => m.get(`${k.kind}|${k.routeId}|${k.hourOfDay}|${k.threshold}`) ?? null;
}

async function gtfsDir(feed) {
  if (args["gtfs-dir"]) return args["gtfs-dir"];
  return downloadGtfs(feed);
}

async function delayMarkets(feed) {
  const dir = await gtfsDir(feed);
  const out = { markets: [], schedule: [] };
  // Today and tomorrow (city-local): markets are bettable up to ~30 h ahead.
  const rtTrips = feed.useRealtimeTrips ? await realtimeTripIds(feed) : null;
  for (const offset of rtTrips ? [0] : [0, 1]) {
    if (out.markets.length >= max) break;
    const r = await delayMarketsForDay(feed, dir, now + offset * 86400, max - out.markets.length, rtTrips);
    out.markets.push(...r.markets); out.schedule.push(...r.schedule);
  }
  return out;
}

/** Trip ids currently present in the real-time feed (used when the static calendar is not reliable for today). */
async function realtimeTripIds(feed) {
  const GtfsRt = (await import("gtfs-realtime-bindings")).default;
  const res = await fetch(feed.url, { headers: { "User-Agent": "LateLotto/0.1 (play-money game)", ...hdrs(feed) } });
  if (!res.ok) throw new Error(`real-time feed ${res.status}`);
  const m = GtfsRt.transit_realtime.FeedMessage.toObject(GtfsRt.transit_realtime.FeedMessage.decode(new Uint8Array(await res.arrayBuffer())));
  return new Set(m.entity.filter((e) => e.tripUpdate?.trip?.tripId).map((e) => e.tripUpdate.trip.tripId));
}

async function delayMarketsForDay(feed, dir, dayEpoch, budget, rtTrips = null) {
  const { ymd, weekday } = localYmd(dayEpoch, city.timezone);
  const services = activeServiceIds(ymd, weekday, await readAll(join(dir, "calendar.txt")).catch(() => []), await readAll(join(dir, "calendar_dates.txt")).catch(() => []));
  const routes = new Map();
  for (const r of await readAll(join(dir, "routes.txt"))) {
    if (feed.routeTypes && !feed.routeTypes.includes(Number(r.route_type || 3))) continue;
    routes.set(r.route_id, r.route_short_name || r.route_long_name || r.route_id);
  }
  /** Trains of the national feeds are all called "REG" or "MET": the train number from the trip id tells them apart. */
  const nameOf = (trip) => { const base = routes.get(trip.route_id) ?? ""; if (feed.category !== "train" || /\d/.test(base)) return base; const num = String(trip.trip_id).match(/-(\d{3,5})-/)?.[1] ?? String(trip.trip_id).match(/^NTV-(\d{3,5})/)?.[1]; return num ? `${base} ${num}` : base; };
  const allTrips = await readAll(join(dir, "trips.txt"));
  // routes found through the static timetable (some feeds carry no route id): a route is live when one of its trips is in the real-time feed
  let liveRoutes = null;
  if (feed.realtimeRoutesOnly) { const live = await realtimeTripIds(feed); liveRoutes = new Set(allTrips.filter((t) => live.has(t.trip_id)).map((t) => t.route_id)); }
  const trips = allTrips.filter((t) => (rtTrips ? rtTrips.has(t.trip_id) : services.has(t.service_id)) && routes.has(t.route_id) && (!liveRoutes || liveRoutes.has(t.route_id)));
  console.error(`[${feed.id}] ${ymd}: ${services.size} services, ${routes.size} routes, ${trips.length} trips today`);
  if (trips.length === 0) return { markets: [], schedule: [] };

  // Sample candidates deterministically, then read stop_times only for them.
  const rand = seededRandom(`${city.id}-${feed.id}-${ymd}`);
  const shuffled = trips.map((t) => [rand(), t]).sort((a, b) => a[0] - b[0]).map((x) => x[1]).slice(0, budget * 6);
  const wanted = new Map(shuffled.map((t) => [t.trip_id, t]));
  const byTrip = new Map();
  for await (const st of stopTimes(dir)) {
    if (!wanted.has(st.trip_id)) continue;
    const arr = byTrip.get(st.trip_id) ?? [];
    arr.push({ seq: Number(st.stop_sequence), stopId: st.stop_id, time: st.arrival_time || st.departure_time, timepoint: st.timepoint === "1" });
    byTrip.set(st.trip_id, arr);
  }
  const stopNames = new Map();
  const stopPos = new Map();
  for (const s of await readAll(join(dir, "stops.txt"))) { stopNames.set(s.stop_id, s.stop_name); if (s.stop_lat && s.stop_lon) stopPos.set(s.stop_id, [Number(s.stop_lat), Number(s.stop_lon)]); }
  /** Extra facts on a market's params: where the stop is (map), whether positions are estimated, whether a how-full bonus is offered. */
  const withExtras = (m, stopId) => { const pos = stopPos.get(stopId); return { ...m, params: { ...m.params, ...(pos && Number.isFinite(pos[0]) ? { stopLat: pos[0], stopLon: pos[1] } : {}), ...(feed.positionsEstimated ? { posEst: true } : {}), ...(feed.occupancy && m.kind === "bus_delay_gt" ? { occBonus: true } : {}) } }; };
  const hist = await historyLookup();
  const priorYes = await learnedPriorYes(feed.category);
  const markets = [], schedule = [];
  const threshold = feed.category === "train" ? 300 : 180;
  for (const trip of shuffled) {
    if (markets.length >= budget) break;
    const stops = (byTrip.get(trip.trip_id) ?? []).filter((s) => s.time).sort((a, b) => a.seq - b.seq);
    // Feeds without a tripId (Helsinki): the trip is named like the real-time feed names it.
    const tid = feed.tripKey === "route_dir_start" ? (stops[0] ? `${trip.route_id}|${trip.direction_id || 0}|${ymd}|${stops[0].time}` : null) : trip.trip_id;
    if (!tid) continue;
    const stop = pickTargetStop(stops, rand);
    if (!stop) continue;
    const draft = buildDelayMarket({ cityId: city.id, tz: city.timezone, feedId: feed.id, category: feed.category, routeId: trip.route_id, routeName: nameOf(trip), headsign: trip.trip_headsign, tripId: tid, stop, stopName: stopNames.get(stop.stopId) ?? stop.stopId, serviceDayEpoch: dayEpoch, thresholdSec: threshold, history: null, priorYes });
    const targetAt = Date.parse(draft.target_at) / 1000;
    if (feed.questionsHours) { const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: city.timezone }).format(new Date(targetAt * 1000))); if (h < feed.questionsHours[0] || h >= feed.questionsHours[1]) continue; }
    if (Date.parse(draft.closes_at) / 1000 <= now + 300 || targetAt > now + 30 * 3600) continue; // bettable window
    // Re-price with real history now that the event exists.
    const key = historyKey(marketToEvent({ ...draft, id: "x" }), city.timezone);
    const priced = buildDelayMarket({ ...{ cityId: city.id, tz: city.timezone, feedId: feed.id, category: feed.category, routeId: trip.route_id, routeName: nameOf(trip), headsign: trip.trip_headsign, tripId: tid, stop, stopName: stopNames.get(stop.stopId) ?? stop.stopId, serviceDayEpoch: dayEpoch, thresholdSec: threshold }, history: hist(key), priorYes });
    markets.push(withExtras(priced, stop.stopId));
    // Buses that report how full they are: one more question on the same trip (empty / few seats left / standing room), a third of the time or so.
    if (feed.occupancy && rand() < 0.5) {
      const r = rand(), occ = r < 0.4 ? "empty" : r < 0.75 ? "few" : "standing";
      const oargs = { cityId: city.id, tz: city.timezone, feedId: feed.id, routeId: trip.route_id, routeName: nameOf(trip), headsign: trip.trip_headsign, tripId: tid, stop, stopName: stopNames.get(stop.stopId) ?? stop.stopId, serviceDayEpoch: dayEpoch, kind: occ };
      const od = buildOccupancyMarket({ ...oargs, history: null });
      markets.push(withExtras(buildOccupancyMarket({ ...oargs, history: hist(historyKey(marketToEvent({ ...od, id: "x" }), city.timezone)) }), stop.stopId));
    }
    if (feed.kind === "vehicle_positions" || feed.kind === "trip_updates_times" || feed.kind === "trip_updates_seq") {
      const sd = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
      for (const s of stops) schedule.push({ feed_id: feed.id, trip_id: tid, stop_sequence: s.seq, stop_id: s.stopId, scheduled_time: s.time, service_date: sd });
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
    if (pause) await new Promise((r) => setTimeout(r, pause));
    const res = await fetch(`${base}/${path}`, { headers, signal: AbortSignal.timeout(20000) });
    const text = await res.text();
    if (!res.ok || /Access Denied/i.test(text)) throw new Error(`ViaggiaTreno ${path.split("/")[0]}: HTTP ${res.status} ${text.slice(0, 80).replace(/s+/g, " ")}`);
    return text.trim() ? JSON.parse(text) : null;
  };
  const stations = process.env.VT_STATIONS ? process.env.VT_STATIONS.split(",") : feed.stations;
  const slots = process.env.VT_SLOTS ? JSON.parse(process.env.VT_SLOTS) : [0, 2, 4, 6, 8, 10, 12];
  const pause = Number(process.env.VT_DELAY_MS ?? 0);
  if (!stations?.length) throw new Error(`feed ${feed.id} has no "stations"`);

  // Trains that have not left yet, from the boards over the next hours.
  const candidates = new Map();
  for (const st of stations) {
    for (const h of slots) {
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
  const mixed = [...candidates.entries()].map((e) => [rand(), e]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  // Regional trains are most of the boards: one question in three goes to a Frecciarossa / Frecciargento / Frecciabianca / Intercity so the fast trains are not drowned.
  const isFast = ([, x]) => ["FR", "FA", "FB", "IC", "ICN", "EC"].includes(String(x.categoriaDescrizione || "").trim().toUpperCase());
  const fast = mixed.filter(isFast), slow = mixed.filter((e) => !isFast(e)), shuffled = [];
  while ((fast.length || slow.length) && shuffled.length < max * 3) { if (fast.length) shuffled.push(fast.shift()); for (let k = 0; k < 2 && slow.length; k++) shuffled.push(slow.shift()); if (!fast.length) { while (slow.length && shuffled.length < max * 3) shuffled.push(slow.shift()); } }

  const hist = await historyLookup();
  const priorYes = await learnedPriorYes("train");
  const markets = [];
  for (const [tripId, x] of shuffled) {
    if (markets.length >= max) break;
    const t = await vt(`andamentoTreno/${x.codOrigine}/${x.numeroTreno}/${x.dataPartenzaTreno}`).catch((e) => (console.error(e.message), null));
    if (!t?.fermate || t.provvedimento === 1) continue; // unknown or cancelled
    const dayEpoch = Math.floor(x.dataPartenzaTreno / 1000);
    const base0 = gtfsDayStart(dayEpoch, city.timezone);
    const names = new Map(t.fermate.map((f) => [f.id, f.stazione]));
    const stops = t.fermate
      .filter((f) => f.id && f.programmata && f.progressivo != null && f.programmata / 1000 > now + 900)
      .map((f) => ({ seq: f.progressivo, stopId: f.id, time: hms(Math.floor(f.programmata / 1000) - base0), timepoint: true }))
      .filter((s) => !s.time.startsWith("-"))
      .sort((a, b) => a.seq - b.seq);
    const stop = pickTargetStop(stops, rand);
    if (!stop) continue;
    const common = { cityId: city.id, tz: city.timezone, feedId: feed.id, category: "train", routeId: (t.categoria || x.categoriaDescrizione || "").trim() || "train", routeName: `${(x.categoriaDescrizione || "").trim()} ${x.numeroTreno}`.trim(), headsign: x.destinazione ?? "", tripId, stop, stopName: names.get(stop.stopId) ?? stop.stopId, serviceDayEpoch: dayEpoch, thresholdSec: 300 };
    const draft = buildDelayMarket({ ...common, history: null, priorYes });
    const targetAt = Date.parse(draft.target_at) / 1000;
    if (Date.parse(draft.closes_at) / 1000 <= now + 300 || targetAt > now + 30 * 3600) continue;
    const priced = buildDelayMarket({ ...common, history: hist(historyKey(marketToEvent({ ...draft, id: "x" }), city.timezone)), priorYes });
    // Unlicensed source: private test markets, hidden from everyone but the owner (web/src/lib/testmode.ts).
    markets.push({ ...priced, params: { ...priced.params, ...(feed.licenseVerified ? {} : { testOnly: true }) }, deadline_at: new Date((targetAt + VT_TRAIN_DEADLINE_SEC) * 1000).toISOString() });
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
    ...buildWeatherMarkets({ ...args, nowEpoch: zonedEpoch(addDays(localDateString(now, city.timezone), 1), 1, city.timezone) }),
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
