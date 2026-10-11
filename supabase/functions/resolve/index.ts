// Runs every minute after `ingest`. Settles markets whose time has come, or voids them with a refund.
import { resolveEvent } from "../_shared/shared/resolve.ts";
import { historyKey, marketToEvent, type MarketRow } from "../_shared/shared/market.ts";
import type { DelayObservation, WeatherObservation } from "../_shared/shared/types.ts";
import { db, loadCities, requireCron, safe } from "../_lib/common.ts";

Deno.serve(safe(async (req) => {
  const denied = requireCron(req);
  if (denied) return denied;
  const sb = db();
  const nowIso = new Date().toISOString();
  const now = Math.floor(Date.now() / 1000);
  const cities = new Map((await loadCities()).map((c) => [c.id, c]));
  const feedStale = new Map<string, number>();
  for (const c of cities.values()) for (const f of c.feeds) feedStale.set(f.id, f.staleAfterSeconds);

  // Only markets whose target time has passed can be settled.
  const { data: due, error } = await sb.from("markets").select("*").eq("status", "open").lte("target_at", nowIso).limit(500);
  if (error) return new Response(error.message, { status: 500 });

  const { data: health } = await sb.from("feed_health").select("feed_id,last_ok_at");
  const lastOk = new Map((health ?? []).map((h) => [h.feed_id, h.last_ok_at ? Date.parse(h.last_ok_at) / 1000 : null]));

  const out = { settled: 0, voided: 0, pending: 0, errors: 0 };
  for (const row of (due ?? []) as (MarketRow & { id: string })[]) {
    try {
      const event = marketToEvent(row);
      const city = cities.get(row.city_id);
      if (!city) throw new Error(`unknown city ${row.city_id}`);

      let delays: DelayObservation[] = [];
      let weather: WeatherObservation[] = [];
      if (event.kind === "rain_at") {
        const hour = new Date(Math.floor(event.targetAt / 3600) * 3600 * 1000).toISOString();
        const { data } = await sb.from("weather_observations").select("feed_id,hour_start,precipitation_mm").eq("feed_id", event.feedId).eq("hour_start", hour);
        weather = (data ?? []).map((w) => ({ feedId: w.feed_id, hourStart: Date.parse(w.hour_start) / 1000, precipitationMm: Number(w.precipitation_mm) }));
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
        event, now, feed: { feedId: event.feedId, lastOkAt: lastOk.get(event.feedId) ?? null },
        staleAfterSec: feedStale.get(event.feedId) ?? 300, delays, weather,
      });
      if (res.status === "pending") { out.pending++; continue; }

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
      out.errors++; // left open: it will be retried next minute, never settled on a guess
    }
  }
  return Response.json(out);
}));
