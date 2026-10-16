// PRIVATE TEST ONLY: runs on your own PC (a normal home IP; ViaggiaTreno blocks datacenters).
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/viaggiatreno-local.mjs
//
// Every 3 hours it creates up to 30 train markets, every 2 minutes it reads the real times of the trains with an open
// market (one request per train, honest User-Agent) and stores them. The server resolver does the rest.
import { spawnSync } from "node:child_process";
import { viaggiatrenoAdapter, parseTrainTripId } from "../shared/adapters/viaggiatreno.ts";
import { supabaseUrl } from "./lib-env.mjs";

const SB = supabaseUrl(), KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB || !KEY) { console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const FEED = "it-train-viaggiatreno", CITY = "italia";
const BASE = "https://www.viaggiatreno.it/infomobilitamobile/resteasy/viaggiatreno";
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

// Main stations of the whole country; their codes are looked up once from the service itself and remembered.
const NAMES = ["Roma Termini", "Roma Tiburtina", "Milano Centrale", "Milano Porta Garibaldi", "Torino Porta Nuova", "Torino Porta Susa", "Genova Piazza Principe", "Genova Brignole", "Venezia S.Lucia", "Venezia Mestre", "Verona Porta Nuova", "Padova", "Trieste Centrale", "Udine", "Bologna Centrale", "Firenze S.M.N.", "Pisa Centrale", "Livorno Centrale", "La Spezia Centrale", "Rimini", "Ancona", "Pescara Centrale", "Napoli Centrale", "Salerno", "Caserta", "Bari Centrale", "Foggia", "Lecce", "Taranto", "Brindisi", "Reggio Calabria Centrale", "Lamezia Terme Centrale", "Cosenza", "Catania Centrale", "Palermo Centrale", "Messina Centrale", "Siracusa", "Bolzano", "Trento", "Brescia", "Bergamo", "Parma", "Reggio Emilia", "Modena", "Piacenza", "Ferrara", "Ravenna", "Forli'", "Cesena", "Perugia", "Terni", "Civitavecchia", "Latina", "Alessandria", "Novara", "Potenza Centrale", "L'Aquila", "Sulmona", "Vicenza", "Treviso Centrale", "Como San Giovanni"];
import { existsSync, readFileSync, writeFileSync } from "node:fs";
async function stationCodes() {
  const CACHE = ".vt-stations.json";
  if (existsSync(CACHE)) { const c = JSON.parse(readFileSync(CACHE, "utf8")); if (c.length > 20) return c; }
  const out = [];
  for (const n of NAMES) {
    try {
      const r = await fetch(`${BASE}/autocompletaStazione/${encodeURIComponent(n.split(" ")[0])}`, { headers: { "User-Agent": "LateLotto-private-test/0.1 (single user, pre-release)" }, signal: AbortSignal.timeout(15000) });
      const lines = (await r.text()).split("\n").map((l) => l.split("|")).filter((x) => x.length === 2);
      const want = n.toLowerCase().replace(/[.']/g, "");
      const hit = lines.find((x) => x[0].toLowerCase().replace(/[.']/g, "") === want) ?? lines.find((x) => x[0].toLowerCase().replace(/[.']/g, "").startsWith(want)) ?? (lines.length === 1 ? lines[0] : null);
      if (hit) out.push(hit[1].trim()); else console.error("station not found:", n);
    } catch (e) { console.error("station lookup failed:", n, e.message); }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (out.length > 20) writeFileSync(CACHE, JSON.stringify(out));
  return out;
}

async function generate() {
  console.log(new Date().toISOString(), "generating markets…");
  const codes = await stationCodes();
  console.log(`${codes.length} stations`);
  const r = spawnSync(process.execPath, ["scripts/generate-markets.mjs", "--city", CITY, "--feed", FEED, "--max", "120", "--apply"], { stdio: ["ignore", "ignore", "inherit"], env: { ...process.env, VT_STATIONS: codes.join(","), VT_SLOTS: "[0,4,8]", VT_DELAY_MS: "250" } });
  if (r.status !== 0) console.error("generate failed");
}

async function poll() {
  const q = await fetch(`${SB}/rest/v1/markets?select=params&status=eq.open&feed_id=eq.${FEED}&limit=200`, { headers: H });
  const trips = new Map();
  for (const m of await q.json()) if (m.params?.tripId) (trips.get(m.params.tripId) ?? trips.set(m.params.tripId, new Set()).get(m.params.tripId)).add(m.params.stopId);
  const rows = [];
  for (const [tripId, stops] of trips) {
    const t = parseTrainTripId(tripId);
    if (!t) continue;
    try {
      const res = await fetch(`${BASE}/andamentoTreno/${t.codOrigine}/${t.numero}/${t.serviceDayMs}`, { headers: { "User-Agent": "LateLotto-private-test/0.1 (single user, pre-release)" }, signal: AbortSignal.timeout(20000) });
      const text = await res.text();
      if (!res.ok || /Access Denied/i.test(text)) { console.error(tripId, "HTTP", res.status); continue; }
      // Every stop the train has reached is a fact, and all of them are kept (a reading is stored once: same train, stop and time): the questions
      // ask about some stops, "how late is it right now" about the latest, and the "Show stops" board draws them all.
      const seen = viaggiatrenoAdapter(JSON.parse(text), { feedId: FEED, fetchedAt: Math.floor(Date.now() / 1000), tripId });
      for (const o of seen) {
        rows.push({ city_id: CITY, feed_id: FEED, route_id: o.routeId, trip_id: o.tripId, stop_id: o.stopId, stop_sequence: o.stopSequence ?? null, observed_at: new Date(o.observedAt * 1000).toISOString(), delay_sec: Math.round(o.delaySec), predicted_at: null });
      }
    } catch (e) { console.error(tripId, e.message); }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (rows.length) {
    const r = await fetch(`${SB}/rest/v1/delay_observations?on_conflict=feed_id,trip_id,stop_id,observed_at`, { method: "POST", headers: { ...H, Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(rows) });
    if (!r.ok) console.error("save failed", r.status, await r.text());
  }
  await fetch(`${SB}/rest/v1/feed_health?on_conflict=feed_id`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ feed_id: FEED, last_attempt_at: new Date().toISOString(), ...(rows.length || trips.size === 0 ? { last_ok_at: new Date().toISOString(), last_error: null } : {}) }) });
  console.log(new Date().toISOString(), `${trips.size} trains, ${rows.length} observations`);
}

await generate();
setInterval(() => generate().catch((e) => console.error(e.message)), 3 * 3600_000);
for (;;) { await poll().catch((e) => console.error(e.message)); await new Promise((r) => setTimeout(r, 120_000)); }
