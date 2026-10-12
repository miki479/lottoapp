// "Super quota" rules against the real project (service role); puts everything back afterwards.   node scripts/e2e-super.mjs
import { supabaseUrl } from "./lib-env.mjs";
const U = supabaseUrl(), SRV = process.env.SUPABASE_SERVICE_ROLE_KEY, ANON = process.env.SUPABASE_ANON_KEY;
const j = async (path, init = {}, key = SRV) => { const r = await fetch(`${U}${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) } }); const t = await r.text(); try { return { status: r.status, body: JSON.parse(t) }; } catch { return { status: r.status, body: t }; } };
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const soon = encodeURIComponent(new Date(Date.now() + 3 * 3600_000).toISOString());
const ms = (await j(`/rest/v1/markets?kind=eq.tick_gt&status=eq.open&flash_multiplier=eq.1&closes_at=gt.${soon}&select=id,odds_yes,params&limit=3`)).body;
const logBefore = (await j(`/rest/v1/super_log?select=id`)).body.map((x) => x.id);
const touched = [];
try {
  if (ms.length < 3) { console.log("skip: not enough open markets"); process.exit(0); }
  ok((await j("/rest/v1/rpc/make_super", { method: "POST", body: JSON.stringify({ p_market: ms[0].id, p_subject: "e2e-a", p_reason: "price_move", p_value: "2.5" }) }, ANON)).status >= 400, "players cannot call it");
  const todayCount = (await j(`/rest/v1/super_log?day=eq.${new Date().toISOString().slice(0, 10)}&select=id`)).body.length;
  const r1 = await j("/rest/v1/rpc/make_super", { method: "POST", body: JSON.stringify({ p_market: ms[0].id, p_subject: "e2e-a", p_reason: "price_move", p_value: "2.5" }) });
  if (todayCount >= 2) { ok(r1.body === false, "daily cap of two respected"); }
  else {
    touched.push(ms[0].id);
    ok(r1.body === true, "first super quota starts");
    const m = (await j(`/rest/v1/markets?id=eq.${ms[0].id}&select=odds_yes,base_odds_yes,flash_multiplier,flash_kind,flash_until,params`)).body[0];
    ok(m.flash_multiplier === 1.6 || Number(m.flash_multiplier) === 1.6, "multiplier 1.6");
    ok(Number(m.odds_yes) > Number(ms[0].odds_yes) && Number(m.base_odds_yes) === Number(ms[0].odds_yes), `Yes odds boosted ${ms[0].odds_yes} -> ${m.odds_yes}, base kept`);
    ok(m.flash_kind === "super" && m.params.super.reason === "price_move" && Date.parse(m.flash_until) - Date.now() <= 61 * 60_000, "kind, reason and a one-hour window");
    ok((await j("/rest/v1/rpc/make_super", { method: "POST", body: JSON.stringify({ p_market: ms[1].id, p_subject: "e2e-a", p_reason: "price_move", p_value: "3" }) })).body === false, "same subject is not boosted twice in 12 hours");
    ok((await j("/rest/v1/rpc/make_super", { method: "POST", body: JSON.stringify({ p_market: ms[0].id, p_subject: "e2e-b", p_reason: "storm", p_value: "100" }) })).body === false, "an already boosted question is not boosted again");
    const r3 = await j("/rest/v1/rpc/make_super", { method: "POST", body: JSON.stringify({ p_market: ms[2].id, p_subject: "e2e-c", p_reason: "quake", p_value: "6.8" }) });
    if (r3.body === true) touched.push(ms[2].id);
    const r4 = await j("/rest/v1/rpc/make_super", { method: "POST", body: JSON.stringify({ p_market: ms[1].id, p_subject: "e2e-d", p_reason: "storm", p_value: "110" }) });
    ok(r4.body === false, "never more than two a day");
  }
} finally {
  for (const id of touched) { const m = (await j(`/rest/v1/markets?id=eq.${id}&select=base_odds_yes`)).body[0]; await j(`/rest/v1/markets?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ odds_yes: m.base_odds_yes, base_odds_yes: null, flash_multiplier: 1, flash_kind: null, flash_until: null }) }); const full = (await j(`/rest/v1/markets?id=eq.${id}&select=params`)).body[0].params; delete full.super; await j(`/rest/v1/markets?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ params: full }) }); }
  const after = (await j(`/rest/v1/super_log?select=id`)).body.map((x) => x.id).filter((i) => !logBefore.includes(i));
  for (const i of after) await j(`/rest/v1/super_log?id=eq.${i}`, { method: "DELETE" });
}
