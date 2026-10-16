// Every minute: one picture of what every player's home screen needs (the open questions, which feeds are fresh, the most played, the latest bets, the latest results),
// saved as a public file that the CDN serves. The phones read this file instead of each asking the database the same dozen questions every minute.
import { db, requireCron, safe } from "../_lib/common.ts";

const COLS = "id,city_id,category,kind,params,closes_at,target_at,odds_yes,odds_no,status,flash_multiplier,flash_until,flash_kind";

Deno.serve(safe(async (req) => {
  const denied = requireCron(req);
  if (denied) return denied;
  const sb = db(), nowIso = new Date().toISOString();
  const [mk, health, popular, activity, places, results] = await Promise.all([
    sb.from("markets").select(COLS).eq("status", "open").gt("closes_at", nowIso).not("city_id", "like", "p-%").order("closes_at").limit(4000),
    sb.from("feed_health").select("feed_id,last_ok_at"),
    sb.rpc("popular_markets", { p_limit: 5 }),
    sb.rpc("activity_feed", { p_limit: 12 }),
    sb.rpc("trending_places", { p_limit: 12 }),
    sb.from("markets").select("id,city_id,kind,status,outcome,void_reason,params,evidence,target_at").neq("status", "open").order("target_at", { ascending: false }).limit(12),
  ]);
  if (mk.error || !mk.data) return Response.json({ error: mk.error?.message ?? "no markets" }, { status: 500 });
  const body = JSON.stringify({ t: Date.now(), markets: mk.data, health: health.data ?? [], popular: popular.data ?? [], activity: activity.data ?? [], places: places.data ?? [], results: results.data ?? [] });
  const up = await sb.storage.from("snap").upload("home.json", new Blob([body], { type: "application/json" }), { upsert: true, contentType: "application/json", cacheControl: "30" });
  if (up.error) return Response.json({ error: up.error.message }, { status: 500 });
  return Response.json({ ok: true, markets: mk.data.length, bytes: body.length });
}));
