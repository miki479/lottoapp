// Runs every minute (pg_cron). For each usable feed that is due: fetch, parse, keep what matters,
// record feed health. A failing feed is recorded as failing; its markets get voided by `resolve`.
import GtfsRt from "npm:gtfs-realtime-bindings@2.2.0";
import { delayAdapterFor, trainJsonAdapterFor, weatherAdapterFor } from "../_shared/shared/adapters/index.ts";
import { parseTrainTripId } from "../_shared/shared/adapters/viaggiatreno.ts";
import type { RtFeed, ScheduleByStop, ScheduleLookup } from "../_shared/shared/adapters/types.ts";
import { buildTrafficMarkets, parseDigitrafficTms } from "../_shared/shared/traffic.ts";
import { buildStrikeMarkets, parseStrikeRss } from "../_shared/shared/strikes.ts";
import { CRYPTO, STEAM, WIKI_ARTICLES, buildSteamMarkets, buildCryptoMarkets, buildKpMarkets, buildWikiMarkets, isCrypto, isSpot, CRYPTO_GRACE_SEC, type CryptoSeries } from "../_shared/shared/ticks.ts";
import { buildMatchMarkets, FINISHED, type Fixture, type TableRow } from "../_shared/shared/sport.ts";
import { METRICS, METRIC_IDS, buildMetricMarkets, type MetricId } from "../_shared/shared/metrics.ts";
import { allowUnverified, db, feedUrl, loadCities, requireCron, safe, usableFeeds, type CityConfig, type FeedConfig } from "../_lib/common.ts";

const FETCH_TIMEOUT_MS = 25_000;
const MAX_BYTES = 12 * 1024 * 1024;

Deno.serve(safe(async (req) => {
  const denied = requireCron(req);
  if (denied) return denied;
  const sb = db();
  const now = Math.floor(Date.now() / 1000);
  const report: Record<string, string> = {};
  // "?group=heavy" runs only the big feeds (own scheduled call); the normal call skips them.
  const heavyRun = new URL(req.url).searchParams.get("group") === "heavy";
  const rtCache = new Map<string, RtFeed>();

  const { data: healthRows } = await sb.from("feed_health").select("feed_id,last_attempt_at");
  const lastAttempt = new Map((healthRows ?? []).map((h) => [h.feed_id, h.last_attempt_at ? Date.parse(h.last_attempt_at) / 1000 : 0]));

  // Only markets inside their active window (15 min before the target until the deadline) need readings.
  // Markets for tomorrow must not make an idle feed look broken at night.
  const since = new Date((now - 3600) * 1000).toISOString();
  const { data: live } = await sb.from("markets").select("feed_id,params,target_at,deadline_at").gte("deadline_at", since).eq("status", "open");
  // feed -> trip -> stops the markets ask about
  const tracked = new Map<string, Map<string, Set<string>>>();
  for (const m of live ?? []) {
    const p = m.params as { tripId?: string; stopId?: string };
    if (!p.tripId) continue;
    const from = Date.parse(m.target_at) / 1000 - 15 * 60;
    const to = Date.parse(m.deadline_at) / 1000;
    if (now < from || now > to) continue;
    if (!tracked.has(m.feed_id)) tracked.set(m.feed_id, new Map());
    const trips = tracked.get(m.feed_id)!;
    if (!trips.has(p.tripId)) trips.set(p.tripId, new Set());
    if (p.stopId) trips.get(p.tripId)!.add(p.stopId);
  }

  const seen = new Set<string>();
  for (const city of await loadCities()) {
    for (const feed of usableFeeds(city, allowUnverified())) {
      // Feed ids are globally unique (weather feeds are per city); a national feed listed by two cities is fetched once.
      if (!!feed.heavy !== heavyRun) continue;
      if (seen.has(feed.id)) continue;
      seen.add(feed.id);
      if (now - (lastAttempt.get(feed.id) ?? 0) < feed.pollSeconds - 5) { report[feed.id] = "not due"; continue; }
      await sb.from("feed_health").upsert({ feed_id: feed.id, last_attempt_at: new Date(now * 1000).toISOString() });
      try {
        const n = await ingestFeed(sb, city, feed, now, tracked.get(feed.id) ?? new Map(), rtCache);
        await sb.from("feed_health").upsert({ feed_id: feed.id, last_ok_at: new Date().toISOString(), last_error: null });
        report[feed.id] = `ok ${n}`;
      } catch (e) {
        const msg = String((e as Error).message ?? e).slice(0, 300);
        await sb.from("feed_health").upsert({ feed_id: feed.id, last_error: msg, last_error_at: new Date().toISOString() });
        report[feed.id] = `error: ${msg}`;
      }
    }
  }
  if (heavyRun) return Response.json(report);
  report["open-meteo-places"] = await ingestPlaces(sb, now, lastAttempt.get("open-meteo-places") ?? 0).catch((e) => `error: ${String((e as Error).message ?? e).slice(0, 200)}`);
  report["open-meteo-metrics"] = await ingestMetrics(sb, now, lastAttempt.get("open-meteo-metrics") ?? 0).catch((e) => `error: ${String((e as Error).message ?? e).slice(0, 200)}`);
  report["ticks"] = await ingestTicks(sb, now, lastAttempt.get("ticks") ?? 0).catch((e) => `error: ${String((e as Error).message ?? e).slice(0, 200)}`);
  report["sportsdb"] = await ingestSport(sb, now, lastAttempt.get("sportsdb") ?? 0).catch((e) => `error: ${String((e as Error).message ?? e).slice(0, 200)}`);
  report["mit-scioperi"] = await ingestStrikes(sb, now, lastAttempt.get("mit-scioperi") ?? 0).catch((e) => `error: ${String((e as Error).message ?? e).slice(0, 200)}`);
  report["usgs"] = await pingUsgs(sb, now, lastAttempt.get("usgs") ?? 0).catch((e) => `error: ${String((e as Error).message ?? e).slice(0, 200)}`);
  return Response.json(report);
}));

