// Live check of ViaggiaTreno through the real adapter. Run from a machine whose IP is not blocked:
//   node scripts/smoke-viaggiatreno.mjs [stationName] [BASE_URL]
// BASE_URL defaults to the official host; set it to your relay to test the relay.
import { viaggiatrenoAdapter } from "../shared/adapters/viaggiatreno.ts";

const station = process.argv[2] ?? "MILANO CENTRALE";
const base = (process.argv[3] ?? (process.env.VIAGGIATRENO_BASE_URL || undefined) ?? "https://www.viaggiatreno.it/infomobilitamobile/resteasy/viaggiatreno").replace(/\/$/, "");
const headers = { "User-Agent": "LateLotto-smoke/0.1", ...(process.env.RELAY_SECRET ? { "x-relay-secret": process.env.RELAY_SECRET } : {}) };

async function get(path, json = true) {
  const res = await fetch(`${base}/${path}`, { headers, signal: AbortSignal.timeout(20000) });
  const text = await res.text();
  if (!res.ok || /Access Denied/i.test(text)) throw new Error(`HTTP ${res.status} ${text.slice(0, 120).replace(/\s+/g, " ")}`);
  return json ? JSON.parse(text) : text;
}

const line = (await get(`autocompletaStazione/${encodeURIComponent(station)}`, false)).split("\n")[0];
const [name, code] = line.split("|");
console.log(`station: ${name} -> ${code}`);

const fmt = (d) => encodeURIComponent(d.toString().replace(/\(.*\)/, "").trim());
// At night the list can be empty: also try a few hours back, then 10:00 today.
const tries = [0, 3, 6].map((h) => new Date(Date.now() - h * 3600e3));
const ten = new Date(); ten.setHours(10, 0, 0, 0); tries.push(ten);
let departures = [];
for (const t of tries) { departures = await get(`partenze/${code}/${fmt(t)}`); if (departures.length) break; }
departures.sort((a, b) => Number(a.nonPartito) - Number(b.nonPartito)); // trains already running first
console.log(`departures listed: ${departures.length}`);

let shown = 0;
for (const d of departures) {
  if (shown >= 3) break;
  const serviceDayMs = d.dataPartenzaTreno ?? d.orarioPartenza;
  const codOrigine = d.codOrigine ?? code;
  const train = await get(`andamentoTreno/${codOrigine}/${d.numeroTreno}/${serviceDayMs}`).catch((e) => (console.log(`  train ${d.numeroTreno}: ${e.message}`), null));
  if (!train) continue;
  const obs = viaggiatrenoAdapter(train, { feedId: "smoke", fetchedAt: Math.floor(Date.now() / 1000), tripId: `${codOrigine}/${d.numeroTreno}/${serviceDayMs}` });
  console.log(`train ${d.numeroTreno} (${train.categoria ?? "?"}) ritardo=${train.ritardo}min, observations=${obs.length}`, obs.slice(-1)[0] ?? "");
  console.log("  fields:", Object.keys(train).slice(0, 40).join(","));
  shown++;
}
if (shown === 0) { console.error("FAIL: no train could be read"); process.exit(1); }
console.log("OK");
