// Runs every minute after `ingest`. Settles markets whose time has come, or voids them with a refund.
import { resolveEvent } from "../_shared/shared/resolve.ts";
import { historyKey, marketToEvent, type MarketRow } from "../_shared/shared/market.ts";
import { parseStrikeRss } from "../_shared/shared/strikes.ts";
import { isDetailBet, isPlayerBet, type MatchObservation } from "../_shared/shared/sport.ts";
import { OCC_WINDOW_SEC } from "../_shared/shared/occupancy.ts";
import type { DelayObservation, MetricObservation, OccupancyObservation, QuakeReading, StrikeReading, TickObservation, TrafficObservation, WeatherObservation } from "../_shared/shared/types.ts";
import { db, loadCities, requireCron, safe } from "../_lib/common.ts";
import { cancelledMarkets } from "../_shared/shared/cancel.ts";
import { notifyOffers, notifyDirect, notifyComeback, notifyLiveDelay, notifyRecap, notifyRewards, notifyBroadcast, lastNotifyError, notifyFlash, notifyFriendWins, notifyInvites, notifyFriendRequests, notifyReminders, notifySupers, notifyModeration, notifyResults, notifyStreak, notifyOvertaken, notifyVotes, notifyLoss, notifyDaily, notifyTips } from "../_lib/notify.ts";

/** Markets that were still waiting for their data, and until when they are left alone (kept in the worker between runs). */
const pendingUntil = new Map<string, number>();

