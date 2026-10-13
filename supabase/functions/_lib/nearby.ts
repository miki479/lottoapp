// Shared by the Edge Functions `nearby` and `stop-offer`: who is asking, how often, the real-time feed (decoded once per 20 seconds per
// instance), and the arrivals at some stops. A position is only ever used inside one request: nothing here stores or logs it.
import GtfsRt from "npm:gtfs-realtime-bindings@2.2.0";
import type { RtFeed } from "../_shared/shared/adapters/types.ts";
import { addDays, localDateString } from "../_shared/shared/time.ts";
import { createRateLimiter, decodeTimetable, extractArrivals, type RawArrival } from "../_shared/shared/nearby.ts";
import { nearbyFeeds, type NearbyFeed } from "../_shared/shared/stops.ts";
import { db, loadCities } from "./common.ts";

export const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Sb = ReturnType<typeof db>;

/** The signed-in player (guests included), or null. */
export async function player(req: Request, sb: Sb): Promise<{ uid: string; anonymous: boolean } | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await sb.auth.getUser(token);
  return u?.user?.id ? { uid: u.user.id, anonymous: !!u.user.is_anonymous } : null;
}

/** 12 calls per 10 minutes per player: first in this instance's memory, then in the shared counter. A broken counter never blocks anyone. */
const PER_WINDOW = 12, WINDOW_SEC = 600;
const local = createRateLimiter(PER_WINDOW, WINDOW_SEC * 1000);
export async function allowCall(sb: Sb, uid: string): Promise<boolean> {
  if (!local.hit(uid, Date.now())) return false;
  try {
    const { data, error } = await sb.rpc("nearby_hit", { p_user: uid, p_max: PER_WINDOW, p_window_sec: WINDOW_SEC });
    return error ? true : data !== false;
  } catch { return true; }
}

let feedsCache: Map<string, NearbyFeed> | null = null;
/** The feeds this can serve, by feed id. */
export async function servedFeeds(): Promise<Map<string, NearbyFeed>> {
  if (!feedsCache) feedsCache = new Map(nearbyFeeds(await loadCities()).map((f) => [f.feed.id, f]));
  return feedsCache;
}

// ---- the real-time feed, kept for 20 seconds so a crowd asking at once costs the operator one request ----
const TTL_MS = 20_000, FAIL_TTL_MS = 5_000, MAX_BYTES = 6 * 1024 * 1024, FETCH_TIMEOUT_MS = 9_000, MAX_CACHED = 8;
const cache = new Map<string, { at: number; ttl: number; feed: Promise<RtFeed | null> }>();

async function fetchFeed(f: NearbyFeed, now: number): Promise<RtFeed | null> {
  const headers: Record<string, string> = { ...(f.feed.headers ?? {}), "User-Agent": `LateLotto/0.1 (play-money game; contact: ${Deno.env.get("CONTACT_EMAIL") ?? "unset"})`, "Accept-Encoding": "gzip" };
  // BusOne asks every client to say who it is and how to reach it: the contact comes from the environment, never from the repository.
  if (headers["X-BusOne-Client"] && Deno.env.get("CONTACT_EMAIL")) headers["X-BusOne-Client"] += `; contact: ${Deno.env.get("CONTACT_EMAIL")}`;
  let url = f.feed.url;
  if (f.feed.requiresKey) {
    const key = Deno.env.get(f.feed.requiresKey);
    if (!key) return null;
    if (f.feed.keyIn === "header") headers[f.feed.keyHeader ?? "Authorization"] = `${f.feed.keyPrefix ?? ""}${key}`;
    else url += `${url.includes("?") ? "&" : "?"}acl:consumerKey=${encodeURIComponent(key)}`;
  }
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null; // too big to decode while a player waits
  const msg = GtfsRt.transit_realtime.FeedMessage.toObject(GtfsRt.transit_realtime.FeedMessage.decode(bytes), { longs: Number }) as RtFeed;
  // a feed that stopped updating is not a source of arrivals
  const ts = Number(msg.header?.timestamp ?? 0);
  if (ts > 0 && now - ts > Math.max(f.feed.staleAfterSeconds, 180)) return null;
  return msg.entity?.length ? msg : null;
}

/** The decoded TripUpdates of a feed, or null whenever anything is wrong (no key, down, stale, too big): callers treat that as "nothing to show". */
export function realtimeFeed(f: NearbyFeed): Promise<RtFeed | null> {
  const t = Date.now(), hit = cache.get(f.feed.id);
  if (hit && t - hit.at < hit.ttl) return hit.feed;
  const feed = fetchFeed(f, Math.floor(t / 1000)).catch(() => null);
  cache.set(f.feed.id, { at: t, ttl: TTL_MS, feed });
  void feed.then((m) => { if (!m) { const c = cache.get(f.feed.id); if (c && c.feed === feed) c.ttl = FAIL_TTL_MS; } });
  if (cache.size > MAX_CACHED) { const oldest = [...cache].sort((a, b) => a[1].at - b[1].at)[0]; if (oldest) cache.delete(oldest[0]); }
  return feed;
}

/** What the feed expects at these stops soon (empty when it cannot say). */
export async function arrivalsAt(sb: Sb, f: NearbyFeed, stopIds: string[], now: number): Promise<RawArrival[]> {
  if (stopIds.length === 0) return [];
  const msg = await realtimeFeed(f);
  if (!msg) return [];
  let timetable;
  if (f.support === "timetable") {
    const tz = f.city.timezone, today = localDateString(now, tz);
    const { data } = await sb.from("gtfs_departures").select("stop_id,service_date,trips").eq("feed_id", f.feed.id).in("stop_id", stopIds).in("service_date", [addDays(today, -1), today, addDays(today, 1)]);
    timetable = decodeTimetable((data ?? []) as { stop_id: string; service_date: string; trips: unknown }[], tz);
    if (timetable.length === 0) return [];
  }
  return extractArrivals(msg, { kind: f.feed.kind, stopIds: new Set(stopIds), now, tripKey: f.feed.tripKey, timetable });
}

/** Names of routes: short name first, the long one when there is none. */
export async function routeNames(sb: Sb, feedId: string, routeIds: string[]): Promise<Map<string, { short: string; long: string }>> {
  const ids = [...new Set(routeIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const { data } = await sb.from("gtfs_routes").select("route_id,short_name,long_name").eq("feed_id", feedId).in("route_id", ids);
  return new Map((data ?? []).map((r) => [r.route_id as string, { short: (r.short_name as string) ?? "", long: (r.long_name as string) ?? "" }]));
}
