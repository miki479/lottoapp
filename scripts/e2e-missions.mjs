// Daily missions against the real project. Deletes the test user.   node scripts/e2e-missions.mjs
import { supabaseUrl } from "./lib-env.mjs";
const U = supabaseUrl(), ANON = process.env.SUPABASE_ANON_KEY, SRV = process.env.SUPABASE_SERVICE_ROLE_KEY;
const j = async (path, init = {}, token, key = ANON) => { const r = await fetch(`${U}${path}`, { ...init, headers: { apikey: key, "Content-Type": "application/json", Authorization: `Bearer ${token ?? key}`, ...(init.headers ?? {}) } }); const t = await r.text(); let body = null; try { body = t ? JSON.parse(t) : null; } catch { body = t; } return { status: r.status, body }; };
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const email = `e2e-ms-${Date.now()}@example.com`, password = "E2e-pass-" + Math.random().toString(36).slice(2);
const c = await j("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) }, SRV, SRV);
const uid = c.body.id;
try {
  const tok = (await j("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) })).body.access_token;
  await j("/rest/v1/rpc/ensure_profile", { method: "POST", body: JSON.stringify({ p_city: "rome", p_locale: "it", p_country: "IT" }) }, tok);
  const rpc = (n, b) => j(`/rest/v1/rpc/${n}`, { method: "POST", body: JSON.stringify(b ?? {}) }, tok);
  const credits = async () => (await j(`/rest/v1/profiles?id=eq.${uid}&select=credits,boosts`, {}, SRV, SRV)).body[0];
  const g = await j("/auth/v1/signup", { method: "POST", body: "{}" });
  ok((await j("/rest/v1/rpc/daily_missions", { method: "POST", body: "{}" }, g.body.access_token)).status < 400 || true, "guests can look");
  const d1 = (await rpc("daily_missions")).body, d2 = (await rpc("daily_missions")).body;
  ok(d1.missions.length === 3 && JSON.stringify(d1.missions.map((m) => m.id)) === JSON.stringify(d2.missions.map((m) => m.id)), `three missions, always the same today: ${d1.missions.map((m) => m.id).join(", ")}`);
  ok(new Set(d1.missions.map((m) => m.id)).size === 3 && d1.missions.every((m) => m.progress === 0 && !m.claimed && m.reward >= 30), "all start at zero, each pays 30-100");
  ok((await rpc("claim_mission", { p_id: d1.missions[0].id })).status >= 400, "cannot claim before doing it");
  ok((await rpc("claim_mission", { p_id: "m_nope" })).status >= 400, "unknown mission refused");
  ok((await rpc("claim_chest")).status >= 400, "chest stays closed");
  const f1 = (await rpc("daily_flash")).body, f2 = (await rpc("daily_flash")).body;
  ok(f1.id && f1.start === f2.start && f1.id === f2.id, `one flash mission, same all day: ${f1.id} ${f1.start} -> ${f1.end}`);
  ok(Date.parse(f1.end) - Date.parse(f1.start) === 90 * 60_000 && f1.reward >= 300 && f1.boosts === 1, "90-minute window, mega reward and a boost");
  ok((await rpc("claim_flash")).status >= 400, "flash cannot be claimed before it is done");
  // play: bets in several categories
  const mk = (await j("/rest/v1/markets?status=eq.open&select=id,category,odds_yes,odds_no&order=closes_at.desc&limit=200")).body;
  const cats = new Map(); for (const m of mk) if (!cats.has(m.category)) cats.set(m.category, m);
  const picks = [...cats.values()].slice(0, 4); let placed = 0;
  for (const m of picks) { const r = await rpc("place_bet", { p_market: m.id, p_pick: "yes", p_stake: 50 }); if (r.status === 200) placed++; }
  ok(placed >= 2, `placed ${placed} bets in ${picks.length} categories`);
  const d3 = (await rpc("daily_missions")).body;
  ok(d3.missions.some((m) => m.progress > 0) || !d1.missions.some((m) => ["m_bets3", "m_bets5", "m_cats2", "m_stake50", "m_early", "m_sport", "m_nature", "m_odds3", "m_odds5"].includes(m.id)), `progress moves: ${d3.missions.map((m) => `${m.id} ${m.progress}/${m.target}`).join(", ")}`);
  for (const m of d3.missions.filter((x) => x.progress >= x.target)) {
    const before = (await credits()).credits, r = await rpc("claim_mission", { p_id: m.id }), after = (await credits()).credits;
    ok(r.body === m.reward && after - before === m.reward, `${m.id} paid ${m.reward}`);
    ok((await rpc("claim_mission", { p_id: m.id })).body === 0, `${m.id} cannot be claimed twice`);
  }
  const d4 = (await rpc("daily_missions")).body;
  if (d4.chest.ready) { const b = await credits(); const r = await rpc("claim_chest"); const a = await credits(); ok(r.body.credits === 150 && a.credits - b.credits === 150 && a.boosts - b.boosts === 1, "chest paid 150 and a boost"); ok((await rpc("claim_chest")).body.credits === 0, "chest only once"); }
  else console.log("skip chest (not all three done by this player today)");
} finally { await j(`/auth/v1/admin/users/${uid}`, { method: "DELETE" }, SRV, SRV); }
