// End-to-end check of parlays, the registration rule, invite bonus and nickname pre-check against the real project.
// Creates throw-away users and test markets and removes them at the end.
import { randomUUID } from "node:crypto";
import { supabaseUrl } from "./lib-env.mjs";

const U = supabaseUrl(), ANON = process.env.SUPABASE_ANON_KEY, SRV = process.env.SUPABASE_SERVICE_ROLE_KEY;
const call = async (path, { method = "GET", body, key = ANON, token } = {}) => {
  const r = await fetch(`${U}${path}`, { method, headers: { apikey: key, Authorization: `Bearer ${token ?? key}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let json; try { json = JSON.parse(t); } catch { json = t; }
  return { status: r.status, body: json };
};
const rpc = (fn, args, token, key) => call(`/rest/v1/rpc/${fn}`, { method: "POST", body: args ?? {}, token, key });
let failed = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "OK  " : "FAIL"} ${name} ${extra}`); if (!ok) failed++; };
const cleanup = { users: [], markets: [] };
// The registration rule is flipped during the run and put back to whatever it was.
const ruleBefore = ((await call("/rest/v1/app_settings?key=eq.registration_required&select=value", { key: SRV })).body[0] ?? {}).value ?? "false";

async function registered(label) {
  const email = `e2e-${label}-${randomUUID().slice(0, 8)}@example.invalid`, password = randomUUID();
  const c = await call("/auth/v1/admin/users", { method: "POST", key: SRV, body: { email, password, email_confirm: true } });
  cleanup.users.push(c.body.id);
  const s = await call("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
  await rpc("ensure_profile", { p_city: "rome", p_locale: "it", p_country: "IT" }, s.body.access_token);
  return { token: s.body.access_token, id: c.body.id };
}
const market = async (trip, yes, no) => {
  const t0 = Date.now();
  const r = await call("/rest/v1/markets", { method: "POST", key: SRV, body: {
    city_id: "e2e-test", category: "bus", kind: "bus_delay_gt", feed_id: "e2e-test", params: { tripId: trip, stopId: "y", routeName: "E2E", thresholdSec: 180 },
    closes_at: new Date(t0 + 3600e3).toISOString(), target_at: new Date(t0 + 3700e3).toISOString(), deadline_at: new Date(t0 + 5400e3).toISOString(), odds_yes: yes, odds_no: no } });
  cleanup.markets.push(r.body[0].id); return r.body[0].id;
};
const settle = (id, result) => rpc("settle_market", { p_market: id, p_result: result, p_evidence: {} }, undefined, SRV);
const credits = async (u) => (await call(`/rest/v1/profiles?id=eq.${u.id}&select=credits`, { token: u.token })).body[0].credits;
const parlayOf = async (u) => (await call(`/rest/v1/parlays?order=placed_at.desc&limit=1&select=*,parlay_legs(status)`, { token: u.token })).body[0];

try {
  const P = await registered("p");
  const m1 = await market("t1", 2.0, 1.5), m2 = await market("t2", 3.0, 1.5), m3 = await market("t3", 2.5, 1.4), m3b = await market("t3", 4.0, 1.2);

  check("1 leg is not a parlay", (await rpc("place_parlay", { p_legs: [{ market: m1, pick: "yes" }], p_stake: 50 }, P.token)).status >= 400);
  check("two legs on the same trip are refused", (await rpc("place_parlay", { p_legs: [{ market: m3, pick: "yes" }, { market: m3b, pick: "yes" }], p_stake: 50 }, P.token)).status >= 400);
  check("a failed parlay leaves the credits alone", (await credits(P)) === 1000);
  const ok = await rpc("place_parlay", { p_legs: [{ market: m1, pick: "yes" }, { market: m2, pick: "no" }], p_stake: 100 }, P.token);
  check("parlay placed with multiplied odds (2.0 x 1.5 = 3.00)", ok.status < 300 && Number(ok.body.odds) === 3, JSON.stringify(ok.body));
  check("stake debited", (await credits(P)) === 900);
  await settle(m1, "yes");
  check("still open while a leg is open", (await parlayOf(P)).status === "open");
  await settle(m2, "no");
  const won = await parlayOf(P);
  check("all legs won: paid stake x odds (300)", won.status === "won" && won.payout === 300 && (await credits(P)) === 1200, JSON.stringify(won));

  const a = await market("t4", 2.0, 1.5), b = await market("t5", 2.0, 1.5), c = await market("t6", 2.0, 1.5);
  await rpc("place_parlay", { p_legs: [{ market: a, pick: "yes" }, { market: b, pick: "yes" }, { market: c, pick: "yes" }], p_stake: 100 }, P.token);
  await settle(a, "no");
  const lost = await parlayOf(P);
  check("one lost leg loses the parlay immediately", lost.status === "lost" && lost.payout === 0, JSON.stringify(lost));
  await settle(b, "yes"); await settle(c, "yes");
  check("later legs cannot revive a lost parlay", (await parlayOf(P)).status === "lost" && (await credits(P)) === 1100);

  const d = await market("t7", 2.0, 1.5), e = await market("t8", 3.0, 1.5);
  await rpc("place_parlay", { p_legs: [{ market: d, pick: "yes" }, { market: e, pick: "yes" }], p_stake: 100 }, P.token);
  await settle(d, "void"); await settle(e, "yes");
  const v = await parlayOf(P);
  check("a void leg counts as odds 1: stake x 3.0 = 300", v.status === "won" && v.payout === 300 && (await credits(P)) === 1300, JSON.stringify(v));

  const f = await market("t9", 2.0, 1.5), g = await market("t10", 2.0, 1.5);
  await rpc("place_parlay", { p_legs: [{ market: f, pick: "yes" }, { market: g, pick: "yes" }], p_stake: 100 }, P.token);
  await settle(f, "void"); await settle(g, "void");
  check("every leg void: stake refunded", (await parlayOf(P)).status === "void" && (await credits(P)) === 1300);
  const st = (await rpc("my_stats", {}, P.token)).body[0];
  check("my_stats counts parlays", Number(st.total) === 4 && Number(st.won) === 2 && Number(st.lost) === 1, JSON.stringify(st));

  // ---------- "Ci scusiamo per il disagio": rungs on a trip that is already late ----------
  const base = await market("late1", 2.0, 1.5);
  await call("/rest/v1/markets?id=eq." + base, { method: "PATCH", key: SRV, body: { kind: "train_delay_gt", category: "train" } });
  await call("/rest/v1/delay_observations", { method: "POST", key: SRV, body: { city_id: "e2e-test", feed_id: "e2e-test", route_id: "r", trip_id: "late1", stop_id: "y", observed_at: new Date().toISOString(), delay_sec: 600 } });
  await rpc("spawn_ladders", {}, undefined, SRV);
  const rungs = (await call(`/rest/v1/markets?select=id,params,odds_yes,odds_no&params->>ladderOf=eq.${base}&order=odds_yes.asc`, { key: SRV })).body;
  rungs.forEach((r) => cleanup.markets.push(r.id));
  check("four rungs are created for a trip already 10 min late", rungs.length === 4, `(${rungs.length})`);
  check("rung thresholds are current delay + 5/10/20/40 min", JSON.stringify(rungs.map((r) => r.params.thresholdSec / 60).sort((a, b) => a - b)) === JSON.stringify([15, 20, 30, 50]));
  await rpc("spawn_ladders", {}, undefined, SRV);
  check("rungs are created only once", (await call(`/rest/v1/markets?select=id&params->>ladderOf=eq.${base}`, { key: SRV })).body.length === 4);
  check("clients cannot spawn rungs", (await rpc("spawn_ladders", {}, P.token)).status >= 400);
  await call("/rest/v1/delay_observations?feed_id=eq.e2e-test", { method: "DELETE", key: SRV });

  // ---------- welcome gift and boost ----------
  const prof = async (u) => (await call(`/rest/v1/profiles?id=eq.${u.id}&select=freezes,boosts,credits`, { token: u.token })).body[0];
  const before = await prof(P);
  check("a player starts with 1 freeze and no boost", before.freezes === 1 && before.boosts === 0, JSON.stringify(before));
  check("a boost cannot be used without owning one", JSON.stringify((await rpc("place_bet", { p_market: await market("nb", 2.0, 1.5), p_pick: "yes", p_stake: 10, p_boost: true }, P.token)).body).includes("no_boost"));
  check("welcome gift is granted once", (await rpc("claim_welcome_gift", {}, P.token)).body === true && (await rpc("claim_welcome_gift", {}, P.token)).body === false);
  const gift = await prof(P);
  check("gift: +1 freeze and 1 boost", gift.freezes === 2 && gift.boosts === 1, JSON.stringify(gift));
  const bm = await market("b1", 2.0, 1.5), bm2 = await market("b2", 2.0, 1.5);
  const c0 = gift.credits;
  const bb = await rpc("place_bet", { p_market: bm, p_pick: "yes", p_stake: 100, p_boost: true }, P.token);
  check("boosted bet placed, boost used", bb.status < 300 && bb.body.boosted === true && (await prof(P)).boosts === 0, JSON.stringify(bb.body).slice(0, 120));
  await settle(bm, "yes");
  check("boosted win doubles the net win: 100 x 2.0 = 200, +100 boost = 300", (await credits(P)) === c0 - 100 + 300, `(credits ${await credits(P)})`);
  const gift2 = await prof(P);
  await call(`/rest/v1/profiles?id=eq.${P.id}`, { method: "PATCH", key: SRV, body: { boosts: 1 } });
  await rpc("place_bet", { p_market: bm2, p_pick: "yes", p_stake: 100, p_boost: true }, P.token);
  await settle(bm2, "void");
  check("a void boosted bet returns the boost and the stake", (await prof(P)).boosts === 1 && (await credits(P)) === gift2.credits, JSON.stringify(await prof(P)));
  check("guests cannot claim the gift", (await rpc("claim_welcome_gift", {}, (await call("/auth/v1/signup", { method: "POST", body: {} }).then((r) => { cleanup.users.push(r.body.user.id); return r.body.access_token; })))).status >= 400);

  // ---------- quests ----------
  const qs = async (u) => (await rpc("my_quests", {}, u.token)).body;
  const qid = (list, id) => list.find((q) => q.id === id);
  let ql = await qs(P);
  check("quests listed: daily and one-time", ql.length === 8 && ql.some((q) => q.kind === "daily") && ql.some((q) => q.kind === "once"));
  check("a quest that is not done cannot be claimed", (await rpc("claim_quest", { p_id: "o_push" }, P.token)).status >= 400);
  check("done quests are flagged (bet today, parlay, first win)", qid(ql, "d_bet").done && qid(ql, "o_parlay").done && qid(ql, "o_win").done && !qid(ql, "o_push").done, JSON.stringify(ql.filter((q) => q.done).map((q) => q.id)));
  const c1 = await credits(P);
  check("claim pays the reward once", (await rpc("claim_quest", { p_id: "o_parlay" }, P.token)).body === 150 && (await credits(P)) === c1 + 150 && (await rpc("claim_quest", { p_id: "o_parlay" }, P.token)).body === 0 && (await credits(P)) === c1 + 150);
  check("claimed quests are marked", qid(await qs(P), "o_parlay").claimed === true);
  await rpc("set_push_ok", {}, P.token);
  check("push quest becomes claimable after opting in", qid(await qs(P), "o_push").done === true);
  check("a daily quest claimed today stays claimed today", (await rpc("claim_quest", { p_id: "d_bet" }, P.token)).body === 25 && qid(await qs(P), "d_bet").claimed === true);
  check("unknown quest rejected", (await rpc("claim_quest", { p_id: "nope" }, P.token)).status >= 400);

  // ---------- invite a friend ----------
  const inviter = await registered("i"), friend = await registered("f");
  const ref = (await rpc("my_referral", {}, inviter.token)).body[0];
  check("referral code is 6 characters", ref?.code?.length === 6, JSON.stringify(ref));
  check("own code cannot be redeemed", (await rpc("redeem_referral", { p_code: ref.code }, inviter.token)).body === false);
  check("a friend can redeem it", (await rpc("redeem_referral", { p_code: ref.code.toLowerCase() }, friend.token)).body === true);
  check("no bonus before the friend's first bet", (await credits(inviter)) === 1000);
  const r1 = await market("r1", 2.0, 1.5), r2 = await market("r2", 2.0, 1.5);
  await rpc("place_bet", { p_market: r1, p_pick: "no", p_stake: 10 }, friend.token);
  check("inviter earns 1000 on the friend's first bet", (await credits(inviter)) === 2500, `(credits ${await credits(inviter)})`);
  await rpc("place_bet", { p_market: r2, p_pick: "no", p_stake: 10 }, friend.token);
  check("the bonus is paid once", (await credits(inviter)) === 2500);
  const again = await rpc("redeem_referral", { p_code: ref.code }, friend.token);
  check("a player cannot switch inviter", again.body === false);
  const refAfter = (await rpc("my_referral", {}, inviter.token)).body[0];
  check("referral counters", Number(refAfter.invited) === 1 && Number(refAfter.paid) === 1, JSON.stringify(refAfter));
  const anon = await call("/auth/v1/signup", { method: "POST", body: {} }); cleanup.users.push(anon.body.user.id);
  check("guests cannot redeem codes", (await rpc("redeem_referral", { p_code: ref.code }, anon.body.access_token)).status >= 400);

  // ---------- nickname pre-check ----------
  const nc = async (n) => (await rpc("nickname_check", { p_name: n })).body;
  await rpc("set_nickname", { p_name: "E2E Parlay" }, P.token);
  check("nickname_check: ok / taken / bad / not allowed", (await nc("Fresh Name")) === "ok" && (await nc("e2e parlay")) === "nickname_taken" && (await nc("<x>")) === "bad_nickname" && (await nc("Stronzo")) === "nickname_not_allowed");

  // ---------- registration rule (switchable) ----------
  const G = anon; const gtok = G.body.access_token;
  await rpc("ensure_profile", { p_city: "rome", p_locale: "it", p_country: "IT" }, gtok);
  const mg = await market("g1", 2.0, 1.5);
  await call("/rest/v1/app_settings?key=eq.registration_required", { method: "PATCH", key: SRV, body: { value: "true" } });
  const blocked = await rpc("place_bet", { p_market: mg, p_pick: "no", p_stake: 10 }, gtok);
  check("with the rule on, a guest cannot bet", blocked.status >= 400 && JSON.stringify(blocked.body).includes("registration_required"));
  check("with the rule on, a registered player can", (await rpc("place_bet", { p_market: mg, p_pick: "no", p_stake: 10 }, P.token)).status < 300);
} finally {
  await call("/rest/v1/app_settings?key=eq.registration_required", { method: "PATCH", key: SRV, body: { value: ruleBefore } });
  for (const id of cleanup.markets) await call(`/rest/v1/markets?id=eq.${id}`, { method: "DELETE", key: SRV });
  for (const id of cleanup.users) await call(`/auth/v1/admin/users/${id}`, { method: "DELETE", key: SRV });
  console.log(`cleanup: ${cleanup.users.length} users, ${cleanup.markets.length} test markets`);
}
process.exit(failed ? 1 : 0);
