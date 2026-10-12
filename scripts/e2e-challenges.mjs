// Friend challenges against the real project; deletes the test users.   node scripts/e2e-challenges.mjs
import { supabaseUrl } from "./lib-env.mjs";
const U = supabaseUrl(), ANON = process.env.SUPABASE_ANON_KEY, SRV = process.env.SUPABASE_SERVICE_ROLE_KEY;
const j = async (path, init = {}, token, key = ANON) => { const r = await fetch(`${U}${path}`, { ...init, headers: { apikey: key, "Content-Type": "application/json", Authorization: `Bearer ${token ?? key}`, ...(init.headers ?? {}) } }); const t = await r.text(); let body = null; try { body = t ? JSON.parse(t) : null; } catch { body = t; } return { status: r.status, body }; };
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
async function user(tag) {
  const email = `e2e-ch-${tag}-${Date.now()}@example.com`, password = "E2e-pass-" + Math.random().toString(36).slice(2);
  const c = await j("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) }, SRV, SRV);
  const l = await j("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
  const tok = l.body.access_token;
  await j("/rest/v1/rpc/ensure_profile", { method: "POST", body: JSON.stringify({ p_city: "rome", p_locale: "it", p_country: "IT" }) }, tok);
  return { id: c.body.id, tok };
}
const rpc = (u, n, b) => j(`/rest/v1/rpc/${n}`, { method: "POST", body: JSON.stringify(b ?? {}) }, u?.tok);
const credits = async (u) => (await j(`/rest/v1/profiles?id=eq.${u.id}&select=credits`, {}, SRV, SRV)).body[0].credits;
const A = await user("a"), B = await user("b"), C = await user("c");
const closes = new Date(Date.now() + 15 * 60_000).toISOString();
const g = await j("/auth/v1/signup", { method: "POST", body: "{}" });
ok((await rpc({ tok: g.body.access_token }, "create_challenge", { p_title: "Marco arriva in ritardo alla cena?", p_category: "dinner", p_stake: 0, p_closes_at: closes })).status >= 400, "guest cannot create");
ok((await rpc(A, "create_challenge", { p_title: "Hitler vince la partita stasera", p_category: "dinner", p_stake: 0, p_closes_at: closes })).status >= 400, "serious/hateful title refused");
ok((await rpc(A, "create_challenge", { p_title: "breve", p_category: "dinner", p_stake: 0, p_closes_at: closes })).status >= 400, "too-short title refused");
ok((await rpc(A, "create_challenge", { p_title: "Marco arriva in ritardo alla cena?", p_category: "weapons", p_stake: 0, p_closes_at: closes })).status >= 400, "unknown category refused");
ok((await rpc(A, "create_challenge", { p_title: "Marco arriva in ritardo alla cena?", p_category: "dinner", p_stake: 7, p_closes_at: closes })).status >= 400, "odd stake refused");
const made = await rpc(A, "create_challenge", { p_title: "Marco arriva in ritardo alla cena?", p_category: "dinner", p_stake: 25, p_closes_at: closes });
ok(made.status === 200 && made.body.code?.length === 8, `challenge created (code ${made.body?.code})`);
const code = made.body.code;
ok((await j("/rest/v1/friend_challenges?select=id", {}, A.tok)).body?.length === 0 || (await j("/rest/v1/friend_challenges?select=id", {}, A.tok)).status >= 400, "table not readable directly");
const view = await rpc(null, "get_challenge", { p_code: code }); ok(view.body?.title?.startsWith("Marco") && view.body.pot === 0, "anyone with the link can see it");
ok((await rpc(A, "pick_challenge", { p_code: code, p_pick: "yes" })).status >= 400, "the judge cannot bet on their own challenge");
ok((await rpc(B, "pick_challenge", { p_code: code, p_pick: "yes" })).status === 200, "friend B picks yes");
ok((await rpc(C, "pick_challenge", { p_code: code, p_pick: "no" })).status === 200, "friend C picks no");
ok((await rpc(B, "pick_challenge", { p_code: code, p_pick: "no" })).status >= 400, "second pick refused");
ok((await credits(B)) === 975 && (await credits(C)) === 975 && (await credits(A)) === 1000, "stakes escrowed (975 each, the judge keeps 1000)");
const mid = await rpc(A, "get_challenge", { p_code: code }); ok(mid.body.pot === 50 && mid.body.people.length === 0, "pot visible, picks hidden before closing");
ok((await rpc(A, "resolve_challenge", { p_code: code, p_outcome: "yes" })).status >= 400, "cannot resolve before closing");
await j(`/rest/v1/friend_challenges?code=eq.${code}`, { method: "PATCH", body: JSON.stringify({ closes_at: new Date(Date.now() - 60_000).toISOString() }) }, SRV, SRV);
ok((await rpc(A, "pick_challenge", { p_code: code, p_pick: "yes" })).status >= 400, "late pick refused");
ok((await rpc(B, "resolve_challenge", { p_code: code, p_outcome: "no" })).status >= 400, "only the judge resolves");
const res = await rpc(A, "resolve_challenge", { p_code: code, p_outcome: "yes" }); ok(res.status === 200 && res.body.status === "resolved" && res.body.people.length === 2, "judge resolves");
ok((await credits(B)) === 1025 && (await credits(C)) === 975, "pot paid to the winner, no credits created (1025 + 975 = 2000)");
ok((await rpc(A, "resolve_challenge", { p_code: code, p_outcome: "no" })).body?.outcome === "yes", "cannot resolve twice");
// void refunds
const m2 = await rpc(A, "create_challenge", { p_title: "Piove al compleanno di Giulia?", p_category: "party", p_stake: 10, p_closes_at: closes });
await rpc(C, "pick_challenge", { p_code: m2.body.code, p_pick: "yes" }); await rpc(B, "pick_challenge", { p_code: m2.body.code, p_pick: "yes" });
await j(`/rest/v1/friend_challenges?code=eq.${m2.body.code}`, { method: "PATCH", body: JSON.stringify({ closes_at: new Date(Date.now() - 60_000).toISOString() }) }, SRV, SRV);
const before = [await credits(C), await credits(B)];
await rpc(A, "resolve_challenge", { p_code: m2.body.code, p_outcome: "no" });
ok((await credits(C)) === before[0] + 10 && (await credits(B)) === before[1] + 10, "nobody guessed: everybody refunded");
const mine = await rpc(B, "my_challenges"); ok(mine.status === 200 && mine.body.length === 2, "my challenges listed");
// casual private text passes; serious things never do
const casual = await rpc(A, "create_challenge", { p_title: "Michele va a pisciare 5 volte durante il lavoro?", p_category: "work", p_stake: 0, p_closes_at: closes }); ok(casual.status === 200, "casual private text is allowed");
ok((await rpc(A, "create_challenge", { p_title: "Bombardamento su Forlì domani sera?", p_category: "random", p_stake: 0, p_closes_at: closes })).status >= 400, "violence is refused even in private");
// vote mode: creator may bet; majority decides
const v = await rpc(A, "create_challenge", { p_title: "Pio fumerà una sigaretta entro stasera?", p_category: "friends", p_stake: 10, p_closes_at: closes, p_judge: "vote" }); ok(v.status === 200, "vote-mode challenge created");
for (const [u, pk] of [[A, "yes"], [B, "yes"], [C, "no"]]) await rpc(u, "pick_challenge", { p_code: v.body.code, p_pick: pk });
await j(`/rest/v1/friend_challenges?code=eq.${v.body.code}`, { method: "PATCH", body: JSON.stringify({ closes_at: new Date(Date.now() - 60_000).toISOString() }) }, SRV, SRV);
ok((await rpc(A, "resolve_challenge", { p_code: v.body.code, p_outcome: "yes" })).status >= 400, "no single judge in vote mode");
await rpc(A, "vote_challenge", { p_code: v.body.code, p_outcome: "yes" }); await rpc(B, "vote_challenge", { p_code: v.body.code, p_outcome: "yes" });
ok((await rpc(null, "get_challenge", { p_code: v.body.code })).body.status === "open", "waits for the last vote");
const fin = await rpc(C, "vote_challenge", { p_code: v.body.code, p_outcome: "no" }); ok(fin.body?.status === "resolved" && fin.body.outcome === "yes", "majority (2-1) decides: yes");
ok((await rpc(C, "vote_challenge", { p_code: v.body.code, p_outcome: "yes" })).status >= 400, "no voting after the result");
// public: needs a home town, an account older than a few hours, no stake, and is decided by vote
const pubTry = await rpc(A, "create_challenge", { p_title: "Grandinata a Forlì nel weekend?", p_category: "random", p_stake: 0, p_closes_at: closes, p_visibility: "public" }); ok(pubTry.status >= 400, "public challenge needs a home town");
for (const u of [A, B, C]) await j(`/auth/v1/admin/users/${u.id}`, { method: "DELETE" }, SRV, SRV);
