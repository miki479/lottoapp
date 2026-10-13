// Gives a name to the stops of the timetable rows written before trip_schedule.stop_name existed (migration 0108), so the "Show stops"
// board can show them. New rows get their names from scripts/generate-markets.mjs; this only fills the ones that are still empty.
// Idempotent: a row that has a name is never touched, and a feed with nothing to fill is not even downloaded.
//
//   node scripts/backfill-stop-names.mjs [--feed toei-bus-vehicle] [--gtfs-dir ./gtfs/toei] [--apply]
//
// Without --apply it only reports what it would write. --apply needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { validateCity } from "../shared/cities.ts";
import { supabaseUrl } from "./lib-env.mjs";
import { readAll } from "./lib-csv.mjs";
import { downloadGtfs } from "./lib-gtfs.mjs";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]?.startsWith("--") || all[i + 1] === undefined ? true : all[i + 1]]] : acc), []));
const SB = supabaseUrl(), KEY = process.env.SUPABASE_SERVICE_ROLE_KEY, apply = args.apply === true;
if (!SB || !KEY) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function rest(path, init = {}) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
  if (!r.ok) throw new Error(`Supabase ${path.split("?")[0]}: ${r.status} ${await r.text()}`);
  return r;
}

// feeds whose timetable is kept in trip_schedule (the ones the ingest job needs it for) and that publish a static GTFS
const feeds = new Map();
for (const f of readdirSync(new URL("../cities/", import.meta.url)).filter((x) => x.endsWith(".json"))) {
  const city = validateCity(JSON.parse(readFileSync(new URL(`../cities/${f}`, import.meta.url), "utf8")));
  for (const feed of city.feeds) {
    if (feed.staticGtfsUrl && ["vehicle_positions", "trip_updates_times", "trip_updates_seq"].includes(feed.kind ?? "") && !feeds.has(feed.id)) feeds.set(feed.id, feed);
  }
}

let failed = 0;
for (const feed of feeds.values()) {
  if (args.feed && args.feed !== feed.id) continue;
  try {
    const q = `feed_id=eq.${encodeURIComponent(feed.id)}&stop_name=is.null`;
    const probe = await (await rest(`trip_schedule?${q}&select=trip_id&limit=1`)).json();
    if (probe.length === 0) continue;
    // every row still without a name, a page at a time
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const page = await (await rest(`trip_schedule?${q}&select=*&order=trip_id,stop_sequence`, { headers: { Range: `${from}-${from + 999}`, "Range-Unit": "items" } })).json();
      rows.push(...page);
      if (page.length < 1000) break;
    }
    const dir = args["gtfs-dir"] && args.feed ? args["gtfs-dir"] : await downloadGtfs(feed, ["stops.txt"]);
    const names = new Map();
    for (const s of await readAll(join(dir, "stops.txt"))) if (s.stop_id && s.stop_name) names.set(s.stop_id, s.stop_name.slice(0, 120));
    const named = rows.filter((r) => names.has(r.stop_id)).map((r) => ({ ...r, stop_name: names.get(r.stop_id) }));
    console.error(`[${feed.id}] ${rows.length} rows without a name, ${named.length} can be named`);
    if (!apply) continue;
    for (let i = 0; i < named.length; i += 500) {
      await rest("trip_schedule", { method: "POST", body: JSON.stringify(named.slice(i, i + 500)), headers: { Prefer: "resolution=merge-duplicates,return=minimal" } });
    }
  } catch (e) {
    failed++;
    console.error(`[${feed.id}] failed: ${String(e?.message ?? e).slice(0, 300)}`);
  }
}
console.error(apply ? "applied" : "dry run (nothing written)");
if (failed) process.exitCode = 1;
