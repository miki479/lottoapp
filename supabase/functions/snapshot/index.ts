// Every minute: one picture of what every player's home screen needs (the open questions, which feeds are fresh, the most played, the latest bets, the latest results),
// saved as a public file that the CDN serves. The phones read this file instead of each asking the database the same dozen questions every minute.
import { db, requireCron, safe } from "../_lib/common.ts";

const COLS = "id,city_id,category,kind,params,closes_at,target_at,odds_yes,odds_no,status,flash_multiplier,flash_until,flash_kind";

Deno.serve(safe(async (req) => {
  const denied = requireCron(req);
  if (denied) return denied;
  const sb = db(), nowIso = new Date().toISOString();
  // The database hands out at most 1000 rows per request, so the open questions are read page by page: otherwise everything closing after the first thousand
  // (tomorrow's matches, the later chess, asteroid and launch questions) would be missing from every phone.
  const readMarkets = async () => {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; from < 8000; from += 1000) {
      const { data, error } = await sb.from("markets").select(COLS).eq("status", "open").gt("closes_at", nowIso).not("city_id", "like", "p-%").order("closes_at").order("id").range(from, from + 999);
      if (error || !data) return { data: null, error: error ?? { message: "no markets" } };
      rows.push(...data);
      if (data.length < 1000) break;
    }
    return { data: rows, error: null };
  };
  const [mk, health, popular, activity, places, results] = await Promise.all([
    readMarkets(),
    sb.from("feed_health").select("feed_id,last_ok_at"),
    sb.rpc("popular_markets", { p_limit: 5 }),
    sb.rpc("activity_feed", { p_limit: 12 }),
    sb.rpc("trending_places", { p_limit: 12 }),
    sb.from("markets").select("id,city_id,kind,status,outcome,void_reason,params,evidence,target_at").neq("status", "open").order("target_at", { ascending: false }).limit(12),
  ]);
  if (mk.error || !mk.data) return Response.json({ error: mk.error?.message ?? "no markets" }, { status: 500 });
  // The local categories (buses, trains, weather, traffic) stay in the main file: live delays, the train board and the "for you" strip read them everywhere.
  // The other categories get a file each, so a phone on a slow or metered line can ask only for the one it is looking at.
  const SHARDS = ["sport", "culture", "nature", "space", "games", "finance", "law", "strike"];
  const shard = (c: string) => mk.data!.filter((m) => m.category === c);
  const shards: Record<string, number> = {};
  const t = Date.now();
  const up0 = await Promise.all(SHARDS.map((c) => { const rows = shard(c); shards[c] = rows.length; return sb.storage.from("snap").upload(`m-${c}.json`, new Blob([JSON.stringify({ t, markets: rows })], { type: "application/json" }), { upsert: true, contentType: "application/json", cacheControl: "30" }); }));
  if (up0.some((u) => u.error)) return Response.json({ error: up0.find((u) => u.error)!.error!.message }, { status: 500 });
  const body = JSON.stringify({ t, shards, markets: mk.data.filter((m) => !SHARDS.includes(m.category as string)), health: health.data ?? [], popular: popular.data ?? [], activity: activity.data ?? [], places: places.data ?? [], results: results.data ?? [] });
  const up = await sb.storage.from("snap").upload("home.json", new Blob([body], { type: "application/json" }), { upsert: true, contentType: "application/json", cacheControl: "30" });
  if (up.error) return Response.json({ error: up.error.message }, { status: 500 });
  return Response.json({ ok: true, markets: mk.data.length, bytes: body.length, shards });
}));
