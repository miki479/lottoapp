// End-to-end check of the guest flow against the real project, then deletes the test user.
//   node scripts/e2e-guest.mjs
import { supabaseUrl } from "./lib-env.mjs";
const U = supabaseUrl(), ANON = process.env.SUPABASE_ANON_KEY, SRV = process.env.SUPABASE_SERVICE_ROLE_KEY;
const j = async (path, init = {}, key = ANON, token) => {
  const r = await fetch(`${U}${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${token ?? key}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const t = await r.text(); let body; try { body = JSON.parse(t); } catch { body = t; }
  return { status: r.status, body };
};
const now0 = new Date().toISOString();
const step = (name, ok, extra = "") => { console.log(`${ok ? "OK  " : "FAIL"} ${name} ${extra}`); if (!ok) process.exitCode = 1; };

const su = await j("/auth/v1/signup", { method: "POST", body: "{}" });
const token = su.body.access_token, uid = su.body.user?.id;
step("anonymous sign-in", !!token, `(status ${su.status})`);
if (!token) process.exit(1);
try {
  const p = await j("/rest/v1/rpc/ensure_profile", { method: "POST", body: JSON.stringify({ p_city: "rome", p_locale: "it", p_country: "IT" }) }, ANON, token);
  step("ensure_profile gives 1000 credits and the city's timezone", p.body.credits === 1000 && p.body.timezone === "Europe/Rome", JSON.stringify({ credits: p.body.credits, tz: p.body.timezone }));
  const p2 = await j("/rest/v1/rpc/ensure_profile", { method: "POST", body: JSON.stringify({ p_city: "tokyo", p_locale: "en-US", p_country: "JP" }) }, ANON, token);
  step("ensure_profile is idempotent", p2.body.city_id === "rome");

  // Betting needs a registered account (rule in app_settings): the guest is upgraded in place with e-mail + password.
  const blocked = await j("/rest/v1/rpc/place_bet", { method: "POST", body: JSON.stringify({ p_market: "00000000-0000-0000-0000-000000000000", p_pick: "yes", p_stake: 50 }) }, ANON, token);
  step("a guest cannot bet while registration is required", JSON.stringify(blocked.body).includes("registration_required") || blocked.status >= 400);
  const up = await j("/auth/v1/user", { method: "PUT", body: JSON.stringify({ email: `e2e-guest-${Date.now()}@example.com`, password: "e2e-password-1" }) }, ANON, token);
  step("guest upgraded in place to an e-mail account", up.status < 300 && up.body.is_anonymous === false, `(status ${up.status})`);

  const hack = await j(`/rest/v1/profiles?id=eq.${uid}`, { method: "PATCH", body: JSON.stringify({ credits: 999999 }), headers: { Prefer: "return=representation" } }, ANON, token);
  step("client cannot edit its own credits", hack.status >= 400, `(status ${hack.status})`);
  const hack2 = await j(`/rest/v1/profiles?id=eq.${uid}`, { method: "PATCH", body: JSON.stringify({ timezone: "Pacific/Kiritimati" }), headers: { Prefer: "return=representation" } }, ANON, token);
  step("client cannot change timezone", hack2.status >= 400, `(status ${hack2.status})`);

  const denied = async (label, req) => { const r = await req(); step(label, r.status >= 400 || (Array.isArray(r.body) && r.body.length === 0), `(status ${r.status})`); };
  await denied("guest cannot settle a market", () => j("/rest/v1/rpc/settle_market", { method: "POST", body: JSON.stringify({ p_market: "00000000-0000-0000-0000-000000000000", p_result: "yes" }) }, ANON, token));
  await denied("guest cannot edit odds history", () => j("/rest/v1/rpc/bump_odds_history", { method: "POST", body: JSON.stringify({ p_city: "x", p_kind: "x", p_route: "", p_hour: 1, p_threshold: 0, p_yes: true }) }, ANON, token));
  await denied("guest cannot read raw observations", () => j("/rest/v1/delay_observations?select=*&limit=1", {}, ANON, token));
  await denied("guest cannot read the timetable", () => j("/rest/v1/trip_schedule?select=*&limit=1", {}, ANON, token));
  await denied("guest cannot create markets", () => j("/rest/v1/markets", { method: "POST", body: JSON.stringify({ city_id: "x", category: "bus", kind: "bus_delay_gt", feed_id: "x", params: {}, closes_at: now0, target_at: now0, deadline_at: now0, odds_yes: 99, odds_no: 99 }) }, ANON, token));
  await denied("guest cannot insert bets directly", () => j("/rest/v1/bets", { method: "POST", body: JSON.stringify({ user_id: uid, market_id: "00000000-0000-0000-0000-000000000000", pick: "yes", stake: 10, odds: 99 }) }, ANON, token));
  await denied("anonymous visitor cannot read profiles", () => j("/rest/v1/profiles?select=*", {}, ANON));

  const now = new Date().toISOString();
  const ms = await j(`/rest/v1/markets?status=eq.open&closes_at=gt.${now}&order=target_at.asc&limit=3&select=id,kind,odds_yes,odds_no,closes_at`, {}, ANON, token);
  step("markets are readable by a guest", Array.isArray(ms.body) && ms.body.length > 0, `(${ms.body.length ?? 0} open)`);
  const m = ms.body[0];
  const bad = await j("/rest/v1/rpc/place_bet", { method: "POST", body: JSON.stringify({ p_market: m.id, p_pick: "yes", p_stake: 5000 }) }, ANON, token);
  step("stake above the limit is rejected", bad.status >= 400, JSON.stringify(bad.body.message ?? bad.body).slice(0, 60));
  const ok = await j("/rest/v1/rpc/place_bet", { method: "POST", body: JSON.stringify({ p_market: m.id, p_pick: "yes", p_stake: 50 }) }, ANON, token);
  step("bet placed, odds locked", ok.status < 300 && Number(ok.body.odds) === Number(m.odds_yes), `(odds ${ok.body.odds})`);
  const again = await j("/rest/v1/rpc/place_bet", { method: "POST", body: JSON.stringify({ p_market: m.id, p_pick: "no", p_stake: 50 }) }, ANON, token);
  step("second bet on the same market is rejected", again.status >= 400);
  const me = await j(`/rest/v1/profiles?id=eq.${uid}&select=credits`, {}, ANON, token);
  step("stake was debited", me.body[0]?.credits === 950, `(credits ${me.body[0]?.credits})`);
  const mine = await j("/rest/v1/bets?select=stake,pick,markets(kind,params)", {}, ANON, token);
  step("my bets are readable with their market", mine.body.length === 1 && !!mine.body[0].markets);
  const refill = await j("/rest/v1/rpc/claim_daily_refill", { method: "POST", body: "{}" }, ANON, token);
  step("refill does nothing above the threshold", refill.body === 950, `(${refill.body})`);
} finally {
  const del = await j(`/auth/v1/admin/users/${uid}`, { method: "DELETE" }, SRV);
  console.log(`cleanup test user: ${del.status}`);
}
