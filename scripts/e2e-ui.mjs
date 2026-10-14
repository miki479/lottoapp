// Browser walk-through of the whole player journey against a deployed (or local) site:
// guest -> bet -> sign-up at the last step -> bet placed -> parlay -> profile -> delete account.
//   BASE=https://latelotto.web.app node scripts/e2e-ui.mjs
import { createRequire } from "node:module";
// playwright is not a project dependency: install it globally or set NODE_PATH to its folder.
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE ?? "https://latelotto.web.app";
const proxy = process.env.HTTPS_PROXY;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--ignore-certificate-errors", ...(proxy ? [`--proxy-server=${proxy}`, "--proxy-bypass-list=127.0.0.1"] : [])] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "it-IT", hasTouch: true })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
let failed = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "OK  " : "FAIL"} ${name} ${extra}`); if (!ok) failed++; };
const toast = () => page.locator(".toast").allTextContents();
const email = `ui-${Date.now()}@example.com`;

try {
  await page.goto(BASE); await page.waitForSelector(".event .opt", { timeout: 20000 });
  await page.waitForTimeout(2500);
  check("home shows events and a balance", (await page.locator(".event").count()) > 0 && /1\.?000/.test(await page.locator(".wallet").innerText()), await page.locator(".wallet").innerText());

  // single bet, sign-up as the last step
  await page.locator(".event .opt").first().click();
  check("bet sheet has no sign-up form until the bet button is tapped", (await page.locator(".joinform").count()) === 0);
  await page.getByRole("button", { name: /Conferma puntata/ }).click();
  check("tapping the bet button opens the sign-up step", (await page.locator(".joinform").count()) === 1);
  await page.fill("input[type=email]", email); await page.fill("input[type=password]", "password-ui-test-1");
  await page.locator(".joinform .btn.primary").click();
  // two toasts follow the sign-up (the welcome gift and the bet), one replacing the other: watch for the bet's for a while instead of reading whichever is up
  const seen = new Set();
  for (let i = 0; i < 60 && ![...seen].some((t) => /Puntata registrata/.test(t)); i++) { for (const t of await toast()) seen.add(t); await page.waitForTimeout(250); }
  check("bet placed right after signing up", [...seen].some((t) => /Puntata registrata/.test(t)), JSON.stringify([...seen]));
  await page.waitForTimeout(3000);
  check("a dot on the Profile tab points at the welcome gift", (await page.locator(".tabbar .badge.dot").count()) === 1);
  check("balance debited", /9\d\d|950/.test(await page.locator(".wallet").innerText()), await page.locator(".wallet").innerText());

  // parlay
  await page.waitForTimeout(3800);
  await page.locator(".event .opt").nth(2).click(); await page.getByText("Aggiungi alla multipla").click(); await page.waitForTimeout(600);
  await page.locator(".event .opt").nth(4).click(); await page.getByText("Aggiungi alla multipla").click(); await page.waitForTimeout(600);
  check("parlay bar shows the picks", (await page.locator(".parlaybar").count()) === 1, await page.locator(".parlaybar").innerText().catch(() => ""));
  await page.locator(".parlaybar").click();
  await page.getByRole("button", { name: /Gioca la multipla/ }).click();
  await page.waitForTimeout(2500);
  check("parlay placed", /Multipla registrata/.test((await toast()).join(" ")), JSON.stringify(await toast()));

  // my bets and profile
  await page.locator(".tabbar").getByText("Le mie puntate").click(); await page.waitForTimeout(1200);
  check("my bets lists the bet and the parlay", (await page.locator(".card.bet").count()) >= 2);
  await page.locator(".tabbar").getByText("Profilo").click(); await page.waitForTimeout(1500);
  check("profile shows the gift card and the dot is gone", (await page.locator(".giftcard").count()) === 1 && (await page.locator(".tabbar .badge.dot").count()) === 0);
  check("profile shows streak, missions and invite code", (await page.locator(".streakcard").count()) === 1 && (await page.locator(".refcode b").count()) === 1);

  // delete the account (dismiss the one-time notifications question first, it sits above the page)
  if (await page.getByRole("button", { name: "No, grazie" }).count()) await page.getByRole("button", { name: "No, grazie" }).click();
  await page.getByText("Elimina account e dati").click(); await page.getByRole("button", { name: "Elimina definitivamente" }).click();
  await page.waitForTimeout(4000);
  check("account deleted and the app falls back to a fresh guest", /1\.?000/.test(await page.locator(".wallet").innerText()), await page.locator(".wallet").innerText());
  check("no script errors", errors.length === 0, errors.slice(0, 2).join(" | "));
} catch (e) { check("journey finished", false, String(e.message).split("\n")[0]); if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT }); }
await browser.close();
process.exit(failed ? 1 : 0);
