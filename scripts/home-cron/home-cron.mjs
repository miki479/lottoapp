// Runs the Edge Functions that Supabase's cron calls every minute (ingest, ingest-heavy, resolve, live, snapshot) on this computer instead.
// Needs Node 20+ and Deno 2. Read scripts/home-cron/README.md first.
//   node scripts/home-cron/home-cron.mjs            (reads scripts/home-cron/.env)
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, "..", "..");
const env = { ...process.env };
const envFile = join(here, ".env");
if (existsSync(envFile)) for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !line.trim().startsWith("#")) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) if (!env[k]) { console.error(`Missing ${k} in scripts/home-cron/.env`); process.exit(1); }
env.CRON_SECRET ||= "home-" + Math.random().toString(36).slice(2); // only this computer talks to its own functions: any value will do

// job name (the same as the pg_cron job) -> the function, its query, how often (minutes) and the local port
const JOBS = [
  { job: "ingest", fn: "ingest", query: "", every: 1, port: 8101 },
  { job: "ingest-heavy", fn: "ingest", query: "?group=heavy", every: 6, port: 8101 },
  { job: "resolve", fn: "resolve", query: "", every: 1, port: 8102 },
  { job: "live", fn: "live", query: "", every: 2, port: 8103 },
  { job: "snapshot", fn: "snapshot", query: "", every: 2, port: 8104 },
  // aircraft over Italy: OpenSky does not answer to the cloud, so only a home computer can read it (there is no Supabase cron for this one)
  { job: "flights", fn: "flights", query: "", every: 5, port: 8105 },
];
const only = (process.argv[2] ?? "").split(",").filter(Boolean); // e.g. `ingest,live` to run just those
const jobs = JOBS.filter((j) => !only.length || only.includes(j.job));
const deno = env.DENO_BIN || "deno";
const stamp = () => new Date().toISOString().slice(11, 19);

const servers = new Map();
function startServer(fn, port) {
  if (servers.has(port)) return;
  const p = spawn(deno, ["run", "-A", "--node-modules-dir=auto", join("supabase", "functions", fn, "index.ts")], { cwd: root, env: { ...env, DENO_SERVE_ADDRESS: `tcp:127.0.0.1:${port}` }, stdio: ["ignore", "inherit", "inherit"] });
  p.on("exit", (c) => { console.error(`[${stamp()}] ${fn} server stopped (${c}), restarting in 5 s`); servers.delete(port); setTimeout(() => startServer(fn, port), 5000); });
  servers.set(port, p);
}
for (const j of jobs) startServer(j.fn, j.port);

const rest = (path, body) => fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { method: "POST", headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });

const busy = new Set();
async function run(j) {
  if (busy.has(j.job)) return; // the last run is still going: do not pile up
  busy.add(j.job);
  const t0 = Date.now();
  try {
    const r = await fetch(`http://127.0.0.1:${j.port}/${j.query}`, { method: "POST", headers: { "x-cron-secret": env.CRON_SECRET }, signal: AbortSignal.timeout(55000) });
    const ok = r.ok; const text = (await r.text()).slice(0, 160);
    if (ok) await rest("rpc/home_cron_beat", { p_job: j.job }); // only a run that worked tells Supabase to stay quiet
    console.log(`[${stamp()}] ${j.job}: ${r.status} in ${Date.now() - t0} ms${ok ? "" : " " + text}`);
  } catch (e) {
    console.error(`[${stamp()}] ${j.job}: ${e.cause?.code === "ECONNREFUSED" ? "server still starting" : String(e.message ?? e)}`);
  } finally { busy.delete(j.job); }
}

// the first minute is the time Deno needs to start and download what it needs
let n = 0;
setInterval(() => { n++; for (const j of jobs) if (n % j.every === 0) void run(j); }, 60_000);
setTimeout(() => { for (const j of jobs) void run(j); }, 20_000);
const stop = () => { for (const p of servers.values()) p.kill(); process.exit(0); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
console.log(`Home cron started: ${jobs.map((j) => j.job).join(", ")}`);
