// Player-made earthquake question against the real project; deletes the test user and its market.   node scripts/e2e-quake.mjs
import { supabaseUrl } from "./lib-env.mjs";
const U = supabaseUrl(), ANON = process.env.SUPABASE_ANON_KEY, SRV = process.env.SUPABASE_SERVICE_ROLE_KEY;
const j = async (path, init = {}, token) => { const r = await fetch(`${U}${path}`, { ...init, headers: { apikey: ANON, "Content-Type": "application/json", Authorization: `Bearer ${token ?? ANON}`, ...(init.headers ?? {}) } }); const t = await r.text(); return { status: r.status, body: t ? JSON.parse(t) : null }; };
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const s = await j("/auth/v1/signup", { method: "POST", body: "{}" }); const tok = s.body.access_token;
const fn = (body, t = tok) => j("/functions/v1/quake-offer", { method: "POST", body: JSON.stringify(body) }, t);
const start = Math.floor(Date.now() / 1000) + 3 * 3600;
const good = { lat: 35.68, lon: 139.77, radiusKm: 300, minMag: 5, hours: 3, startEpoch: start, place: "Tokyo", tz: "Asia/Tokyo" };
const r1 = await fn(good);
ok(r1.status === 200 && r1.body.market?.odds_yes >= 1.1, `market created, odds ${r1.body.market?.odds_yes}/${r1.body.market?.odds_no}, year count ${r1.body.market?.params?.yearCount}`);
const r2 = await fn(good); ok(r2.body.market?.id === r1.body.market?.id, "same question is not duplicated");
ok((await fn({ ...good, minMag: 3 })).status === 400, "bad magnitude refused");
ok((await fn({ ...good, startEpoch: Math.floor(Date.now() / 1000) + 60 })).status === 400, "too-soon start refused");
ok((await fn({ ...good, radiusKm: 5000 })).status === 400, "bad radius refused");
ok((await fn(good, ANON)).status === 401, "no player, no question");
if (SRV && r1.body.market?.id) await fetch(`${U}/rest/v1/markets?id=eq.${r1.body.market.id}`, { method: "DELETE", headers: { apikey: SRV, Authorization: `Bearer ${SRV}` } });
await j("/rest/v1/rpc/delete_my_account", { method: "POST", body: "{}" }, tok);
