// Friends in the browser, on a deployed (or local) site: invite link -> sign-up -> friends in the ranking -> challenge with a friend invite -> inbox -> removal.
//   BASE=https://latebet.it node scripts/e2e-friends-ui.mjs      (needs SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
import { createRequire } from "node:module";
import { projectRef, supabaseUrl } from "./lib-env.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "https://latebet.it";
const U = supabaseUrl(), ANON = process.env.SUPABASE_ANON_KEY, SRV = process.env.SUPABASE_SERVICE_ROLE_KEY;
const proxy = process.env.HTTPS_PROXY;
const j = async (path, init = {}, token, key = ANON) => { const r = await fetch(`${U}${path}`, { ...init, headers: { apikey: key, "Content-Type": "application/json", Authorization: `Bearer ${token ?? key}`, ...(init.headers ?? {}) } }); const t = await r.text(); let body = null; try { body = t ? JSON.parse(t) : null; } catch { body = t; } return { status: r.status, body }; };
let failed = 0; const check = (name, ok, extra = "") => { console.log(`${ok ? "OK  " : "FAIL"} ${name} ${extra}`); if (!ok) failed++; };
const made = [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--ignore-certificate-errors", ...(proxy ? [`--proxy-server=${proxy}`, "--proxy-bypass-list=127.0.0.1;localhost"] : [])] });
const ctx = async (session) => {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "it-IT", hasTouch: true });
  if (session) await c.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* */ } }, [`sb-${projectRef()}-auth-token`, JSON.stringify(session)]);
  const page = await c.newPage(); page.errors = []; page.on("pageerror", (e) => page.errors.push(e.message)); return page;
};
async function login(tag) {
  const email = `ui-fr-${tag}-${Date.now()}@example.com`, password = "E2e-pass-" + Math.random().toString(36).slice(2);
  const c = await j("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) }, SRV, SRV);
  const l = await j("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
  await j("/rest/v1/rpc/ensure_profile", { method: "POST", body: JSON.stringify({ p_city: "rome", p_locale: "it", p_country: "IT" }) }, l.body.access_token);
  const name = `Amico${tag}${String(Date.now()).slice(-4)}`;
  await j(`/rest/v1/profiles?id=eq.${c.body.id}`, { method: "PATCH", body: JSON.stringify({ display_name: name }) }, SRV, SRV);
  made.push(c.body.id);
  return { id: c.body.id, name, session: l.body, tok: l.body.access_token };
}
const tab = (page, label) => page.locator(".tabbar button", { hasText: label }).click();
try {
  const A = await login("a");
  const ref = (await j("/rest/v1/rpc/my_referral", { method: "POST", body: "{}" }, A.tok)).body[0].code;

  // B: opens the invite link as a guest and signs up through the app
  const pb = await ctx(null);
  await pb.goto(`${BASE}/?ref=${ref}`, { waitUntil: "domcontentloaded" }); await pb.waitForTimeout(3500);
  await tab(pb, "Classifica"); await pb.waitForTimeout(800);
  await pb.locator(".card .btn").first().click(); await pb.waitForSelector(".sheet input[type=email]", { timeout: 8000 });
  const emailB = `ui-fr-b-${Date.now()}@example.com`;
  await pb.fill("input[type=email]", emailB); await pb.fill("input[type=password]", "password-ui-test-1");
  await pb.locator(".sheet button.btn.primary", { hasText: "Crea profilo" }).last().click();
  await pb.waitForTimeout(6000);
  const idB = (await j(`/auth/v1/admin/users?per_page=50`, {}, SRV, SRV)).body.users.find((u) => u.email === emailB)?.id; if (idB) made.push(idB);
  const friendsOfA = (await j("/rest/v1/rpc/friends_board", { method: "POST", body: "{}" }, A.tok)).body ?? [];
  check("signing up from an invite link makes the two players friends right away (no reload)", !!idB && friendsOfA.some((r) => r.user_id === idB), `${friendsOfA.length} rows`);
  await pb.context().close();

  // A: sees the friend in the ranking, starts a challenge and invites them
  const pa = await ctx(A.session);
  await pa.goto(BASE, { waitUntil: "domcontentloaded" }); await pa.waitForTimeout(3500);
  await tab(pa, "Classifica"); await pa.waitForTimeout(800);
  await pa.locator(".seg button", { hasText: "Amici" }).click(); await pa.waitForTimeout(1500);
  check("Friends tab: invite card and a ranking with the new friend", (await pa.locator(".invitecard").count()) === 1 && (await pa.locator(".list .row").count()) === 2, `${await pa.locator(".list .row").count()} rows`);
  await pa.screenshot({ path: "/tmp/claude-0/shots/fr-board.png" });
  await pa.getByRole("button", { name: /Lancia una sfida/ }).click(); await pa.waitForTimeout(600);
  await pa.fill("textarea", "Marco arriva in ritardo alla cena?"); await pa.getByRole("button", { name: /Crea e condividi/ }).click();
  await pa.waitForSelector(".friendpick", { timeout: 10000 });
  check("after creating the challenge the friend picker is there, folded", (await pa.locator(".friendpick .colhead").count()) === 1 && (await pa.locator(".frchip").count()) === 0);
  await pa.locator(".friendpick .colhead").click(); await pa.waitForTimeout(300);
  check("and opens on tap", (await pa.locator(".frchip").count()) === 1);
  await pa.locator(".frchip").first().click();
  await pa.getByRole("button", { name: /Invita 1 amico/ }).click(); await pa.waitForTimeout(1500);
  check("invite sent", /Invito inviato/.test(await pa.locator(".friendpick").innerText()), (await pa.locator(".friendpick").innerText()).slice(-60));
  await pa.screenshot({ path: "/tmp/claude-0/shots/fr-picker.png" });
  await pa.context().close();

  // B (signed in): inbox in "Le mie puntate", then joins
  const B = { tok: (await j("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email: emailB, password: "password-ui-test-1" }) })).body };
  const pb2 = await ctx(B.tok);
  await pb2.goto(BASE, { waitUntil: "domcontentloaded" }); await pb2.waitForTimeout(3500);
  check("the Bets tab shows a badge for the invite", (await pb2.locator(".tabbar .badge").count()) >= 1);
  await tab(pb2, "Le mie puntate"); await pb2.waitForTimeout(1500);
  check("inbox lists the invite with who sent it", (await pb2.locator(".inbox .invite").count()) === 1 && /ti sfida/.test(await pb2.locator(".inbox").innerText()), (await pb2.locator(".inbox").innerText()).replace(/\n/g, " | ").slice(0, 120));
  await pb2.screenshot({ path: "/tmp/claude-0/shots/fr-inbox.png" });
  await pb2.locator(".inbox .invite").click(); await pb2.waitForTimeout(1200);
  await pb2.locator(".actions2 .opt.yes").click(); await pb2.waitForTimeout(1500);
  await pb2.keyboard.press("Escape"); await pb2.waitForTimeout(500);
  check("after joining, the invite leaves the inbox", (await pb2.locator(".inbox .invite").count()) === 0 || (await pb2.locator(".inbox").count()) === 0);
  await pb2.context().close();

  // A removes the friend
  const pa2 = await ctx(A.session);
  await pa2.goto(BASE, { waitUntil: "domcontentloaded" }); await pa2.waitForTimeout(3500);
  await tab(pa2, "Classifica"); await pa2.locator(".seg button", { hasText: "Amici" }).click(); await pa2.waitForTimeout(1500);
  await pa2.locator(".frdx").first().click(); await pa2.getByRole("button", { name: /Sì, rimuovi/ }).click(); await pa2.waitForTimeout(1500);
  check("removing a friend empties the list", (await pa2.locator(".list .row").count()) === 0 && /Ancora nessun amico/.test(await pa2.locator(".screen").innerText()));
  await pa2.context().close();
} finally {
  for (const id of made) await j(`/auth/v1/admin/users/${id}`, { method: "DELETE" }, SRV, SRV);
  await browser.close();
}
console.log(failed ? `${failed} check(s) failed` : "all good"); process.exit(failed ? 1 : 0);