/** Road traffic stations (Digitraffic, Finland): hourly average speed per direction, kept per hour; rush-hour questions are created from the same list. */
async function ingestTraffic(sb: ReturnType<typeof db>, city: CityConfig, feed: FeedConfig, now: number): Promise<number> {
  const stations = feed.trafficStations ?? [];
  if (stations.length === 0) throw new Error("no stations configured");
  const rows: Record<string, unknown>[] = [];
  let failed = 0;
  for (const st of stations) {
    try {
      const json = JSON.parse(new TextDecoder().decode(await fetchBytes(`${feed.url}/${st.id}/data`, { "Digitraffic-User": "LateLotto/0.1" })));
      for (const r of parseDigitrafficTms(json)) {
        rows.push({ feed_id: feed.id, site_id: String(st.id), direction: r.direction, hour_start: new Date(r.windowStart * 1000).toISOString(), avg_kmh: r.avgKmh, vehicles: Math.round(r.vehicles), measured_at: new Date(r.measuredAt * 1000).toISOString() });
      }
    } catch { failed++; }
  }
  if (rows.length === 0) throw new Error(`no readings (${failed}/${stations.length} stations failed)`);
  const { error } = await sb.from("traffic_observations").upsert(rows, { onConflict: "feed_id,site_id,direction,hour_start" });
  if (error) throw new Error(error.message);
  // History makes the odds: how often each station direction really fell under its threshold at that hour.
  const { data: hist } = await sb.from("odds_history").select("route_id,hour_of_day,threshold,n,yes").eq("city_id", city.id).eq("kind", "traffic_speed_lt");
  const h = new Map((hist ?? []).map((r) => [`${r.route_id}|${r.hour_of_day}|${r.threshold}`, { n: r.n as number, yes: r.yes as number }]));
  const markets = buildTrafficMarkets({ cityId: city.id, feedId: feed.id, tz: city.timezone, nowEpoch: now, stations, history: (key, hour, thr) => h.get(`${key}|${hour}|${thr}`) ?? null });
  if (markets.length) {
    const { error: e2 } = await sb.from("markets").upsert(markets, { onConflict: "dedupe_key", ignoreDuplicates: true });
    if (e2) throw new Error(e2.message);
  }
  return rows.length;
}

export const STRIKE_RSS = "https://scioperi.mit.gov.it/mit2/public/scioperi/rss";

