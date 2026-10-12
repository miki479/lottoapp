// Nearby bets, home town, area statistics, match reasons without duplicates, local leaderboard.   node scripts/e2e-nearby.mjs
import { supabaseUrl } from "./lib-env.mjs";
const U = supabaseUrl(), ANON = process.env.SUPABASE_ANON_KEY, SRV = process.env.SUPABASE_SERVICE_ROLE_KEY;
const j = async (path, init = {}, token, key = ANON) => { const r = await fetch(`${U}${path}`, { ...init, headers: { apikey: key, "Content-Type": "application/json", Authorization: `Bearer ${token ?? key}`, ...(init.headers ?? {}) } }); const t = await r.text(); let body = null; try { body = t ? JSON.parse(t) : null; } catch { body = t; } return { status: r.status, body }; };
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const email = `e2e-nb-${Date.now()}@example.com`, password = "E2e-pass-" + Math.random().toString(36).slice(2);
const cu = await j("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) }, SRV, SRV);
const tok = (await j("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) })).body.access_token;
await j("/rest/v1/rpc/ensure_profile", { method: "POST", body: JSON.stringify({ p_city: "rome", p_locale: "it", p_country: "IT" }) }, tok);
const rpc = (n, b) => j(`/rest/v1/rpc/${n}`, { method: "POST", body: JSON.stringify(b ?? {}) }, tok);
const offer = (b) => j("/functions/v1/market-offer", { method: "POST", body: JSON.stringify(b) }, tok);
const home = await rpc("set_home_place", { p_name: "Forlì", p_admin: "Emilia-Romagna", p_country: "IT", p_lat: 44.2227, p_lon: 12.0407, p_tz: "Europe/Rome" });
ok(home.status === 200 && String(home.body).startsWith("p-"), `home town set (${home.body})`);
ok((await rpc("set_home_place", { p_name: "<b>x</b>", p_admin: null, p_country: "IT", p_lat: 44, p_lon: 12, p_tz: "Europe/Rome" })).status >= 400, "bad home name refused");
const pv = await offer({ type: "metric", placeId: "rome", metric: "temp", dayOffset: 1, hour: 15, threshold: 1, preview: true });
const created = await offer({ type: "metric", placeId: "rome", metric: "temp", dayOffset: 1, hour: 15, threshold: Math.round(pv.body.forecast) });
ok(created.status === 200 && created.body.market?.lat, "local question created with coordinates");
const mid = created.body.market.id;
const nearRome = await rpc("nearby_markets", { p_lat: 41.9, p_lon: 12.5, p_km: 25, p_limit: 20 });
ok(nearRome.body.some((r) => r.market_id === mid), "visible within 25 km of Rome");
const nearForli = await rpc("nearby_markets", { p_lat: 44.2227, p_lon: 12.0407, p_km: 100, p_limit: 20 });
ok(!nearForli.body.some((r) => r.market_id === mid), "not visible from Forlì (~300 km away)");
const st = await rpc("market_area_stats", { p_market: mid }); ok(st.status === 200 && st.body.yes_pct === null && st.body.total === 0, "stats hide groups under 3 people");
// matches: pick any known upcoming match, ask for a reason: created once, then reused
const sib = (await j("/rest/v1/markets?select=params&kind=eq.match_bet&status=eq.open&order=closes_at&limit=1", {}, SRV, SRV)).body?.[0];
if (sib) {
  const ev = sib.params.eventId;
  const a = await offer({ type: "match", eventId: ev, bet: "draw", preview: true }); ok(a.status === 200 || a.status === 422, `match reason preview (${a.status})`);
  if (a.status === 200) {
    const m1 = await offer({ type: "match", eventId: ev, bet: "draw" }), m2 = await offer({ type: "match", eventId: ev, bet: "draw" });
    ok(m1.status === 200 && m2.body?.market?.id === m1.body?.market?.id, "same match reason is never created twice");
    ok(m1.body?.market?.dedupe_key === `sport|${ev}|draw`, "same key as the house markets (no parallel duplicates)");
    await j(`/rest/v1/markets?id=eq.${m1.body.market.id}`, { method: "DELETE" }, SRV, SRV);
  }
  ok((await offer({ type: "match", eventId: "999999999", bet: "draw", preview: true })).status === 404, "unknown match refused");
} else console.log("skip match checks (no open match)");
const lb = await rpc("leaderboard", { p_scope: "near", p_key: "30", p_limit: 10 }); ok(lb.status === 200, "local leaderboard answers");
await j(`/rest/v1/markets?id=eq.${mid}`, { method: "DELETE" }, SRV, SRV);
await j(`/auth/v1/admin/users/${cu.body.id}`, { method: "DELETE" }, SRV, SRV);
