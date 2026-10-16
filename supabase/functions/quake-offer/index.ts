// A player picks a place, a radius, a magnitude and a time window; we price it from the real USGS rate for that
// circle over the last 12 months and create the market. Resolution later asks USGS about the same circle and window.
import { db, safe } from "../_lib/common.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const RADII = [100, 300, 1000], MAGS = [4, 4.5, 5, 5.5, 6, 7], HOURS = [1, 3, 6, 12, 24];
const PER_USER_PER_DAY = 5, MAX_OPEN_CUSTOM = 300;
const HOUSE_MARGIN = 0.08, MIN_ODDS = 1.1, MAX_ODDS = 30;

Deno.serve(safe(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const sb = db();
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await sb.auth.getUser(token);
  const uid = u?.user?.id;
  if (!uid) return json({ error: "not_authenticated" }, 401);

  const b = await req.json().catch(() => null) as Record<string, unknown> | null;
  const lat = Number(b?.lat), lon = Number(b?.lon), radius = Number(b?.radiusKm), mag = Number(b?.minMag), hours = Number(b?.hours), start = Number(b?.startEpoch);
  const place = String(b?.place ?? "").replace(/[<>]/g, "").trim().slice(0, 60), tz = String(b?.tz ?? "UTC").slice(0, 40);
  const now = Math.floor(Date.now() / 1000);
  if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) || !RADII.includes(radius) || !MAGS.includes(mag) || !HOURS.includes(hours) || !place) return json({ error: "bad_request" }, 400);
  if (!(start >= now + 30 * 60 && start <= now + 7 * 86400)) return json({ error: "bad_time" }, 400);

  const rl = await sb.from("quake_custom").select("id", { count: "exact", head: true }).eq("user_id", uid).gt("created_at", new Date((now - 86400) * 1000).toISOString());
  if ((rl.count ?? 0) >= PER_USER_PER_DAY) return json({ error: "limit" }, 429);
  const open = await sb.from("markets").select("id", { count: "exact", head: true }).eq("status", "open").eq("params->>custom", "true");
  if ((open.count ?? 0) >= MAX_OPEN_CUSTOM) return json({ error: "full" }, 429);

  const key = `qc|${lat.toFixed(1)}|${lon.toFixed(1)}|${radius}|${mag}|${start}|${hours}`;
  const have = await sb.from("markets").select("*").eq("dedupe_key", key).maybeSingle();
  if (have.data) return json({ market: have.data });

  // Real rate: events of that magnitude in that circle over the last 365 days.
  const from = new Date((now - 365 * 86400) * 1000).toISOString().slice(0, 10), to = new Date(now * 1000).toISOString().slice(0, 10);
  const q = new URLSearchParams({ starttime: from, endtime: to, minmagnitude: String(mag), latitude: String(lat), longitude: String(lon), maxradiuskm: String(radius) });
  const res = await fetch(`https://earthquake.usgs.gov/fdsnws/event/1/count?${q}`, { headers: { "User-Agent": `LateLotto/0.1 (play-money game; contact: ${Deno.env.get("CONTACT_EMAIL") ?? "unset"})` }, signal: AbortSignal.timeout(20_000) });
  const count = res.ok ? Number((await res.text()).trim()) : NaN;
  if (!Number.isFinite(count)) return json({ error: "usgs_unavailable" }, 503);
  const rate = (count + 1) / 365; // one extra event so an empty year never means "impossible"
  const p = Math.min(0.97, Math.max(0.005, 1 - Math.exp((-rate * hours) / 24)));
  const price = (x: number) => Math.round(Math.min(MAX_ODDS, Math.max(MIN_ODDS, (1 - HOUSE_MARGIN) / x)) * 100) / 100;

  const iso = (e: number) => new Date(e * 1000).toISOString();
  const { data: m, error } = await sb.from("markets").insert({
    city_id: "world", category: "nature", kind: "quake_m", feed_id: "usgs",
    params: { minMag: mag, region: "custom", custom: "true", place, tz, circle: [Math.round(lat * 100) / 100, Math.round(lon * 100) / 100, radius], yearCount: count },
    closes_at: iso(start), target_at: iso(start + hours * 3600), deadline_at: iso(start + hours * 3600 + 12 * 3600),
    odds_yes: price(p), odds_no: price(1 - p), dedupe_key: key,
  }).select("*").single();
  if (error) return json({ error: error.message }, 500);
  await sb.from("quake_custom").insert({ user_id: uid, market_id: m.id });
  return json({ market: m });
}));
