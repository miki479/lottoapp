// Friends against the real project: invite code -> automatic friendship -> ranking -> challenge invites -> removal. Deletes the test users.
//   node scripts/e2e-friends.mjs
import { supabaseUrl } from "./lib-env.mjs";
const U = supabaseUrl(), ANON = process.env.SUPABASE_ANON_KEY, SRV = process.env.SUPABASE_SERVICE_ROLE_KEY;
const j = async (path, init = {}, token, key = ANON) => { const r = await fetch(`${U}${path}`, { ...init, headers: { apikey: key, "Content-Type": "application/json", Authorization: `Bearer ${token ?? key}`, ...(init.headers ?? {}) } }); const t = await r.text(); let body = null; try { body = t ? JSON.parse(t) : null; } catch { body = t; } return { status: r.status, body }; };
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const made = [];
async function user(tag) {
  const email = `e2e-fr-${tag}-${Date.now()}@example.com`, password = "E2e-pass-" + Math.random().toString(36).slice(2);
  const c = await j("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) }, SRV, SRV);
  const l = await j("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
  const tok = l.body.access_token;
  await j("/rest/v1/rpc/ensure_profile", { method: "POST", body: JSON.stringify({ p_city: "rome", p_locale: "it", p_country: "IT" }) }, tok);
  await j(`/rest/v1/profiles?id=eq.${c.body.id}`, { method: "PATCH", body: JSON.stringify({ display_name: `Test${tag}${String(Date.now()).slice(-4)}` }) }, SRV, SRV);
  made.push(c.body.id);
  return { id: c.body.id, tok };
}
const rpc = (u, n, b) => j(`/rest/v1/rpc/${n}`, { method: "POST", body: JSON.stringify(b ?? {}) }, u?.tok);
try {
  const A = await user("a"), B = await user("b"), C = await user("c");
  const g = await j("/auth/v1/signup", { method: "POST", body: "{}" }); const G = { tok: g.body.access_token };
  const ref = (await rpc(A, "my_referral")).body?.[0]; ok(!!ref?.code, `inviter has a code (${ref?.code})`);
  ok((await rpc(G, "redeem_referral", { p_code: ref.code })).status >= 400, "a guest cannot accept an invite (needs an account)");
  ok((await rpc(A, "redeem_referral", { p_code: ref.code })).body === false, "nobody befriends themselves");
  ok((await rpc(B, "redeem_referral", { p_code: "ZZZZZZ" })).body === false, "unknown code does nothing");
  ok((await rpc(B, "redeem_referral", { p_code: ref.code })).body === true, "B accepts A's invite");
  ok((await rpc(B, "redeem_referral", { p_code: ref.code })).body === false, "the invite is accepted only once");
  ok((await rpc(C, "redeem_referral", { p_code: ref.code })).body === true, "C accepts the invite too");
  const fa = (await rpc(A, "friends_board")).body, fb = (await rpc(B, "friends_board")).body;
  ok(fa.length === 3 && fa.some((r) => r.user_id === B.id) && fa.some((r) => r.user_id === C.id) && fa.filter((r) => r.is_me).length === 1, "A sees A, B, C (friends with no bets are listed)");
  ok(fb.length === 2 && fb.some((r) => r.user_id === A.id) && !fb.some((r) => r.user_id === C.id), "B sees only B and A: friends are not friends of friends");
  ok(fa.every((r) => typeof r.rank === "number" || /^\d+$/.test(String(r.rank))), "everybody has a rank");
  ok((await j("/rest/v1/friendships?select=*", {}, A.tok)).status >= 400 || (await j("/rest/v1/friendships?select=*", {}, A.tok)).body?.length === 0, "the table is not readable directly");
  ok((await rpc(null, "friends_board")).status >= 400 || (await rpc(G, "friends_board")).body?.length === 0, "anonymous callers get nothing");

  // challenge invites
  const closes = new Date(Date.now() + 20 * 60_000).toISOString();
  const ch = await rpc(A, "create_challenge", { p_title: "Marco arriva in ritardo alla cena?", p_category: "dinner", p_stake: 0, p_closes_at: closes });
  const code = ch.body?.code; ok(!!code, "A creates a challenge");
  ok((await rpc(G, "invite_friends", { p_code: code, p_friends: [B.id] })).status >= 400, "guest cannot invite");
  ok((await rpc(C, "invite_friends", { p_code: code, p_friends: [B.id] })).body === undefined || (await rpc(C, "invite_friends", { p_code: code, p_friends: [B.id] })).status >= 400, "someone outside the challenge cannot invite");
  const D = await user("d"); // a stranger (not A's friend)
  ok((await rpc(A, "invite_friends", { p_code: code, p_friends: [B.id, D.id, A.id] })).body === 1, "only real friends are invited (stranger and self skipped)");
  ok((await rpc(A, "invite_friends", { p_code: code, p_friends: [B.id] })).body === 0, "the same friend is not invited twice");
  const inv = (await rpc(B, "my_invites")).body; ok(inv.length === 1 && inv[0].code === code && typeof inv[0].invited_by === "string" && inv[0].invited_by.length > 0, "B sees the invite, with who sent it");
  ok((await rpc(D, "my_invites")).body.length === 0, "the stranger sees nothing");
  ok((await rpc(A, "challenge_friend_state", { p_code: code })).body?.includes(B.id), "invited friends are marked in the picker");
  ok((await rpc(B, "pick_challenge", { p_code: code, p_pick: "yes" })).status === 200, "B joins from the invite");
  ok((await rpc(B, "my_invites")).body.length === 0, "a joined challenge leaves the invite list");
  const E = await user("e"); const refB = (await rpc(B, "my_referral")).body?.[0]; await rpc(E, "redeem_referral", { p_code: refB.code });
  ok((await rpc(B, "invite_friends", { p_code: code, p_friends: [A.id, C.id, E.id] })).body === 1, "a participant invites their OWN friends (the creator and A's other friends are skipped)");
  ok((await rpc(E, "my_invites")).body[0]?.code === code, "E sees B's invite");
  ok((await rpc(A, "invite_friends", { p_code: code, p_friends: Array.from({ length: 21 }, () => C.id) })).status >= 400, "more than 20 at once refused");
  await j(`/rest/v1/friend_challenges?code=eq.${code}`, { method: "PATCH", body: JSON.stringify({ closes_at: new Date(Date.now() - 60_000).toISOString() }) }, SRV, SRV);
  ok((await rpc(A, "invite_friends", { p_code: code, p_friends: [C.id] })).status >= 400, "no invites once it is closed");
  ok((await rpc(C, "my_invites")).body.length === 0, "closed challenges leave the invite list");

  // removal, either side
  const ch2 = await rpc(A, "create_challenge", { p_title: "Piove al compleanno di Giulia?", p_category: "party", p_stake: 0, p_closes_at: closes });
  await rpc(A, "invite_friends", { p_code: ch2.body.code, p_friends: [C.id] });
  ok((await rpc(C, "my_invites")).body.length === 1, "C has a new invite");
  await rpc(C, "remove_friend", { p_friend: A.id });
  ok(!(await rpc(A, "friends_board")).body.some((r) => r.user_id === C.id) && !(await rpc(C, "friends_board")).body.some((r) => r.user_id === A.id), "removing a friend works from either side, both ways");
  ok((await rpc(C, "my_invites")).body.length === 0, "and their pending invites go away");
  ok((await rpc(A, "invite_friends", { p_code: ch2.body.code, p_friends: [C.id] })).body === 0, "a removed friend cannot be invited");
  ok((await rpc(A, "friends_board")).body.some((r) => r.user_id === B.id), "other friends are untouched");
} finally {
  for (const id of made) await j(`/auth/v1/admin/users/${id}`, { method: "DELETE" }, SRV, SRV);
}