/** Hourly: the Italian Ministry of Transport's public strike list. National train strikes become one question each. */
async function ingestStrikes(sb: ReturnType<typeof db>, now: number, last: number): Promise<string> {
  if (now - last < 3600 - 5) return "not due";
  await sb.from("feed_health").upsert({ feed_id: "mit-scioperi", last_attempt_at: new Date(now * 1000).toISOString() });
  try {
    const strikes = parseStrikeRss(new TextDecoder().decode(await fetchBytes(STRIKE_RSS)));
    if (strikes.length === 0) throw new Error("no strikes parsed (feed empty or changed)");
    const markets = buildStrikeMarkets(strikes, now);
    if (markets.length) {
      const { error } = await sb.from("markets").upsert(markets, { onConflict: "dedupe_key", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }
    await sb.from("feed_health").upsert({ feed_id: "mit-scioperi", last_ok_at: new Date().toISOString(), last_error: null });
    return `ok ${strikes.length} strikes, ${markets.length} offered`;
  } catch (e) {
    await sb.from("feed_health").upsert({ feed_id: "mit-scioperi", last_error: String((e as Error).message ?? e).slice(0, 300), last_error_at: new Date().toISOString() });
    throw e;
  }
}

/** Hourly health check of the USGS earthquake feed (the actual window counts are read by `resolve`). */
async function pingUsgs(sb: ReturnType<typeof db>, now: number, last: number): Promise<string> {
  if (now - last < 3600 - 5) return "not due";
  await sb.from("feed_health").upsert({ feed_id: "usgs", last_attempt_at: new Date(now * 1000).toISOString() });
  try {
    const j = JSON.parse(new TextDecoder().decode(await fetchBytes("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_hour.geojson")));
    if (!Array.isArray(j?.features)) throw new Error("unexpected USGS response");
  } catch (e) {
    await sb.from("feed_health").upsert({ feed_id: "usgs", last_error: String((e as Error).message ?? e).slice(0, 300), last_error_at: new Date().toISOString() });
    throw e;
  }
  await sb.from("feed_health").upsert({ feed_id: "usgs", last_ok_at: new Date().toISOString(), last_error: null });
  return "ok";
}

/**
 * Hourly: temperature, gusts, snow, UV (forecast API) and air quality (air-quality API) for every city and active place.
 * The same readings price the new questions and, once the hour is over, settle them.
 */
async function ingestMetrics(sb: ReturnType<typeof db>, now: number, last: number): Promise<string> {
  if (now - last < 3600 - 5) return "not due";
  await sb.from("feed_health").upsert({ feed_id: "open-meteo-metrics", last_attempt_at: new Date(now * 1000).toISOString() });
  const targets: { id: string; lat: number; lon: number; tz: string }[] = [];
  for (const c of await loadCities()) if (c.categories.weather?.enabled && c.location) targets.push({ id: c.id, lat: c.location.lat, lon: c.location.lon, tz: c.timezone });
  const { data: places } = await sb.from("places").select("id,lat,lon,timezone").gt("last_used_at", new Date((now - 3 * 86400) * 1000).toISOString()).limit(300);
  for (const p of places ?? []) targets.push({ id: p.id as string, lat: Number(p.lat), lon: Number(p.lon), tz: p.timezone as string });
  let rows = 0, created = 0;
  try {
    for (let i = 0; i < targets.length; i += 40) {
      const chunk = targets.slice(i, i + 40);
      const loc = { latitude: chunk.map((p) => p.lat).join(","), longitude: chunk.map((p) => p.lon).join(",") };
      const fapi = METRIC_IDS.filter((m) => METRICS[m].source === "forecast").map((m) => METRICS[m].api).join(",");
      const get = async (base: string, hourly: string) => {
        const q = new URLSearchParams({ ...loc, hourly, timezone: "GMT", forecast_days: "3", past_days: "1" });
        const json = JSON.parse(new TextDecoder().decode(await fetchBytes(`${base}?${q}`)));
        return Array.isArray(json) ? json : [json];
      };
      const forecast = await get("https://api.open-meteo.com/v1/forecast", fapi);
      const air = await get("https://air-quality-api.open-meteo.com/v1/air-quality", METRICS.aqi.api).catch(() => null);
      const obsRows: Record<string, unknown>[] = [];
      const fetchedAt = new Date().toISOString();
      const markets: Record<string, unknown>[] = [];
      chunk.forEach((t, k) => {
        const series: Partial<Record<MetricId, Map<number, number>>> = {};
        for (const m of METRIC_IDS) {
          const src = METRICS[m].source === "forecast" ? forecast[k] : air?.[k];
          const times: string[] | undefined = src?.hourly?.time; const vals: Array<number | null> | undefined = src?.hourly?.[METRICS[m].api];
          if (!times || !vals) continue;
          const map = new Map<number, number>();
          times.forEach((ts, h) => { const v = vals[h]; if (typeof v !== "number") return; const e = Date.parse(`${ts}:00Z`) / 1000; if (!Number.isFinite(e)) return; map.set(e, v); obsRows.push({ feed_id: `om-${t.id}`, metric: m, hour_start: new Date(e * 1000).toISOString(), value: v, fetched_at: fetchedAt }); });
          series[m] = map;
        }
        markets.push(...buildMetricMarkets({ id: t.id, tz: t.tz, nowEpoch: now, series }));
      });
      for (let j = 0; j < obsRows.length; j += 500) {
        const { error } = await sb.from("metric_observations").upsert(obsRows.slice(j, j + 500), { onConflict: "feed_id,metric,hour_start" });
        if (error) throw new Error(error.message);
      }
      rows += obsRows.length;
      if (markets.length) {
        const { error } = await sb.from("markets").upsert(markets, { onConflict: "dedupe_key", ignoreDuplicates: true });
        if (error) throw new Error(error.message);
        created += markets.length;
      }
    }
  } catch (e) {
    await sb.from("feed_health").upsert({ feed_id: "open-meteo-metrics", last_error: String((e as Error).message ?? e).slice(0, 300), last_error_at: new Date().toISOString() });
    throw e;
  }
  await sb.from("feed_health").upsert({ feed_id: "open-meteo-metrics", last_ok_at: new Date().toISOString(), last_error: null });
  return `ok ${rows} obs, ${created} markets offered`;
}

/** Weather of every active place (used in the last 3 days), hourly, in batched Open-Meteo requests (up to 40 places per call). */
async function ingestPlaces(sb: ReturnType<typeof db>, now: number, last: number): Promise<string> {
  if (now - last < 3600 - 5) return "not due";
  await sb.from("feed_health").upsert({ feed_id: "open-meteo-places", last_attempt_at: new Date(now * 1000).toISOString() });
  const { data: places } = await sb.from("places").select("id,lat,lon").gt("last_used_at", new Date((now - 3 * 86400) * 1000).toISOString()).limit(300);
  if (!places || places.length === 0) { await sb.from("feed_health").upsert({ feed_id: "open-meteo-places", last_ok_at: new Date().toISOString(), last_error: null }); return "ok 0"; }
  let rows = 0;
  try {
    for (let i = 0; i < places.length; i += 40) {
      const chunk = places.slice(i, i + 40);
      const q = new URLSearchParams({ latitude: chunk.map((p) => p.lat).join(","), longitude: chunk.map((p) => p.lon).join(","), hourly: "precipitation", timezone: "auto", forecast_days: "2", past_days: "1" });
      const json = JSON.parse(new TextDecoder().decode(await fetchBytes(`https://api.open-meteo.com/v1/forecast?${q}`)));
      const list = Array.isArray(json) ? json : [json];
      const out: Record<string, unknown>[] = [];
      list.forEach((one, k) => {
        const place = chunk[k]; if (!place) return;
        const obs = weatherAdapterFor({ type: "open-meteo" } as FeedConfig)!(one, `om-${place.id}`);
        for (const o of obs) out.push({ city_id: place.id, feed_id: `om-${place.id}`, hour_start: new Date(o.hourStart * 1000).toISOString(), precipitation_mm: Math.max(0, o.precipitationMm), fetched_at: new Date().toISOString() });
      });
      for (let j = 0; j < out.length; j += 500) {
        const { error } = await sb.from("weather_observations").upsert(out.slice(j, j + 500), { onConflict: "feed_id,hour_start" });
        if (error) throw new Error(error.message);
      }
      rows += out.length;
    }
  } catch (e) {
    const msg = String((e as Error).message ?? e).slice(0, 300);
    await sb.from("feed_health").upsert({ feed_id: "open-meteo-places", last_error: msg, last_error_at: new Date().toISOString() });
    throw e;
  }
  await sb.from("feed_health").upsert({ feed_id: "open-meteo-places", last_ok_at: new Date().toISOString(), last_error: null });
  return `ok ${rows}`;
}

async function fetchBytes(url: string, extra: Record<string, string> = {}): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { ...extra, "User-Agent": `LateLotto/0.1 (play-money game; contact: ${Deno.env.get("CONTACT_EMAIL") ?? "unset"})`, "Accept-Encoding": "gzip" }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) throw new Error(`unexpected size ${buf.byteLength}`);
  return buf;
}

