// Fetch every usable feed that is due and keep only what a live market needs.
// Firestore free quota is 20k writes/day, so we never store a reading outside a market's window.
import GtfsRt from "gtfs-realtime-bindings";
import { delayAdapterFor, weatherAdapterFor } from "./_shared/shared/adapters/index.ts";
import type { RtFeed, ScheduleLookup } from "./_shared/shared/adapters/types.ts";
import { allowUnverified, cities, db, feedUrl, fromEpoch, safeId, toEpoch, usableFeeds, type CityConfig, type FeedConfig } from "./common.ts";

const FETCH_TIMEOUT_MS = 25_000;
const MAX_BYTES = 12 * 1024 * 1024;
/** Readings are only stored from this long before the target until the deadline. */
const TRACK_LEAD_SEC = 15 * 60;
/** Idle feeds are still polled this often so their health stays current. */
const HEALTH_PING_SEC = 15 * 60;

interface Tracked { tripId: string; stopId: string; targetAt: number; deadlineAt: number; feedId: string }

let marketCache: { at: number; rows: Tracked[] } = { at: 0, rows: [] };
async function trackedMarkets(now: number): Promise<Tracked[]> {
  if (now - marketCache.at < 600) return marketCache.rows; // 10-minute cache: saves ~40k reads/day
  const snap = await db.collection("markets").where("status", "==", "open").where("deadlineAt", ">=", fromEpoch(now - 3600)).get();
  const rows: Tracked[] = [];
  for (const d of snap.docs) {
    const m = d.data();
    if (m.kind === "rain_at") continue;
    rows.push({ tripId: m.params.tripId, stopId: m.params.stopId, feedId: m.feedId, targetAt: toEpoch(m.targetAt), deadlineAt: toEpoch(m.deadlineAt) });
  }
  marketCache = { at: now, rows };
  return rows;
}

export async function ingestAll(now = Math.floor(Date.now() / 1000)): Promise<Record<string, string>> {
  const report: Record<string, string> = {};
  const health = new Map((await db.collection("feedHealth").get()).docs.map((d) => [d.id, d.data()]));
  const tracked = await trackedMarkets(now);
  const seen = new Set<string>();

  for (const city of cities) {
    for (const feed of usableFeeds(city, allowUnverified())) {
      if (seen.has(feed.id)) continue;
      seen.add(feed.id);
      const active = tracked.filter((t) => t.feedId === feed.id && now >= t.targetAt - TRACK_LEAD_SEC && now <= t.deadlineAt);
      const lastAttempt = health.get(feed.id)?.lastAttemptAt ? toEpoch(health.get(feed.id)!.lastAttemptAt) : 0;
      const since = now - lastAttempt;
      const isWeather = feed.category === "weather";
      const due = isWeather ? since >= feed.pollSeconds - 5 : active.length > 0 ? since >= feed.pollSeconds - 5 : since >= HEALTH_PING_SEC;
      if (!due) { report[feed.id] = "not due"; continue; }

      const ref = db.collection("feedHealth").doc(feed.id);
      await ref.set({ lastAttemptAt: fromEpoch(now) }, { merge: true });
      try {
        const n = await ingestFeed(city, feed, now, active);
        await ref.set({ lastOkAt: fromEpoch(now), lastError: null }, { merge: true });
        report[feed.id] = `ok ${n}`;
      } catch (e) {
        const msg = String((e as Error).message ?? e).slice(0, 300);
        await ref.set({ lastError: msg, lastErrorAt: fromEpoch(now) }, { merge: true });
        report[feed.id] = `error: ${msg}`;
      }
    }
  }
  return report;
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { "User-Agent": "lottoapp/0.1 (play-money game)" }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) throw new Error(`unexpected size ${buf.byteLength}`);
  return buf;
}

const scheduleCache = new Map<string, Map<number, { stopId: string; time: string }>>();
async function scheduleFor(feedId: string, tripIds: string[]): Promise<ScheduleLookup> {
  for (const t of tripIds) {
    const key = safeId(feedId, t);
    if (scheduleCache.has(key)) continue;
    const doc = await db.collection("tripSchedule").doc(key).get();
    const stops = (doc.data()?.stops ?? {}) as Record<string, { stopId: string; time: string }>;
    scheduleCache.set(key, new Map(Object.entries(stops).map(([seq, v]) => [Number(seq), v])));
  }
  return (trip, seq) => scheduleCache.get(safeId(feedId, trip))?.get(seq) ?? null;
}

async function ingestFeed(city: CityConfig, feed: FeedConfig, now: number, active: Tracked[]): Promise<number> {
  const url = feedUrl(feed, city);

  if (feed.type === "open-meteo") {
    const adapter = weatherAdapterFor(feed)!;
    const obs = adapter(JSON.parse(new TextDecoder().decode(await fetchBytes(url))), feed.id);
    if (obs.length === 0) throw new Error("no weather data in response");
    // Only hours that have started (and ended hours of the last 6h) can settle a market.
    const keep = obs.filter((o) => o.hourStart <= now && o.hourStart >= now - 6 * 3600);
    const batch = db.batch();
    for (const o of keep) {
      batch.set(db.collection("weatherObservations").doc(safeId(feed.id, String(o.hourStart))), {
        cityId: city.id, feedId: feed.id, hourStart: fromEpoch(o.hourStart), precipitationMm: Math.max(0, o.precipitationMm),
      });
    }
    await batch.commit();
    return keep.length;
  }

  const adapter = delayAdapterFor(feed);
  if (!adapter) throw new Error(`no adapter for ${feed.type}/${feed.kind}`);
  const msg = GtfsRt.transit_realtime.FeedMessage.toObject(
    GtfsRt.transit_realtime.FeedMessage.decode(await fetchBytes(url)), { longs: Number },
  ) as RtFeed;
  if (!msg.entity?.length) throw new Error("empty feed"); // an empty feed is an outage, not "no delays"
  if (active.length === 0) return 0;

  const trips = [...new Set(active.map((a) => a.tripId))];
  const schedule = feed.kind === "vehicle_positions" ? await scheduleFor(feed.id, trips) : undefined;
  const wanted = new Set(active.map((a) => `${a.tripId}|${a.stopId}`));
  const mine = adapter(msg, { feedId: feed.id, timezone: city.timezone, fetchedAt: now, schedule }).filter((o) => wanted.has(`${o.tripId}|${o.stopId}`));
  if (mine.length === 0) return 0;

  const batch = db.batch();
  for (const o of mine) {
    batch.set(
      db.collection("delayObservations").doc(safeId(feed.id, o.tripId, o.stopId)),
      { feedId: feed.id, readings: { [String(o.observedAt)]: { delaySec: Math.round(o.delaySec), ...(o.predictedAt ? { predictedAt: o.predictedAt } : {}) } } },
      { merge: true },
    );
  }
  await batch.commit();
  return mine.length;
}
