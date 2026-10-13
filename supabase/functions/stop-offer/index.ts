// Opens the question "will this bus/train be late at this stop?" for one arrival returned by `nearby`. The server checks everything again:
// the trip must really be in the live feed at that stop, the time must be 5-60 minutes away, and the player's daily and open limits apply.
import { db, loadCities, safe } from "../_lib/common.ts";
import { CORS, allowCall, arrivalsAt, json, player, routeNames, servedFeeds } from "../_lib/nearby.ts";
import { NEARBY_OPEN_PER_USER, NEARBY_PER_USER_PER_DAY, buildStopMarket, hms, offerWindowOk } from "../_shared/shared/nearby.ts";
import { DEFAULT_YES_PROBABILITY, learnedPrior } from "../_shared/shared/odds.ts";

const id = (v: unknown) => (typeof v === "string" && v.length > 0 && v.length <= 200 ? v : null);

Deno.serve(safe(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const sb = db();
  const me = await player(req, sb);
  if (!me) return json({ error: "unauthorized" }, 401);
  const b = (await req.json().catch(() => null)) as { feedId?: unknown; tripId?: unknown; stopId?: unknown } | null;
  const feedId = id(b?.feedId), tripId = id(b?.tripId), stopId = id(b?.stopId);
  if (!feedId || !tripId || !stopId) return json({ error: "bad_request" }, 400);
  if (!(await allowCall(sb, me.uid))) return json({ error: "rate_limited" }, 429);

  const f = (await servedFeeds()).get(feedId);
  if (!f) return json({ error: "unknown_feed" }, 404);
  const { data: stop } = await sb.from("gtfs_stops").select("name,lat,lon").eq("feed_id", feedId).eq("stop_id", stopId).maybeSingle();
  if (!stop) return json({ error: "unknown_stop" }, 404);

  const now = Math.floor(Date.now() / 1000);
  const a = (await arrivalsAt(sb, f, [stopId], now)).find((x) => x.tripId === tripId && x.stopId === stopId);
  if (!a) return json({ error: "not_in_feed" }, 404);
  if (!offerWindowOk(a.scheduledAt, now)) return json({ error: "bad_time" }, 400);

  // Limits: a handful a day, and only a few open at once.
  const since = new Date(Date.now() - 86400_000).toISOString();
  const [{ count: today }, { count: open }] = await Promise.all([
    sb.from("markets").select("id", { count: "exact", head: true }).eq("created_by", me.uid).eq("params->>nearby", "true").gt("created_at", since),
    sb.from("markets").select("id", { count: "exact", head: true }).eq("created_by", me.uid).eq("params->>nearby", "true").eq("status", "open"),
  ]);
  if ((today ?? 0) >= NEARBY_PER_USER_PER_DAY || (open ?? 0) >= NEARBY_OPEN_PER_USER) return json({ error: "limit" }, 429);

  // price it like the generator does: the learned chance of "late" in this country, shrunk toward the fixed guess
  const kind = f.feed.category === "train" ? "train_delay_gt" : "bus_delay_gt", base = DEFAULT_YES_PROBABILITY[kind];
  const sameCountry = (await loadCities()).filter((c) => c.country === f.city.country).map((c) => c.id);
  const { data: rows } = await sb.from("markets").select("outcome").eq("category", f.feed.category).eq("kind", kind).eq("status", "resolved").in("city_id", sameCountry).limit(1000);
  const yes = (rows ?? []).filter((r) => r.outcome === "yes").length;
  const priorYes = learnedPrior(yes, (rows ?? []).length, base);

  const names = await routeNames(sb, feedId, [a.routeId]);
  const nm = names.get(a.routeId);
  const m = buildStopMarket({
    cityId: f.city.id, tz: f.city.timezone, feedId, category: f.feed.category as "bus" | "train", routeId: a.routeId, routeName: nm?.short || nm?.long || a.routeId, headsign: a.headsign,
    tripId, stopId, stopName: stop.name as string, stopLat: Number(stop.lat), stopLon: Number(stop.lon), stopSequence: a.stopSequence, scheduledAt: a.scheduledAt!, date: a.date, secs: a.secs,
    delaySec: a.delaySec, history: null, priorYes, occBonus: f.feed.occupancy, posEst: f.feed.positionsEstimated, now,
  });
  const have = await sb.from("markets").select("*").eq("dedupe_key", m.dedupe_key).maybeSingle();
  if (have.data) return json({ market: have.data, existing: true });

  // feeds that only number their stops resolve against the timetable row of this very stop
  if (f.support === "timetable" && a.date && a.secs != null && a.stopSequence !== null) {
    await sb.from("trip_schedule").upsert({ feed_id: feedId, trip_id: tripId, stop_sequence: a.stopSequence, stop_id: stopId, scheduled_time: hms(a.secs), service_date: a.date }, { onConflict: "feed_id,trip_id,stop_sequence" });
  }
  const { data: row, error } = await sb.from("markets").insert({ ...m, created_by: me.uid }).select("*").single();
  if (error) return json({ error: error.message }, 500);
  return json({ market: row });
}));
