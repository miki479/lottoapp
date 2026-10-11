// End-to-end check of rings, bonus, streak, trophies, season ranking and friend groups against the real project.
// Creates throw-away users and one test market, and removes them at the end.
import { randomUUID } from "node:crypto";
import { supabaseUrl } from "./lib-env.mjs";

const U = supabaseUrl(), ANON = process.env.SUPABASE_ANON_KEY, SRV = process.env.SUPABASE_SERVICE_ROLE_KEY;
const call = async (path, { method = "GET", body, key = ANON, token } = {}) => {
  const r = await fetch(`${U}${path}`, { method, headers: { apikey: key, Authorization: `Bearer ${token ?? key}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let json; try { json = JSON.parse(t); } catch { json = t; }
  return { status: r.status, body: json };
};
const rpc = (fn, args, token) => call(`/rest/v1/rpc/${fn}`, { method: "POST", body: args ?? {}, token });
let failed = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "OK  " : "FAIL"} ${name} ${extra}`); if (!ok) failed++; };
const cleanup = { users: [], market: null };

async function guest() {
  const r = await call("/auth/v1/signup", { method: "POST", body: {} });
  cleanup.users.push(r.body.user.id);
  return { token: r.body.access_token, id: r.body.user.id };
}
async function registered(label) {
  const email = `e2e-${label}-${randomUUID().slice(0, 8)}@example.invalid`, password = randomUUID();
  const c = await call("/auth/v1/admin/users", { method: "POST", key: SRV, body: { email, password, email_confirm: true } });
  cleanup.users.push(c.body.id);
  const s = await call("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
  return { token: s.body.access_token, id: c.body.id };
}

try {
  // ---------- guest: rings, bonus, streak, trophies ----------
  const A = await guest();
  await rpc("ensure_profile", { p_city: "tokyo", p_locale: "en-US", p_country: "JP" }, A.token);
  const open = async (category) => (await call(`/rest/v1/markets?status=eq.open&category=eq.${category}&closes_at=gt.${new Date().toISOString()}&order=target_at.asc&limit=3&select=id`, { token: A.token })).body;
  const [bus, train, weather] = await Promise.all([open("bus"), open("train"), open("weather")]);
  check("open markets exist for bus, train and weather", bus.length >= 2 && train.length >= 1 && weather.length >= 1, `(${bus.length}/${train.length}/${weather.length})`);
  const credits = async () => (await call(`/rest/v1/profiles?id=eq.${A.id}&select=credits,streak,freezes,last_play_date`, { token: A.token })).body[0];

  await rpc("place_bet", { p_market: bus[0].id, p_pick: "yes", p_stake: 50 }, A.token);
  let p = await credits();
  check("first bet: credits debited, streak starts at 1", p.credits === 950 && p.streak === 1, JSON.stringify(p));
  await rpc("place_bet", { p_market: train[0].id, p_pick: "no", p_stake: 50 }, A.token);
  p = await credits();
  check("two rings closed: no bonus yet", p.credits === 900, `(credits ${p.credits})`);
  await rpc("place_bet", { p_market: weather[0].id, p_pick: "yes", p_stake: 50 }, A.token);
  p = await credits();
  check("third ring closes: +100 bonus (1000-150+100)", p.credits === 950, `(credits ${p.credits})`);
  const prog = (await call(`/rest/v1/daily_progress?select=*`, { token: A.token })).body[0];
  check("daily progress recorded", prog && prog.bus === 1 && prog.train === 1 && prog.weather === 1 && prog.bonus_claimed === true, JSON.stringify(prog));
  await rpc("place_bet", { p_market: bus[1].id, p_pick: "no", p_stake: 50 }, A.token);
  p = await credits();
  check("bonus is paid once per day", p.credits === 900 && p.streak === 1, `(credits ${p.credits}, streak ${p.streak})`);
  const tr = (await call(`/rest/v1/trophies?user_id=eq.${A.id}&select=trophy_id`, { token: A.token })).body.map((t) => t.trophy_id);
  check("trophy for closing all rings", tr.includes("all_rings"), JSON.stringify(tr));

  // guests cannot cheat
  const cheat = await call(`/rest/v1/trophies`, { method: "POST", token: A.token, body: { user_id: A.id, trophy_id: "streak_30" } });
  check("guest cannot award itself trophies", cheat.status >= 400, `(status ${cheat.status})`);
  const cheat2 = await call(`/rest/v1/daily_progress?user_id=eq.${A.id}`, { method: "PATCH", token: A.token, body: { weather: 99 } });
  check("guest cannot edit its progress", cheat2.status >= 400, `(status ${cheat2.status})`);
  check("guests have no registration: group creation refused", (await rpc("create_group", { p_name: "Nope" }, A.token)).status >= 400);
  check("is_registered is false for a guest", (await rpc("is_registered", {}, A.token)).body === false);

  // ---------- registered players: season ranking, trophies, friend groups ----------
  const B = await registered("b"), C = await registered("c");
  for (const [u, name] of [[B, "E2E Bruno"], [C, "E2E Clara"]]) {
    await rpc("ensure_profile", { p_city: "rome", p_locale: "it", p_country: "IT" }, u.token);
    const r = await call(`/rest/v1/profiles?id=eq.${u.id}`, { method: "PATCH", token: u.token, body: { display_name: name } });
    check(`display name set for ${name}`, r.status < 300, `(status ${r.status})`);
  }
  check("is_registered is true once an email is confirmed", (await rpc("is_registered", {}, B.token)).body === true);

  const t0 = Date.now();
  const mk = await call("/rest/v1/markets", { method: "POST", key: SRV, body: {
    city_id: "e2e-test", category: "bus", kind: "bus_delay_gt", feed_id: "e2e-test", params: { tripId: "x", stopId: "y", routeName: "E2E", thresholdSec: 180 },
    closes_at: new Date(t0 + 3600e3).toISOString(), target_at: new Date(t0 + 3700e3).toISOString(), deadline_at: new Date(t0 + 5400e3).toISOString(), odds_yes: 6.0, odds_no: 1.1 } });
  const M = mk.body[0].id; cleanup.market = M;
  await rpc("place_bet", { p_market: M, p_pick: "yes", p_stake: 100 }, B.token);
  await rpc("place_bet", { p_market: M, p_pick: "no", p_stake: 100 }, C.token);
  const settle = await call("/rest/v1/rpc/settle_market", { method: "POST", key: SRV, body: { p_market: M, p_result: "yes", p_evidence: { delaySec: 400 } } });
  check("market settled by the server", settle.status < 300);

  const bProf = (await call(`/rest/v1/profiles?id=eq.${B.id}&select=credits`, { token: B.token })).body[0];
  check("winner paid at the locked odds (1000-100+600)", bProf.credits === 1500, `(credits ${bProf.credits})`);
  const bTr = (await call(`/rest/v1/trophies?user_id=eq.${B.id}&select=trophy_id`, { token: B.token })).body.map((t) => t.trophy_id);
  check("winner gets first_win and long_shot trophies", bTr.includes("first_win") && bTr.includes("long_shot"), JSON.stringify(bTr));

  const lb = (await rpc("leaderboard", { p_scope: "global", p_limit: 50 }, B.token)).body;
  const me = lb.find((r) => r.user_id === B.id), clara = lb.find((r) => r.user_id === C.id);
  check("season ranking: winner +500, loser -100", me?.score === 500 && clara?.score === -100, JSON.stringify([me?.score, clara?.score]));
  check("ranking marks the current player", me?.is_me === true && clara?.is_me === false);
  check("guests never appear in the ranking", !lb.some((r) => r.user_id === A.id));
  const lbCity = (await rpc("leaderboard", { p_scope: "city", p_key: "rome" }, B.token)).body;
  check("city and country scopes work", lbCity.some((r) => r.user_id === B.id) && (await rpc("leaderboard", { p_scope: "country", p_key: "IT" }, B.token)).body.some((r) => r.user_id === C.id));

  const code = (await rpc("create_group", { p_name: "Amici E2E" }, B.token)).body;
  check("friend group created with a 6-character code", typeof code === "string" && code.length === 6, `(${code})`);
  const outsider = (await rpc("leaderboard", { p_scope: "group", p_key: code }, C.token)).body;
  check("non-members see an empty group ranking", Array.isArray(outsider) && outsider.length === 0);
  check("join with the invite code", (await rpc("join_group", { p_code: code.toLowerCase() }, C.token)).status < 300);
  const g = (await rpc("leaderboard", { p_scope: "group", p_key: code }, C.token)).body;
  check("members see the group ranking", g.length === 2 && g[0].display_name === "E2E Bruno", JSON.stringify(g.map((r) => r.display_name)));
  check("unknown invite code is rejected", (await rpc("join_group", { p_code: "ZZZZZZ" }, C.token)).status >= 400);
} finally {
  if (cleanup.market) await call(`/rest/v1/markets?id=eq.${cleanup.market}`, { method: "DELETE", key: SRV });
  for (const id of cleanup.users) await call(`/auth/v1/admin/users/${id}`, { method: "DELETE", key: SRV });
  console.log(`cleanup: ${cleanup.users.length} users, ${cleanup.market ? 1 : 0} test market`);
}
process.exit(failed ? 1 : 0);
