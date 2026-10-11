// End-to-end check of "rain markets for any place": registration of a town, markets, limits, validation, weather ingest.
import { randomUUID } from "node:crypto";
import { supabaseUrl } from "./lib-env.mjs";
const U = supabaseUrl(), ANON = process.env.SUPABASE_ANON_KEY, SRV = process.env.SUPABASE_SERVICE_ROLE_KEY;
const call = async (path, { method = "GET", body, key = ANON, token } = {}) => {
  const r = await fetch(`${U}${path}`, { method, headers: { apikey: key, Authorization: `Bearer ${token ?? key}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let json; try { json = JSON.parse(t); } catch { json = t; } return { status: r.status, body: json };
};
let failed = 0; const check = (n, ok, e = "") => { console.log(`${ok ? "OK  " : "FAIL"} ${n} ${e}`); if (!ok) failed++; };
const ids = [];
let uid;
try {
  const su = await call("/auth/v1/signup", { method: "POST", body: {} }); uid = su.body.user.id; const tok = su.body.access_token;
  await call("/rest/v1/rpc/ensure_profile", { method: "POST", token: tok, body: { p_city: "rome", p_locale: "it", p_country: "IT" } });
  const place = (n, lat, lon, tz = "Europe/Rome", cc = "IT") => call("/rest/v1/rpc/ensure_place", { method: "POST", token: tok, body: { p_name: n, p_admin: "Test", p_country: cc, p_lat: lat, p_lon: lon, p_tz: tz } });
  const a = await place("E2E Forlì", 44.2227, 12.0407); ids.push(a.body);
  check("a town is registered with a stable id", a.status < 300 && a.body === "p-44.22_12.04", JSON.stringify(a.body));
  const mk = (await call(`/rest/v1/markets?city_id=eq.${a.body}&select=id,kind,feed_id,odds_yes,closes_at`, { token: tok })).body;
  const rain = Array.isArray(mk) ? mk.filter((m) => m.kind === "rain_at") : [];
  check("rain questions are opened for it", rain.length >= 2 && rain.every((m) => m.feed_id === `om-${a.body}`) && mk.every((m) => m.feed_id === `om-${a.body}`), `(${rain.length} rain of ${mk.length})`);
  const b = await place("E2E Forlì again", 44.2231, 12.0399);
  check("the same spot is the same place (no duplicates)", b.body === a.body && (await call(`/rest/v1/markets?city_id=eq.${a.body}&select=id`, { token: tok })).body.length === mk.length);
  check("bad input is refused", (await place("<b>x</b>", 44, 12)).status >= 400 && (await place("X", 99, 12)).status >= 400 && (await place("X", 44, 12, "Mars/Base")).status >= 400 && (await place("X", 44, 12, "Europe/Rome", "ITA")).status >= 400);
  let limited = false; for (let i = 0; i < 6; i++) { const r = await place(`E2E ${i}`, 10 + i, 20 + i, "UTC", "GB"); if (r.status < 300) ids.push(r.body); else if (JSON.stringify(r.body).includes("places_limit")) limited = true; }
  check("at most 5 new places per player per day", limited);
  check("places are readable by anyone", (await call(`/rest/v1/places?id=eq.${a.body}&select=name,country`)).body.length === 1);
  check("clients cannot write places directly", (await call("/rest/v1/places", { method: "POST", token: tok, body: { id: "p-x", name: "x", country: "IT", lat: 1, lon: 1, timezone: "UTC" } })).status >= 400);
  // the hourly weather job picks the new place up (force it to be due)
  await call("/rest/v1/feed_health?feed_id=eq.open-meteo-places", { method: "DELETE", key: SRV });
  const cron = process.env.CRON_SECRET;
  if (cron) {
    const r = await fetch(`${U}/functions/v1/ingest`, { method: "POST", headers: { "x-cron-secret": cron, Authorization: `Bearer ${ANON}` } }); const j = await r.json().catch(() => ({}));
    check("weather ingest reports the places feed", /^ok/.test(j["open-meteo-places"] ?? ""), JSON.stringify(j["open-meteo-places"]));
    const w = (await call(`/rest/v1/weather_observations?feed_id=eq.om-${a.body}&select=hour_start&limit=3`, { key: SRV })).body;
    check("hourly precipitation stored under the place's feed id", Array.isArray(w) && w.length > 0);
  } else console.log("skip ingest check (no CRON_SECRET in env)");
} finally {
  for (const id of ids) { await call(`/rest/v1/markets?city_id=eq.${id}`, { method: "DELETE", key: SRV }); await call(`/rest/v1/weather_observations?city_id=eq.${id}`, { method: "DELETE", key: SRV }); await call(`/rest/v1/places?id=eq.${id}`, { method: "DELETE", key: SRV }); }
  if (uid) await call(`/auth/v1/admin/users/${uid}`, { method: "DELETE", key: SRV });
}
process.exit(failed ? 1 : 0);
