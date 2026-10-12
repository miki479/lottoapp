// PRIVATE TEST ONLY: runs on your own PC (a normal home IP; ViaggiaTreno blocks datacenters).
// ViaggiaTreno has no licence: markets built from it are flagged testOnly and hidden from everyone except
// whoever opened the app once with ?test=1. Replace with the official feed as soon as Trenitalia/RFI answer.
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
const FEED = "it-train-viaggiatreno", CITY = "rome";
const BASE = "https://www.viaggiatreno.it/infomobilitamobile/resteasy/viaggiatreno";
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

function generate() {
  console.log(new Date().toISOString(), "generating markets…");
  const r = spawnSync(process.execPath, ["scripts/generate-markets.mjs", "--city", CITY, "--feed", FEED, "--max", "30", "--apply"], { stdio: ["ignore", "ignore", "inherit"] });
  if (r.status !== 0) console.error("generate failed");
}

async function poll() {
  const q = await fetch(`${SB}/rest/v1/markets?select=params&status=eq.open&feed_id=eq.${FEED}&limit=60`, { headers: H });
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
      for (const o of viaggiatrenoAdapter(JSON.parse(text), { feedId: FEED, fetchedAt: Math.floor(Date.now() / 1000), tripId })) {
        if (!stops.has(o.stopId)) continue;
        rows.push({ city_id: CITY, feed_id: FEED, route_id: o.routeId, trip_id: o.tripId, stop_id: o.stopId, stop_sequence: o.stopSequence ?? null, observed_at: new Date(o.observedAt * 1000).toISOString(), delay_sec: Math.round(o.delaySec), predicted_at: null });
      }
    } catch (e) { console.error(tripId, e.message); }
    await new Promise((r) => setTimeout(r, 400));
  }
  if (rows.length) {
    const r = await fetch(`${SB}/rest/v1/delay_observations?on_conflict=feed_id,trip_id,stop_id,observed_at`, { method: "POST", headers: { ...H, Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(rows) });
    if (!r.ok) console.error("save failed", r.status, await r.text());
  }
  await fetch(`${SB}/rest/v1/feed_health?on_conflict=feed_id`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ feed_id: FEED, last_attempt_at: new Date().toISOString(), ...(rows.length || trips.size === 0 ? { last_ok_at: new Date().toISOString(), last_error: null } : {}) }) });
  console.log(new Date().toISOString(), `${trips.size} trains, ${rows.length} observations`);
}

generate();
setInterval(generate, 3 * 3600_000);
for (;;) { await poll().catch((e) => console.error(e.message)); await new Promise((r) => setTimeout(r, 120_000)); }