Deno.serve(safe(async (req) => {
  const denied = requireCron(req);
  if (denied) return denied;
  const sb = db();
  const nowIso = new Date().toISOString();
  const now = Math.floor(Date.now() / 1000);
  const cities = new Map((await loadCities()).map((c) => [c.id, c]));
  const feedStale = new Map<string, number>();
  for (const c of cities.values()) for (const f of c.feeds) feedStale.set(f.id, f.staleAfterSeconds);

  // Cancelled trips and stops: the open questions about them are refunded at once, whatever the time (the operator's own feed says so).
  try {
    const { data: gone } = await sb.from("trip_cancellations").select("feed_id,trip_id,stop_id,detected_at").gt("detected_at", new Date(Date.now() - 2 * 86400_000).toISOString()).limit(1000);
    if (gone && gone.length) {
      const trips = [...new Set(gone.map((g) => g.trip_id as string))].slice(0, 300);
      const { data: open } = await sb.from("markets").select("id,feed_id,target_at,params").eq("status", "open").in("kind", ["bus_delay_gt", "train_delay_gt", "bus_full"]).in("params->>tripId", trips).limit(300);
      const hits = cancelledMarkets((open ?? []) as { id: string; feed_id: string; target_at: string; params: Record<string, unknown> }[], gone.map((g) => ({ feed_id: g.feed_id as string, tripId: g.trip_id as string, stopId: (g.stop_id as string) || null, detectedAt: Date.parse(g.detected_at as string) / 1000 })));
      for (const m of hits) await sb.rpc("settle_market", { p_market: m.id, p_result: "void", p_evidence: null, p_void_reason: "cancelled" });
    }
  } catch (e) { console.error("cancellations", e); }

  // Only markets whose target time has passed can be settled.
  const { data: due, error } = await sb.from("markets").select("*").eq("status", "open").lte("target_at", nowIso).order("deadline_at").limit(500);
  if (error) return new Response(error.message, { status: 500 });

  // Places (any town a player searched for): their weather feed is shared, so health and staleness are tracked once.
  const placeIds = [...new Set((due ?? []).map((m) => m.city_id as string).filter((id) => id.startsWith("p-")))];
  const placeTz = new Map<string, string>();
  if (placeIds.length) for (const p of (await sb.from("places").select("id,timezone").in("id", placeIds)).data ?? []) placeTz.set(p.id as string, p.timezone as string);

  const { data: health } = await sb.from("feed_health").select("feed_id,last_ok_at");
  const lastOk = new Map((health ?? []).map((h) => [h.feed_id, h.last_ok_at ? Date.parse(h.last_ok_at) / 1000 : null]));

  const out = { settled: 0, voided: 0, pending: 0, errors: 0, skipped: 0 };
  // A run must end well inside the platform's limit (a minute-by-minute job that overruns piles up on itself and gets killed for resources): the due markets
  // are visited in a random order for at most ~40 s, and what is left waits for the next minute. Random, so markets that cannot be settled yet never hog the front.
  const t0 = Date.now(), dueList = [...((due ?? []) as (MarketRow & { id: string })[])];
  for (let i = dueList.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [dueList[i], dueList[j]] = [dueList[j]!, dueList[i]!]; }
  for (const row of dueList) {
    if (Date.now() - t0 > 40_000) { out.skipped++; continue; }
    if ((pendingUntil.get(row.id) ?? 0) > Date.now()) { out.skipped++; continue; } // waiting for data a moment ago: not worth asking again before a few minutes
    try {
      const event = marketToEvent(row);
      const city = cities.get(row.city_id) ?? (row.city_id === "world" ? ({ id: "world", timezone: "UTC" } as unknown as ReturnType<typeof cities.get> & object) : undefined) ?? (placeTz.has(row.city_id) ? ({ id: row.city_id, timezone: placeTz.get(row.city_id)! } as unknown as ReturnType<typeof cities.get> & object) : undefined);
      if (!city) throw new Error(`unknown city ${row.city_id}`);

      let delays: DelayObservation[] = [];
      let weather: WeatherObservation[] = [];
      let metrics: MetricObservation[] = [];
      let quake: QuakeReading | null = null;
      let strike: StrikeReading | null = null;
      let traffic: TrafficObservation[] = [];
      let ticks: TickObservation[] = [];
      let match: MatchObservation | null = null;
      let occupancy: OccupancyObservation[] = [];
      if (event.kind === "traffic_speed_lt") {
        const hour = new Date(Math.floor(event.targetAt / 3600) * 3600 * 1000).toISOString();
        const { data } = await sb.from("traffic_observations").select("feed_id,site_id,direction,hour_start,avg_kmh,vehicles,measured_at").eq("feed_id", event.feedId).eq("site_id", event.siteId).eq("direction", event.direction).eq("hour_start", hour);
        traffic = (data ?? []).map((o) => ({ feedId: o.feed_id, siteId: o.site_id, direction: o.direction, hourStart: Date.parse(o.hour_start) / 1000, avgKmh: Number(o.avg_kmh), vehicles: o.vehicles, measuredAt: Date.parse(o.measured_at) / 1000 }));
      } else if (event.kind === "strike_on") {
        const list = await strikeList();
        if (list) { strike = { present: list.some((s) => s.guid === event.guid && s.date === event.date) }; await sb.from("feed_health").upsert({ feed_id: "mit-scioperi", last_ok_at: new Date().toISOString(), last_error: null }); }
      } else if (event.kind === "quake_m") {
        quake = await usgsWindow(event.closesAt, event.targetAt, event.minMag, event.bbox, event.circle);
        if (quake) await sb.from("feed_health").upsert({ feed_id: "usgs", last_ok_at: new Date().toISOString(), last_error: null });
      } else if (event.kind === "match_bet") {
        const { data } = await sb.from("match_results").select("event_id,home_goals,away_goals,status,fetched_at").eq("event_id", event.eventId).maybeSingle();
        if (data) match = { eventId: data.event_id, homeGoals: data.home_goals, awayGoals: data.away_goals, status: data.status, fetchedAt: Date.parse(data.fetched_at) / 1000 };
        if (match && (isDetailBet(event.bet) || isPlayerBet(event.bet))) {
          const { data: d } = await sb.from("match_details").select("ht_home,ht_away,corners,cards,reds,players,fetched_at").eq("event_id", event.eventId).maybeSingle();
          if (d?.fetched_at) match = { ...match, htHome: d.ht_home, htAway: d.ht_away, corners: d.corners, cards: d.cards, reds: d.reds, players: d.players };
        }
      } else if (event.kind === "bus_full") {
        const lo = new Date((event.targetAt - OCC_WINDOW_SEC) * 1000).toISOString(), hi = new Date((event.targetAt + OCC_WINDOW_SEC) * 1000).toISOString();
        const { data } = await sb.from("occupancy_observations").select("feed_id,trip_id,at,level").eq("feed_id", event.feedId).eq("trip_id", event.tripId).gte("at", lo).lte("at", hi);
        occupancy = (data ?? []).map((o) => ({ feedId: o.feed_id, tripId: o.trip_id, at: Date.parse(o.at) / 1000, level: o.level }));
      } else if (event.kind === "tick_gt") {
        const { data } = await sb.from("tick_observations").select("series,at,value,fetched_at").eq("series", event.series).eq("at", new Date(event.targetAt * 1000).toISOString());
        ticks = (data ?? []).map((o) => ({ series: o.series, at: Date.parse(o.at) / 1000, value: Number(o.value), fetchedAt: Date.parse(o.fetched_at) / 1000 }));
      } else if (event.kind === "metric_gt") {
        const hour = new Date(Math.floor(event.targetAt / 3600) * 3600 * 1000).toISOString();
        const { data } = await sb.from("metric_observations").select("feed_id,metric,hour_start,value,fetched_at").eq("feed_id", event.feedId).eq("metric", event.metric).eq("hour_start", hour);
        metrics = (data ?? []).map((w) => ({ feedId: w.feed_id, metric: w.metric, hourStart: Date.parse(w.hour_start) / 1000, value: Number(w.value), fetchedAt: Date.parse(w.fetched_at) / 1000 }));
      } else if (event.kind === "rain_at") {
        const hour = new Date(Math.floor(event.targetAt / 3600) * 3600 * 1000).toISOString();
        const { data } = await sb.from("weather_observations").select("feed_id,hour_start,precipitation_mm,fetched_at").eq("feed_id", event.feedId).eq("hour_start", hour);
        weather = (data ?? []).map((w) => ({ feedId: w.feed_id, hourStart: Date.parse(w.hour_start) / 1000, precipitationMm: Number(w.precipitation_mm), fetchedAt: Date.parse(w.fetched_at) / 1000 }));
      } else {
        const { data } = await sb.from("delay_observations").select("feed_id,trip_id,stop_id,stop_sequence,route_id,observed_at,delay_sec,predicted_at")
          .eq("feed_id", event.feedId).eq("trip_id", event.tripId);
        delays = (data ?? []).map((d) => ({
          feedId: d.feed_id, tripId: d.trip_id, stopId: d.stop_id, stopSequence: d.stop_sequence ?? undefined, routeId: d.route_id,
          observedAt: Date.parse(d.observed_at) / 1000, delaySec: d.delay_sec,
          predictedAt: d.predicted_at ? Date.parse(d.predicted_at) / 1000 : undefined,
        }));
      }

      const res = resolveEvent({
        event, now, feed: { feedId: event.feedId, lastOkAt: lastOk.get(event.kind === "match_bet" ? "sportsdb" : event.kind === "tick_gt" ? "ticks" : event.kind === "metric_gt" ? "open-meteo-metrics" : event.feedId.startsWith("om-") ? "open-meteo-places" : event.feedId) ?? null },
        staleAfterSec: feedStale.get(event.feedId) ?? (event.feedId === "usgs" || event.feedId === "mit-scioperi" || event.kind === "tick_gt" || event.kind === "match_bet" ? 7200 : event.feedId.startsWith("om-") ? 10800 : 300), delays, weather, metrics, quake, strike, traffic, ticks, match, occupancy,
      });
      if (res.status === "pending") { out.pending++; pendingUntil.set(row.id, Date.now() + 4 * 60_000); if (pendingUntil.size > 5000) pendingUntil.clear(); continue; }
      // Delay bets with the "how full" bonus: the bus's own report closest to the moment of the question goes into the evidence (no report = no bonus).
      if (res.status === "resolved" && (event.kind === "bus_delay_gt") && (row.params as { occBonus?: boolean }).occBonus) {
        const lo = new Date((event.targetAt - OCC_WINDOW_SEC) * 1000).toISOString(), hi = new Date((event.targetAt + OCC_WINDOW_SEC) * 1000).toISOString();
        const { data: oo } = await sb.from("occupancy_observations").select("at,level").eq("feed_id", event.feedId).eq("trip_id", event.tripId).gte("at", lo).lte("at", hi);
        const best = (oo ?? []).map((o) => ({ level: o.level as number, d: Math.abs(Date.parse(o.at) / 1000 - event.targetAt) })).sort((a, b) => a.d - b.d)[0];
        if (best) res.evidence = { ...res.evidence, occ: best.level };
      }

      const result = res.status === "void" ? "void" : res.outcome;
      const { error: rpcErr } = await sb.rpc("settle_market", {
        p_market: row.id, p_result: result,
        p_evidence: res.status === "resolved" ? res.evidence : null,
        p_void_reason: res.status === "void" ? res.reason : null,
      });
      if (rpcErr) throw new Error(rpcErr.message);

      if (res.status === "resolved") {
        const k = historyKey(event, city.timezone);
        await sb.rpc("bump_odds_history", { p_city: row.city_id, p_kind: k.kind, p_route: k.routeId, p_hour: k.hourOfDay, p_threshold: k.threshold, p_yes: res.outcome === "yes" });
        out.settled++;
      } else out.voided++;
    } catch (e) {
      console.error("resolve failed", row.id, e);
      out.errors++; // left open and retried next minute, never settled on a guess; past its deadline it is refunded so it cannot stay open forever
      if (Date.parse(row.deadline_at as string) < Date.now()) await sb.rpc("settle_market", { p_market: row.id, p_result: "void", p_evidence: null, p_void_reason: "error" });
    }
  }
  const minute = new Date().getUTCMinutes();
  const safeCount = (p: Promise<number>) => p.catch((e) => { console.error("notify failed", e); return 0; });
  const notified = await safeCount(notifyResults(sb)) + await safeCount(notifyFlash(sb)) + await safeCount(notifyStreak(sb)) + await safeCount(notifyModeration(sb)) + await safeCount(notifyInvites(sb)) + await safeCount(notifySupers(sb)) + await safeCount(notifyFriendWins(sb)) + await safeCount(notifyFriendRequests(sb)) + await safeCount(notifyReminders(sb)) + await safeCount(notifyBroadcast(sb)) + await safeCount(notifyDirect(sb)) + await safeCount(notifyLiveDelay(sb)) + await safeCount(notifyOffers(sb)) + (minute % 2 === 0 ? await safeCount(notifyRewards(sb)) : 0) + await safeCount(notifyTips(sb)) + (minute % 5 === 1 ? await safeCount(notifyOvertaken(sb)) : 0) + (minute % 10 === 3 ? await safeCount(notifyDaily(sb)) + await safeCount(notifyVotes(sb)) : 0) + (minute % 10 === 7 ? await safeCount(notifyLoss(sb)) : 0) + (minute % 10 === 0 ? await safeCount(notifyRecap(sb)) + await safeCount(notifyComeback(sb)) : 0);
  return Response.json({ ...out, notified, notifyError: lastNotifyError.msg });
}));

