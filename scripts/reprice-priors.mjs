// One-off / repeatable: re-price the OPEN delay questions that have no live reading yet with the chance of "late" learned from the settled
// ones of the same country and category (the same rule the generator now uses).   node scripts/reprice-priors.mjs [--apply]
import { readdirSync, readFileSync } from "node:fs";
import { computeOdds, DEFAULT_YES_PROBABILITY, learnedPrior } from "../shared/odds.ts";
import { supabaseUrl } from "./lib-env.mjs";

const SB = supabaseUrl(), KEY = process.env.SUPABASE_SERVICE_ROLE_KEY, apply = process.argv.includes("--apply");
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" };
const rest = async (path, init = {}) => { const r = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } }); if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`); return init.method && init.method !== "GET" ? null : r.json(); };
const cities = readdirSync(new URL("../cities/", import.meta.url)).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(new URL(`../cities/${f}`, import.meta.url), "utf8")));
const byCountry = new Map();
for (const c of cities) byCountry.set(c.country, [...(byCountry.get(c.country) ?? []), c.id]);
for (const [country, ids] of byCountry) for (const category of ["bus", "train"]) {
  const kind = category === "train" ? "train_delay_gt" : "bus_delay_gt";
  const done = await rest(`markets?category=eq.${category}&kind=eq.${kind}&status=eq.resolved&params->>ladderOf=is.null&city_id=in.(${ids.join(",")})&select=outcome&limit=1000`);
  if (done.length < 8) continue;
  const p = learnedPrior(done.filter((r) => r.outcome === "yes").length, done.length, DEFAULT_YES_PROBABILITY[kind]);
  const o = computeOdds(p);
  const open = await rest(`markets?category=eq.${category}&kind=eq.${kind}&status=eq.open&params->>ladderOf=is.null&params->>pPrior=is.null&flash_multiplier=eq.1&city_id=in.(${ids.join(",")})&closes_at=gt.${new Date().toISOString()}&select=id,odds_yes`);
  console.log(`${country} ${category}: chance ${(p * 100).toFixed(1)}% (${done.length} settled) -> yes ${o.yes} / no ${o.no} on ${open.length} open (now e.g. ${open[0]?.odds_yes ?? "-"})`);
  if (apply && open.length) await rest(`markets?category=eq.${category}&kind=eq.${kind}&status=eq.open&params->>ladderOf=is.null&params->>pPrior=is.null&flash_multiplier=eq.1&city_id=in.(${ids.join(",")})&closes_at=gt.${new Date().toISOString()}`, { method: "PATCH", body: JSON.stringify({ odds_yes: o.yes, odds_no: o.no }) });
}
