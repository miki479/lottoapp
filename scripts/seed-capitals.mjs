// Seeds the Italian provincial capitals as permanent "places": the places job then makes their weather questions every day, so the near-you list has
// fresh local questions everywhere. Exact positions come from the Open-Meteo geocoder (CC BY 4.0), the provinces from the map data.
//   node scripts/seed-capitals.mjs            (prints what it would do)
//   node scripts/seed-capitals.mjs --apply    (writes the places; needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
//   node scripts/seed-capitals.mjs --dump scripts/capitals.json   (exact positions of all capitals, used by build-italy-map.py)
import { readFileSync } from "node:fs";
import { supabaseUrl } from "./lib-env.mjs";

const src = readFileSync(new URL("../web/src/lib/italyMap.ts", import.meta.url), "utf8");
const provinces = JSON.parse(src.match(/MAP_PROVINCES: MapProvince\[\] = (\[.*\]);/s)[1]);
const regions = Object.fromEntries(JSON.parse(src.match(/MAP_REGIONS: MapRegion\[\] = (\[.*?\]);\nexport const MAP_PROVINCES/s)[1]).map((r) => [r.id, r.name]));
const norm = (x) => String(x ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const CAPITAL_CODES = new Set(["PPLC", "PPLA", "PPLA2", "PPLA3"]);
// these already have a city of their own with weather questions (cities/*.json): a second set would double them
const HAVE = new Set(["Modena", "Reggio Emilia", "Piacenza", "Venezia", "Bari", "Mantova", "Vicenza", "Cuneo", "Parma", "Napoli", "Torino", "Roma"]);
const ALIAS = { "Reggio Emilia": "Reggio nell'Emilia" };
const out = [];
const dump = process.argv.includes("--dump");
for (const p of provinces.filter((x) => dump || !HAVE.has(x.name))) {
  const region = regions[p.region];
  let hits = [];
  for (let k = 0; k < 4 && !hits.length; k++) {
    try { const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ALIAS[p.name] ?? p.name)}&count=10&language=it&format=json&countryCode=IT`); hits = (await r.json()).results ?? []; } catch { await new Promise((res) => setTimeout(res, 1500)); }
  }
  const sameRegion = hits.filter((h) => norm(h.admin1) === norm(region) || (region === "Trentino-Alto Adige" && /trent|bolzano|sudtirol|alto adige/.test(norm(h.admin1))) || (region === "Sicilia" && norm(h.admin1) === "sicilia"));
  const pick = sameRegion.find((h) => CAPITAL_CODES.has(h.feature_code) && [norm(p.name), norm(ALIAS[p.name])].includes(norm(h.name))) ?? sameRegion.find((h) => [norm(p.name), norm(ALIAS[p.name])].includes(norm(h.name))) ?? sameRegion[0];
  const row = pick
    ? { name: p.name, admin: region, country: "IT", lat: +pick.latitude.toFixed(5), lon: +pick.longitude.toFixed(5), timezone: pick.timezone ?? "Europe/Rome", via: pick.feature_code }
    : { name: p.name, admin: region, country: "IT", lat: p.lat, lon: p.lon, timezone: "Europe/Rome", via: "province-point" };
  out.push(row);
  await new Promise((res) => setTimeout(res, 120));
}
const weak = out.filter((o) => o.via === "province-point" || !CAPITAL_CODES.has(o.via));
console.log(`${out.length} capitals, ${out.length - weak.length} exact capital matches, ${weak.length} weaker: ${weak.map((w) => `${w.name}(${w.via})`).join(", ")}`);
if (dump) { const { writeFileSync } = await import("node:fs"); writeFileSync(process.argv[process.argv.indexOf("--dump") + 1], JSON.stringify(Object.fromEntries(out.map((o) => [o.name, { lat: o.lat, lon: o.lon }])), null, 0)); console.log("dumped"); process.exit(0); }
if (!process.argv.includes("--apply")) { console.log(JSON.stringify(out.slice(0, 5))); process.exit(0); }
// same id as ensure_place(): the position rounded to two decimals, so a town a player adds later is the same place
const rows = out.map((o) => ({ id: `p-${o.lat.toFixed(2)}_${o.lon.toFixed(2)}`, name: o.name, admin: o.admin, country: o.country, lat: o.lat, lon: o.lon, timezone: o.timezone, last_used_at: "2036-01-01T00:00:00Z" }));
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const res = await fetch(`${supabaseUrl()}/rest/v1/places`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
console.log(res.ok ? `seeded ${rows.length} places` : `failed ${res.status} ${await res.text()}`);
process.exit(res.ok ? 0 : 1);