/** Earthquakes of magnitude >= minMag between two instants, from the USGS FDSN service (null if it cannot be read). */
async function usgsWindow(from: number, to: number, minMag: number, bbox?: [number, number, number, number], circle?: [number, number, number]): Promise<QuakeReading | null> {
  try {
    const q = new URLSearchParams({ format: "geojson", starttime: new Date(from * 1000).toISOString(), endtime: new Date(to * 1000).toISOString(), minmagnitude: String(minMag), orderby: "magnitude", limit: "20" });
    if (circle) { q.set("latitude", String(circle[0])); q.set("longitude", String(circle[1])); q.set("maxradiuskm", String(circle[2])); }
    if (bbox) { q.set("minlatitude", String(bbox[0])); q.set("maxlatitude", String(bbox[1])); q.set("minlongitude", String(bbox[2])); q.set("maxlongitude", String(bbox[3])); }
    const res = await fetch(`https://earthquake.usgs.gov/fdsnws/event/1/query?${q}`, { headers: { "User-Agent": `LateLotto/0.1 (play-money game; contact: ${Deno.env.get("CONTACT_EMAIL") ?? "unset"})` }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const j = await res.json() as { features?: { properties?: { mag?: number } }[] };
    if (!Array.isArray(j.features)) return null;
    const mags = j.features.map((f) => Number(f.properties?.mag)).filter((m) => Number.isFinite(m) && m >= minMag);
    return { count: mags.length, maxMag: mags.length ? Math.max(...mags) : null };
  } catch { return null; }
}

let strikeCache: { at: number; list: ReturnType<typeof parseStrikeRss> | null } | null = null;
/** The ministry's strike list, fetched at most once per run; null if unreadable or empty (an empty list is never read as "all revoked"). */
async function strikeList() {
  if (strikeCache && Date.now() - strikeCache.at < 60_000) return strikeCache.list;
  let list: ReturnType<typeof parseStrikeRss> | null = null;
  try {
    const res = await fetch("https://scioperi.mit.gov.it/mit2/public/scioperi/rss", { headers: { "User-Agent": `LateLotto/0.1 (play-money game; contact: ${Deno.env.get("CONTACT_EMAIL") ?? "unset"})` }, signal: AbortSignal.timeout(20_000) });
    if (res.ok) { const l = parseStrikeRss(await res.text()); list = l.length > 0 ? l : null; }
  } catch { list = null; }
  strikeCache = { at: Date.now(), list };
  return list;
}
