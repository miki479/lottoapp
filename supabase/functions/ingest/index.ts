// Runs every minute (pg_cron). For each usable feed that is due: fetch, parse, keep what matters,
// record feed health. A failing feed is recorded as failing; its markets get voided by `resolve`.
import GtfsRt from "npm:gtfs-realtime-bindings@2.2.0";
import { delayAdapterFor, trainJsonAdapterFor, weatherAdapterFor } from "../_shared/shared/adapters/index.ts";
import { parseTrainTripId } from "../_shared/shared/adapters/viaggiatreno.ts";
import type { RtFeed, ScheduleLookup } from "../_shared/shared/adapters/types.ts";
import { allowUnverified, db, feedUrl, loadCities, requireCron, safe, usableFeeds, type CityConfig, type FeedConfig } from "../_lib/common.ts";

const FETCH_TIMEOUT_MS = 25_000;
const MAX_BYTES = 12 * 1024 * 1024;

Deno.serve(safe(async (req) => {
  const denied = requireCron(req);
  if (denied) return denied;
  const sb = db();
  const now = Math.floor(Date.now() / 1000);
  const report: Record<string, string> = {};

  const { data: healthRows } = await sb.from("feed_health").select("feed_id,last_attempt_at");
  const lastAttempt = new Map((healthRows ?? []).map((h) => [h.feed_id, h.last_attempt_at ? Date.parse(h.last_attempt_at) / 1000 : 0]));

  // Trips that have an open (or just closed) market: only those are worth storing.
  const since = new Date((now - 3600) * 1000).toISOString();
  const { data: live } = await sb.from("markets").select("feed_id,params").gte("deadline_at", since).in("status", ["open"]);
  // feed -> trip -> stops the markets ask about
  const tracked = new Map<string, Map<string, Set<string>>>();
  for (const m of live ?? []) {
    const p = m.params as { tripId?: string; stopId?: string };
    if (!p.tripId) continue;
    if (!tracked.has(m.feed_id)) tracked.set(m.feed_id, new Map());
    const trips = tracked.get(m.feed_id)!;
    if (!trips.has(p.tripId)) trips.set(p.tripId, new Set());
    if (p.stopId) trips.get(p.tripId)!.add(p.stopId);
  }

  const seen = new Set<string>();
  for (const city of await loadCities()) {
    for (const feed of usableFeeds(city, allowUnverified())) {
      // Feed ids are globally unique (weather feeds are per city); a national feed listed by two cities is fetched once.
      if (seen.has(feed.id)) continue;
      seen.add(feed.id);
      if (now - (lastAttempt.get(feed.id) ?? 0) < feed.pollSeconds - 5) { report[feed.id] = "not due"; continue; }
      await sb.from("feed_health").upsert({ feed_id: feed.id, last_attempt_at: new Date(now * 1000).toISOString() });
      try {
        const n = await ingestFeed(sb, city, feed, now, tracked.get(feed.id) ?? new Map());
        await sb.from("feed_health").upsert({ feed_id: feed.id, last_ok_at: new Date().toISOString(), last_error: null });
        report[feed.id] = `ok ${n}`;
      } catch (e) {
        const msg = String((e as Error).message ?? e).slice(0, 300);
        await sb.from("feed_health").upsert({ feed_id: feed.id, last_error: msg, last_error_at: new Date().toISOString() });
        report[feed.id] = `error: ${msg}`;
      }
    }
  }
  return Response.json(report);
}));

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { "User-Agent": `LateLotto/0.1 (play-money game; contact: ${Deno.env.get("CONTACT_EMAIL") ?? "unset"})`, "Accept-Encoding": "gzip" }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) throw new Error(`unexpected size ${buf.byteLength}`);
  return buf;
}

async function ingestFeed(sb: ReturnType<typeof db>, city: CityConfig, feed: FeedConfig, now: number, tracked: Map<string, Set<string>>): Promise<number> {
  const url = feedUrl(feed, city);
  if (feed.type === "open-meteo") {
    const adapter = weatherAdapterFor(feed)!;
    const obs = adapter(JSON.parse(new TextDecoder().decode(await fetchBytes(url))), feed.id);
    if (obs.length === 0) throw new Error("no weather data in response");
    const rows = obs.map((o) => ({ city_id: city.id, feed_id: feed.id, hour_start: new Date(o.hourStart * 1000).toISOString(), precipitation_mm: Math.max(0, o.precipitationMm) }));
    const { error } = await sb.from("weather_observations").upsert(rows, { onConflict: "feed_id,hour_start" });
    if (error) throw new Error(error.message);
    return rows.length;
  }

  const adapter = delayAdapterFor(feed);
  if (!adapter) throw new Error(`no adapter for ${feed.type}/${feed.kind}`);
  const bytes = await fetchBytes(url);
  const msg = GtfsRt.transit_realtime.FeedMessage.toObject(GtfsRt.transit_realtime.FeedMessage.decode(bytes), { longs: Number }) as RtFeed;
  const trips = new Set(tracked.keys());
  if (trips.size === 0) return 0; // nothing to resolve right now (e.g. no service at night): healthy, nothing stored
  // With markets waiting for data, an empty feed is an outage, not "no delays".
  if (!msg.entity?.length) throw new Error("empty feed");

  let schedule: ScheduleLookup | undefined;
  if (feed.kind === "vehicle_positions") {
    const { data } = await sb.from("trip_schedule").select("trip_id,stop_sequence,stop_id,scheduled_time").eq("feed_id", feed.id).in("trip_id", [...trips]);
    const map = new Map((data ?? []).map((r) => [`${r.trip_id}|${r.stop_sequence}`, { stopId: r.stop_id as string, time: r.scheduled_time as string }]));
    schedule = (trip, seq) => map.get(`${trip}|${seq}`) ?? null;
  }
  const all = adapter(msg, { feedId: feed.id, timezone: city.timezone, fetchedAt: now, schedule });
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