async function ingestFeed(sb: ReturnType<typeof db>, city: CityConfig, feed: FeedConfig, now: number, tracked: Map<string, Set<string>>, rtCache: Map<string, RtFeed>): Promise<number> {
  const url = feedUrl(feed, city);
  if (feed.type === "open-meteo") {
    const adapter = weatherAdapterFor(feed)!;
    const obs = adapter(JSON.parse(new TextDecoder().decode(await fetchBytes(url))), feed.id);
    if (obs.length === 0) throw new Error("no weather data in response");
    const rows = obs.map((o) => ({ city_id: city.id, feed_id: feed.id, hour_start: new Date(o.hourStart * 1000).toISOString(), precipitation_mm: Math.max(0, o.precipitationMm), fetched_at: new Date().toISOString() }));
    const { error } = await sb.from("weather_observations").upsert(rows, { onConflict: "feed_id,hour_start" });
    if (error) throw new Error(error.message);
    return rows.length;
  }

  if (feed.type === "digitraffic-tms") return await ingestTraffic(sb, city, feed, now);

  const adapter = delayAdapterFor(feed);
  if (!adapter) throw new Error(`no adapter for ${feed.type}/${feed.kind}`);
  const headers = { ...(feed.headers ?? {}) };
  if (feed.requiresKey && feed.keyIn === "header") {
    const key = Deno.env.get(feed.requiresKey);
    if (!key) throw new Error(`missing env ${feed.requiresKey}`);
    headers[feed.keyHeader ?? "Authorization"] = `${feed.keyPrefix ?? ""}${key}`;
  }
  // Two feeds (e.g. Berlin buses and trains) can read the same file: fetch and decode it once per run.
  let msg = rtCache.get(url);
  if (!msg) {
    const bytes = await fetchBytes(url, headers);
    msg = GtfsRt.transit_realtime.FeedMessage.toObject(GtfsRt.transit_realtime.FeedMessage.decode(bytes), { longs: Number }) as RtFeed;
    rtCache.set(url, msg);
  }
  const trips = new Set(tracked.keys());
  if (trips.size === 0) return 0; // nothing to resolve right now (e.g. no service at night): healthy, nothing stored
  // With markets waiting for data, an empty feed is an outage, not "no delays".
  if (!msg.entity?.length) throw new Error("empty feed");

  let schedule: ScheduleLookup | undefined;
  let scheduleByStop: ScheduleByStop | undefined;
  if (feed.kind === "vehicle_positions" || feed.kind === "trip_updates_times") {
    const { data } = await sb.from("trip_schedule").select("trip_id,stop_sequence,stop_id,scheduled_time").eq("feed_id", feed.id).in("trip_id", [...trips]);
    const map = new Map((data ?? []).map((r) => [`${r.trip_id}|${r.stop_sequence}`, { stopId: r.stop_id as string, time: r.scheduled_time as string }]));
    schedule = (trip, seq) => map.get(`${trip}|${seq}`) ?? null;
    if (feed.tripKey) {
      const byStop = new Map<string, { seq: number; stopId: string; time: string }>();
      for (const r of data ?? []) { const k = `${r.trip_id}|${r.stop_id}`; if (!byStop.has(k)) byStop.set(k, { seq: r.stop_sequence as number, stopId: r.stop_id as string, time: r.scheduled_time as string }); }
      scheduleByStop = (trip, stop) => byStop.get(`${trip}|${stop}`) ?? null;
    }
  }
  const all = adapter(msg, { feedId: feed.id, timezone: city.timezone, fetchedAt: now, schedule, scheduleByStop, tripKey: feed.tripKey });
  // Trip updates list every stop of the trip: keep only the stops a market asks about.
  // Position feeds are kept for the whole trip: a bus can skip a sample at the exact stop.
  const mine = feed.kind === "vehicle_positions"
    ? all.filter((o) => trips.has(o.tripId))
    : all.filter((o) => tracked.get(o.tripId)?.has(o.stopId));
  if (mine.length === 0) return 0;
  const rows = mine.map((o) => ({
    city_id: city.id, feed_id: feed.id, route_id: o.routeId, trip_id: o.tripId, stop_id: o.stopId, stop_sequence: o.stopSequence ?? null,
    observed_at: new Date(o.observedAt * 1000).toISOString(), delay_sec: Math.round(o.delaySec),
    predicted_at: o.predictedAt ? new Date(o.predictedAt * 1000).toISOString() : null,
  }));
  const { error } = await sb.from("delay_observations").upsert(rows, { onConflict: "feed_id,trip_id,stop_id,observed_at", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  return rows.length;
}

const MAX_TRAINS_PER_RUN = 40;

/** Per-train JSON feeds: one request per train that has an open market. A failing train fails the run only if none succeeded. */
async function ingestPerTrain(sb: ReturnType<typeof db>, city: CityConfig, feed: FeedConfig, now: number, tracked: Map<string, Set<string>>): Promise<number> {
  const adapter = trainJsonAdapterFor(feed)!;
  // Datacenter IPs are refused upstream: VIAGGIATRENO_BASE_URL + RELAY_SECRET point to scripts/viaggiatreno-relay.mjs on a normal connection.
  const base = (Deno.env.get("VIAGGIATRENO_BASE_URL") ?? feed.url).replace(/\/$/, "");
  const relayHeaders: Record<string, string> = Deno.env.get("RELAY_SECRET") ? { "x-relay-secret": Deno.env.get("RELAY_SECRET")! } : {};
  const trips = [...tracked.keys()].slice(0, MAX_TRAINS_PER_RUN);
  if (trips.length === 0) return 0;
  const rows: Record<string, unknown>[] = [];
  let ok = 0;
  let lastError = "";
  for (const tripId of trips) {
    const t = parseTrainTripId(tripId);
    if (!t) continue;
    try {
      const json = JSON.parse(new TextDecoder().decode(await fetchBytes(`${base}/andamentoTreno/${t.codOrigine}/${t.numero}/${t.serviceDayMs}`, relayHeaders)));
      ok++;
      for (const o of adapter(json, { feedId: feed.id, fetchedAt: now, tripId })) {
        if (!tracked.get(tripId)?.has(o.stopId)) continue;
        rows.push({
          city_id: city.id, feed_id: feed.id, route_id: o.routeId, trip_id: o.tripId, stop_id: o.stopId, stop_sequence: o.stopSequence ?? null,
          observed_at: new Date(o.observedAt * 1000).toISOString(), delay_sec: Math.round(o.delaySec), predicted_at: null,
        });
      }
    } catch (e) {
      lastError = String((e as Error).message ?? e);
    }
  }
  if (ok === 0) throw new Error(`all ${trips.length} train requests failed: ${lastError}`);
  if (rows.length === 0) return 0;
  const { error } = await sb.from("delay_observations").upsert(rows, { onConflict: "feed_id,trip_id,stop_id,observed_at", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  return rows.length;
}


// ---- Global "number at an instant" questions: coin prices (CoinGecko), Kp index (NOAA SWPC), Wikipedia page views (Wikimedia) ----
const UA = { "User-Agent": "LateLotto/0.1 (satirical fake-credit game; https://latelotto.web.app)" };
const getJson = async (url: string) => JSON.parse(new TextDecoder().decode(await fetchBytes(url, UA)));
const KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json";
const COINGECKO = (ids: string) => `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&precision=2`;
const wikiDay = (e: number) => new Date(e * 1000).toISOString().slice(0, 10).replace(/-/g, "");

async function fetchPrices(): Promise<Partial<Record<CryptoSeries, number>>> {
  const ids = (Object.keys(CRYPTO) as CryptoSeries[]).map((k) => CRYPTO[k].id).join(",");
  const json = await getJson(COINGECKO(ids));
  const out: Partial<Record<CryptoSeries, number>> = {};
  for (const k of Object.keys(CRYPTO) as CryptoSeries[]) { const v = json?.[CRYPTO[k].id]?.usd; if (typeof v === "number" && v > 0) out[k] = v; }
  return out;
}

async function steamCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const id of Object.keys(STEAM)) {
    try { const j = await getJson(`https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${id}`); const n = j?.response?.player_count; if (typeof n === "number" && n > 0) out[id] = n; } catch { /* skip this game */ }
  }
  return out;
}

async function kpSeries(): Promise<{ observed: Map<number, number>; predicted: Map<number, number> }> {
  const rows = (await getJson(KP_URL)) as { time_tag: string; kp: number; observed: string }[];
  const observed = new Map<number, number>(), predicted = new Map<number, number>();
  for (const r of rows) {
    const e = Date.parse(`${r.time_tag}Z`) / 1000;
    if (!Number.isFinite(e) || typeof r.kp !== "number") continue;
    (r.observed === "predicted" ? predicted : observed).set(e, r.kp);
  }
  return { observed, predicted };
}

async function wikiViews(title: string, fromEpoch: number, toEpoch: number): Promise<Map<string, number>> {
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(title)}/daily/${wikiDay(fromEpoch)}/${wikiDay(toEpoch)}`;
  const json = await getJson(url);
  return new Map(((json?.items ?? []) as { timestamp: string; views: number }[]).map((i) => [i.timestamp.slice(0, 8), i.views]));
}

async function ingestTicks(sb: ReturnType<typeof db>, now: number, last: number): Promise<string> {
  const notes: string[] = [];
  // 1. Instants that have just passed: record the number once, as a fact.
  const { data: waiting } = await sb.from("markets").select("params,target_at").eq("kind", "tick_gt").eq("status", "open").lte("target_at", new Date(now * 1000).toISOString()).limit(300);
  const need = new Map<string, Set<number>>();
  for (const m of waiting ?? []) {
    const p = m.params as { series: string; at: number };
    if (!need.has(p.series)) need.set(p.series, new Set());
    need.get(p.series)!.add(p.at);
  }
  if (need.size) {
    const { data: have } = await sb.from("tick_observations").select("series,at").gte("at", new Date((now - 3 * 86400) * 1000).toISOString());
    const done = new Set((have ?? []).map((r) => `${r.series}|${Date.parse(r.at) / 1000}`));
    const rows: Record<string, unknown>[] = [];
    const fetchedAt = new Date().toISOString();
    const todo = (series: string) => [...(need.get(series) ?? [])].filter((at) => !done.has(`${series}|${at}`));
    try {
      const cryptoDue = [...need.keys()].filter(isCrypto).flatMap((s) => todo(s).filter((at) => now - at <= CRYPTO_GRACE_SEC).map((at) => ({ s, at })));
      if (cryptoDue.length) { const prices = await fetchPrices(); for (const { s, at } of cryptoDue) if (prices[s] !== undefined) rows.push({ series: s, at: new Date(at * 1000).toISOString(), value: prices[s], fetched_at: fetchedAt }); }
    } catch (e) { notes.push(`crypto: ${String((e as Error).message ?? e).slice(0, 80)}`); }
    try {
      const steamDue = [...need.keys()].filter((x) => x.startsWith("steam:")).flatMap((x) => todo(x).filter((at) => now - at <= CRYPTO_GRACE_SEC).map((at) => ({ x, at })));
      if (steamDue.length) { const c = await steamCounts(); for (const { x, at } of steamDue) { const v = c[x.slice(6)]; if (v !== undefined) rows.push({ series: x, at: new Date(at * 1000).toISOString(), value: v, fetched_at: fetchedAt }); } }
    } catch (e) { notes.push(`steam: ${String((e as Error).message ?? e).slice(0, 80)}`); }
    try {
      const kpDue = todo("kp");
      if (kpDue.length) { const { observed } = await kpSeries(); for (const at of kpDue) { const v = observed.get(at - 3 * 3600); if (v !== undefined) rows.push({ series: "kp", at: new Date(at * 1000).toISOString(), value: v, fetched_at: fetchedAt }); } }
    } catch (e) { notes.push(`kp: ${String((e as Error).message ?? e).slice(0, 80)}`); }
    // Wikimedia publishes a day's count some hours after midnight: look every 10 minutes, not every minute.
    for (const series of Math.floor(now / 60) % 10 === 0 ? [...need.keys()].filter((s) => s.startsWith("wiki:")) : []) {
      try {
        for (const at of todo(series)) {
          const day = wikiDay(at - 86400), v = (await wikiViews(series.slice(5), at - 86400, at - 86400)).get(day);
          if (v !== undefined) rows.push({ series, at: new Date(at * 1000).toISOString(), value: v, fetched_at: fetchedAt });
        }
      } catch (e) { notes.push(`${series}: ${String((e as Error).message ?? e).slice(0, 60)}`); }
    }
    if (rows.length) { const { error } = await sb.from("tick_observations").upsert(rows, { onConflict: "series,at", ignoreDuplicates: true }); if (error) throw new Error(error.message); notes.push(`${rows.length} readings`); }
  }
  // 2. Hourly: new questions from the current numbers.
  if (now - last >= 3600 - 5) {
    await sb.from("feed_health").upsert({ feed_id: "ticks", last_attempt_at: new Date(now * 1000).toISOString() });
    const markets: Record<string, unknown>[] = [];
    let ok = 0;
    try { markets.push(...buildCryptoMarkets(await fetchPrices(), now)); ok++; } catch (e) { notes.push(`prices: ${String((e as Error).message ?? e).slice(0, 80)}`); }
    let steamNow: Record<string, number> = {};
    try { steamNow = await steamCounts(); markets.push(...buildSteamMarkets(steamNow, now)); ok++; } catch (e) { notes.push(`steam: ${String((e as Error).message ?? e).slice(0, 80)}`); }
    try { markets.push(...buildKpMarkets((await kpSeries()).predicted, now)); ok++; } catch (e) { notes.push(`kp: ${String((e as Error).message ?? e).slice(0, 80)}`); }
    try {
      const means: Record<string, number> = {};
      for (const t of WIKI_ARTICLES) {
        const m = await wikiViews(t, now - 8 * 86400, now - 86400);
        const v = [...m.values()]; if (v.length >= 5) means[t] = v.reduce((a, b) => a + b, 0) / v.length;
      }
      markets.push(...buildWikiMarkets(means, now)); ok++;
    } catch (e) { notes.push(`wiki: ${String((e as Error).message ?? e).slice(0, 80)}`); }
    if (markets.length) { const { error } = await sb.from("markets").upsert(markets, { onConflict: "dedupe_key", ignoreDuplicates: true }); if (error) throw new Error(error.message); }
    notes.push(`${markets.length} offered`);
    // History for the charts: coin prices by the hour (last ~2 days), Kp by 3-hour window, page views by day.
    try {
      const hist: Record<string, unknown>[] = [];
      for (const k of Object.keys(CRYPTO) as CryptoSeries[]) {
        const j = await getJson(`https://api.coingecko.com/api/v3/coins/${CRYPTO[k].id}/market_chart?vs_currency=usd&days=3`);
        const byHour = new Map<number, number>();
        for (const [t, v] of (j?.prices ?? []) as [number, number][]) if (typeof v === "number") byHour.set(Math.floor(t / 3_600_000) * 3600, v);
        for (const [at, value] of byHour) hist.push({ series: `px:${k}`, at: new Date(at * 1000).toISOString(), value: Math.round(value * 100) / 100 });
      }
      for (const [id, n] of Object.entries(steamNow)) hist.push({ series: `steam:${id}`, at: new Date(Math.floor(now / 3600) * 3600 * 1000).toISOString(), value: n });
      const { observed } = await kpSeries();
      for (const [at, value] of observed) hist.push({ series: "kp", at: new Date(at * 1000).toISOString(), value });
      for (const t of WIKI_ARTICLES) {
        try { for (const [d, v] of await wikiViews(t, now - 15 * 86400, now - 86400)) hist.push({ series: `wiki:${t}`, at: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00Z`, value: v }); } catch { /* chart just stays shorter */ }
      }
      for (let i = 0; i < hist.length; i += 500) await sb.from("tick_history").upsert(hist.slice(i, i + 500), { onConflict: "series,at" });
      notes.push(`${hist.length} history`);
    } catch (e) { notes.push(`history: ${String((e as Error).message ?? e).slice(0, 60)}`); }
    if (ok > 0) await sb.from("feed_health").upsert({ feed_id: "ticks", last_ok_at: new Date().toISOString(), last_error: null });
    else await sb.from("feed_health").upsert({ feed_id: "ticks", last_error: notes.join("; ").slice(0, 300), last_error_at: new Date().toISOString() });
  }
  return notes.join("; ") || "idle";
}


// ---- Football (Serie A) from TheSportsDB. The free test key ("3") is for development: markets made with it are private (testOnly) until a paid key is set. ----
const SERIE_A = "4332";
async function ingestSport(sb: ReturnType<typeof db>, now: number, last: number): Promise<string> {
  const key = Deno.env.get("SPORTSDB_KEY") || "3";
  const base = `https://www.thesportsdb.com/api/v1/json/${key}`;
  const notes: string[] = [];
  // 1. Matches that should be over: store the final score once it is published.
  const { data: open } = await sb.from("markets").select("params").eq("kind", "match_bet").eq("status", "open").lte("target_at", new Date(now * 1000).toISOString()).limit(100);
  const ids = [...new Set((open ?? []).map((m) => String((m.params as { eventId: string }).eventId)))];
  if (ids.length) {
    const { data: have } = await sb.from("match_results").select("event_id,status").in("event_id", ids);
    const done = new Set((have ?? []).filter((r) => FINISHED.has(String(r.status))).map((r) => r.event_id as string));
    const rows: Record<string, unknown>[] = [];
    for (const id of ids.filter((x) => !done.has(x)).slice(0, 12)) {
      try {
        const e = ((await getJson(`${base}/lookupevent.php?id=${id}`))?.events ?? [])[0];
        if (!e) continue;
        const hg = e.intHomeScore === null || e.intHomeScore === undefined ? null : Number(e.intHomeScore), ag = e.intAwayScore === null || e.intAwayScore === undefined ? null : Number(e.intAwayScore);
        rows.push({ event_id: id, kickoff: `${String(e.strTimestamp)}Z`, home_goals: hg, away_goals: ag, status: String(e.strStatus ?? ""), fetched_at: new Date().toISOString() });
      } catch (e) { notes.push(`result ${id}: ${String((e as Error).message ?? e).slice(0, 50)}`); }
    }
    if (rows.length) { const { error } = await sb.from("match_results").upsert(rows, { onConflict: "event_id" }); if (error) throw new Error(error.message); notes.push(`${rows.length} results`); }
  }
  // 2. Hourly: the next two rounds become questions.
  if (now - last >= 3600 - 5) {
    await sb.from("feed_health").upsert({ feed_id: "sportsdb", last_attempt_at: new Date(now * 1000).toISOString() });
    try {
      const next = ((await getJson(`${base}/eventsnextleague.php?id=${SERIE_A}`))?.events ?? [])[0];
      if (!next) throw new Error("no upcoming Serie A match");
      const round = Number(next.intRound), season = String(next.strSeason);
      const fixtures: Fixture[] = [];
      for (const r of [round, round + 1]) {
        for (const e of ((await getJson(`${base}/eventsround.php?id=${SERIE_A}&r=${r}&s=${season}`))?.events ?? []) as Record<string, string>[]) {
          const k = Date.parse(`${e.strTimestamp}Z`) / 1000;
          if (e.idEvent && e.strHomeTeam && e.strAwayTeam && Number.isFinite(k)) fixtures.push({ eventId: e.idEvent, league: "Serie A", home: e.strHomeTeam, away: e.strAwayTeam, kickoff: k });
        }
      }
      let table: TableRow[] = [];
      try { table = (((await getJson(`${base}/lookuptable.php?l=${SERIE_A}&s=${season}`))?.table ?? []) as Record<string, string>[]).map((r) => ({ team: r.strTeam!, played: Number(r.intPlayed), points: Number(r.intPoints), goalsFor: Number(r.intGoalsFor), goalsAgainst: Number(r.intGoalsAgainst) })); } catch { /* priors fall back to averages */ }
      const markets = buildMatchMarkets(fixtures, table, now, key === "3");
      if (markets.length) { const { error } = await sb.from("markets").upsert(markets, { onConflict: "dedupe_key", ignoreDuplicates: true }); if (error) throw new Error(error.message); }
      await sb.from("feed_health").upsert({ feed_id: "sportsdb", last_ok_at: new Date().toISOString(), last_error: null });
      notes.push(`${fixtures.length} fixtures, ${markets.length} offered`);
    } catch (e) {
      await sb.from("feed_health").upsert({ feed_id: "sportsdb", last_error: String((e as Error).message ?? e).slice(0, 300), last_error_at: new Date().toISOString() });
      throw e;
    }
  }
  return notes.join("; ") || "idle";
}
