// Reports + admin gate against the real project; deletes the test user.   node scripts/e2e-reports.mjs
import { supabaseUrl } from "./lib-env.mjs";
const U = supabaseUrl(), ANON = process.env.SUPABASE_ANON_KEY;
const j = async (path, init = {}, token) => { const r = await fetch(`${U}${path}`, { ...init, headers: { apikey: ANON, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) } }); const t = await r.text(); return { status: r.status, body: t ? JSON.parse(t) : null }; };
const ok = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) process.exitCode = 1; };
const s = await j("/auth/v1/signup", { method: "POST", body: "{}" });
const tok = s.body.access_token;
const rpc = (n, b) => j(`/rest/v1/rpc/${n}`, { method: "POST", body: JSON.stringify(b ?? {}) }, tok);
await rpc("ensure_profile", { p_city: "rome", p_locale: "it", p_country: "IT" });
const m = (await j("/rest/v1/markets?select=id&status=eq.open&limit=1", {}, tok)).body[0].id;
const r1 = await rpc("report_market", { p_market: m, p_kind: "wrong_data", p_note: "e2e" }); if (r1.status >= 300) console.log(JSON.stringify(r1.body)); ok(r1.status < 300, "report accepted");
ok((await rpc("report_market", { p_market: m, p_kind: "other" })).status < 300, "duplicate report ignored, not an error");
ok((await rpc("report_market", { p_market: m, p_kind: "nope" })).status >= 400, "bad kind refused");
ok((await rpc("admin_overview")).status >= 400, "admin overview refused to a guest");
ok((await rpc("is_admin")).body === false, "guest is not admin");
ok((await j("/rest/v1/reports?select=id", {}, tok)).body?.length === 0 || (await j("/rest/v1/reports?select=id", {}, tok)).status >= 400, "reports table not readable by players");
await rpc("delete_my_account");
// the report row outlives the deleted user (user_id becomes null): clean up the test row
if (process.env.SUPABASE_SERVICE_ROLE_KEY) await fetch(`${U}/rest/v1/reports?note=eq.e2e`, { method: "DELETE", headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } });
