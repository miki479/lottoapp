// "What is about to pass near me": the stops closest to a point (rounded to ~100 m by the caller and again here) and what the real-time
// feed expects there in the next 45 minutes. Needs a signed-in player (guests included). The position is used inside this request and
// never stored or logged. Everything degrades to an empty list: no stops, no feed, no arrivals.
import { db, safe } from "../_lib/common.ts";
import { CORS, allowCall, arrivalsAt, json, player, routeNames, servedFeeds } from "../_lib/nearby.ts";
import { ROUNDING_ERROR_M } from "../_shared/shared/geo.ts";
import { MAX_ARRIVALS, MAX_ARRIVALS_PER_STOP, MAX_STOPS, offerWindowOk, parseNearbyRequest } from "../_shared/shared/nearby.ts";

interface StopRow { feed_id: string; stop_id: string; name: string; lat: number; lon: number; city_id: string; distance_m: number }

Deno.serve(safe(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const sb = db();
  const me = await player(req, sb);
  if (!me) return json({ error: "unauthorized" }, 401);
  const r = parseNearbyRequest(await req.json().catch(() => null));
  if (!r) return json({ error: "bad_request" }, 400);
  if (!(await allowCall(sb, me.uid))) return json({ error: "rate_limited" }, 429);

  const { data: found } = await sb.rpc("nearby_stops", { p_lat: r.lat, p_lon: r.lon, p_radius_m: r.radiusM + ROUNDING_ERROR_M, p_limit: MAX_STOPS });
  const feeds = await servedFeeds();
  const stops = ((found ?? []) as StopRow[]).filter((s) => feeds.has(s.feed_id));
  if (stops.length === 0) return json({ stops: [], arrivals: [] });

  const now = Math.floor(Date.now() / 1000);
  const byFeed = new Map<string, StopRow[]>();
  for (const s of stops) byFeed.set(s.feed_id, [...(byFeed.get(s.feed_id) ?? []), s]);

  const out: Record<string, unknown>[] = [];
  await Promise.all([...byFeed].map(async ([feedId, list]) => {
    const f = feeds.get(feedId)!;
    const arrivals = await arrivalsAt(sb, f, list.map((s) => s.stop_id), now).catch(() => []);
    if (arrivals.length === 0) return;
    const names = await routeNames(sb, feedId, arrivals.map((a) => a.routeId)).catch(() => new Map());
    // questions that already exist for these stops: the app opens them instead of making new ones
    const { data: open } = await sb.from("markets").select("id,params").eq("feed_id", feedId).eq("status", "open").in("params->>stopId", list.map((s) => s.stop_id)).gt("closes_at", new Date().toISOString()).limit(200);
    const have = new Map((open ?? []).map((m) => [`${(m.params as { tripId?: string }).tripId}|${(m.params as { stopId?: string }).stopId}`, m.id as string]));
    const perStop = new Map<string, number>();
    for (const a of arrivals) {
      const n = perStop.get(a.stopId) ?? 0;
      if (n >= MAX_ARRIVALS_PER_STOP) continue;
      perStop.set(a.stopId, n + 1);
      const s = list.find((x) => x.stop_id === a.stopId)!, nm = names.get(a.routeId);
      const marketId = have.get(`${a.tripId}|${a.stopId}`) ?? null;
      out.push({
        feedId, cityId: f.city.id, category: f.feed.category, tripId: a.tripId, routeName: nm?.short || nm?.long || a.routeId || "", headsign: a.headsign,
        stopId: a.stopId, stopName: s.name, distanceM: s.distance_m, scheduledAt: a.scheduledAt, predictedAt: a.predictedAt, delaySec: a.delaySec,
        marketId, offerable: marketId === null && offerWindowOk(a.scheduledAt, now),
      });
    }
  }));
  out.sort((a, b) => Number(a.predictedAt) - Number(b.predictedAt));
  return json({ stops: stops.map((s) => ({ id: s.stop_id, feedId: s.feed_id, name: s.name, lat: s.lat, lon: s.lon, distanceM: s.distance_m })), arrivals: out.slice(0, MAX_ARRIVALS) });
}));
