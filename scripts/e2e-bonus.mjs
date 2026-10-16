// "How full will it be?" bonus on delay bets against the real project; removes everything it creates.   node scripts/e2e-bonus.mjs
import { supabaseUrl } from "./lib-env.mjs";
const U = supabaseUrl(), ANON = process.env.SUPABASE_ANON_KEY, SRV = process.env.SUPABASE_SERVICE_ROLE_KEY;
const j = async (path, init = {}, token, key = ANON) => { const r = await fetch(`${U}${path}`, { ...init, headers: { apikey: key, "Content-Type": "application/json", Authorization: `Bearer ${token ?? key}`, Prefer: "return=representation", ...(init.headers ?? {}) } }); const t = await r.text(); let b; try { b = JSON.parse(t); } catch { b = t; } return { status: r.status, body: b }; };
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const email = `e2e-bonus-${Date.now()}@example.com`, password = "E2e-pass-" + Math.random().toString(36).slice(2);
const uid = (await j("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) }, SRV, SRV)).body.id;
const mids = [];
const iso = (s) => new Date(Date.now() + s * 1000).toISOString();
const mk = async (params, tag) => { const r = await j("/rest/v1/markets", { method: "POST", body: JSON.stringify({ city_id: "romagna", category: "bus", kind: "bus_delay_gt", feed_id: "start-trip-updates", params: { tripId: `e2e-${tag}`, stopId: "x", stopSequence: 1, thresholdSec: 180, ...params }, closes_at: iso(3000), target_at: iso(3600), deadline_at: iso(5400), odds_yes: 3, odds_no: 1.3, dedupe_key: `e2e-bonus-${tag}-${Date.now()}` }) }, SRV, SRV); mids.push(r.body[0].id); return r.body[0].id; };
try {
  const tok = (await j("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) })).body.access_token;
  await j("/rest/v1/rpc/ensure_profile", { method: "POST", body: JSON.stringify({ p_city: "rome", p_locale: "it", p_country: "IT" }) }, tok);
  const rpc = (n, b, t = tok, k = ANON) => j(`/rest/v1/rpc/${n}`, { method: "POST", body: JSON.stringify(b ?? {}) }, t, k);
  const A = await mk({ occBonus: true }, "a"), P = await mk({}, "plain");
  ok((await rpc("place_bet", { p_market: P, p_pick: "yes", p_stake: 100, p_bonus: "free" })).status >= 400, "bonus refused on a bet that does not offer it");
  ok((await rpc("place_bet", { p_market: A, p_pick: "yes", p_stake: 100, p_bonus: "nope" })).status >= 400, "unknown bonus refused");
  const A2 = await mk({ occBonus: true }, "a2"), A3 = await mk({ occBonus: true }, "a3");
  const b1 = (await rpc("place_bet", { p_market: A, p_pick: "yes", p_stake: 100, p_bonus: "free" })).body;
  const b2 = (await rpc("place_bet", { p_market: A2, p_pick: "yes", p_stake: 100, p_bonus: "standing" })).body;
  const b3 = (await rpc("place_bet", { p_market: A3, p_pick: "yes", p_stake: 100 })).body;
  ok(b1.bonus === "free" && b2.bonus === "standing" && b3.bonus === null, "bonus is stored with the bet");
  for (const id of [A, A2, A3]) await rpc("settle_market", { p_market: id, p_result: "yes", p_evidence: { delaySec: 300, occ: 1 } }, SRV, SRV);
  const row = async (id) => (await j(`/rest/v1/bets?market_id=eq.${id}&select=bonus,bonus_hit,payout,status`, {}, SRV, SRV)).body[0];
  const base = Math.floor(100 * 3), plus = Math.floor((base - 100) * 0.15);
  const r1 = await row(A), r2 = await row(A2), r3 = await row(A3);
  ok(r1.bonus_hit === true && r1.payout === base + plus, `right guess pays ${base + plus} (= ${base} + 15% of the winnings ${plus})`);
  ok(r2.bonus_hit === false && r2.payout === base, "wrong guess costs nothing: plain payout " + base);
  ok(r3.payout === base && r3.bonus_hit === null, "no bonus, no change");
  // no reading of the occupancy: no bonus, no loss
  const B = await mk({ occBonus: true }, "b");
  await rpc("place_bet", { p_market: B, p_pick: "yes", p_stake: 100, p_bonus: "free" });
  await rpc("settle_market", { p_market: B, p_result: "yes", p_evidence: { delaySec: 300 } }, SRV, SRV);
  const rb = (await j(`/rest/v1/bets?market_id=eq.${B}&select=bonus_hit,payout`, {}, SRV, SRV)).body[0];
  ok(rb.bonus_hit === null && rb.payout === base, "no occupancy reading: plain payout, bonus unknown");
  // a lost bet loses only the stake
  const C = await mk({ occBonus: true }, "c");
  await rpc("place_bet", { p_market: C, p_pick: "yes", p_stake: 100, p_bonus: "free" });
  await rpc("settle_market", { p_market: C, p_result: "no", p_evidence: { delaySec: 0, occ: 0 } }, SRV, SRV);
  const rc = (await j(`/rest/v1/bets?market_id=eq.${C}&select=status,payout`, {}, SRV, SRV)).body[0];
  ok(rc.status === "lost" && rc.payout === 0, "lost bet: only the stake is gone, the bonus changes nothing");
} finally {
  for (const id of mids) { await j(`/rest/v1/bets?market_id=eq.${id}`, { method: "DELETE" }, SRV, SRV); await j(`/rest/v1/markets?id=eq.${id}`, { method: "DELETE" }, SRV, SRV); }
  await j(`/auth/v1/admin/users/${uid}`, { method: "DELETE" }, SRV, SRV);
}
