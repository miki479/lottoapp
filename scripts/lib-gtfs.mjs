// Static GTFS helpers shared by generate-markets.mjs and load-stops.mjs: request headers, download + unzip, streaming of stop_times.
import { createWriteStream, existsSync, mkdtempSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readTable, splitCsv } from "./lib-csv.mjs";

/** Request headers of a feed; BusOne wants the client to say how to reach it (the contact comes from the environment). */
export function hdrs(feed) {
  const h = { ...(feed.headers ?? {}) };
  if (h["X-BusOne-Client"] && process.env.CONTACT_EMAIL) h["X-BusOne-Client"] += `; contact: ${process.env.CONTACT_EMAIL}`;
  return h;
}

export const GTFS_TABLES = ["agency.txt", "routes.txt", "trips.txt", "stops.txt", "calendar.txt", "calendar_dates.txt"];

/** Downloads the feed's static GTFS and unzips the small tables next to the archive; returns the directory. */
export async function downloadGtfs(feed, names = GTFS_TABLES) {
  if (!feed.staticGtfsUrl) throw new Error(`feed ${feed.id} has no staticGtfsUrl: pass --gtfs-dir`);
  const res = await fetch(feed.staticGtfsUrl, { redirect: "follow", headers: { "User-Agent": "LateLotto/0.1 (play-money game)", ...hdrs(feed) }, signal: AbortSignal.timeout(600000) });
  if (!res.ok) throw new Error(`GTFS download failed: ${res.status}`);
  const dir = mkdtempSync(join(tmpdir(), "gtfs-"));
  // The archive goes to disk and the big table is streamed out of it with `unzip -p`: national feeds (Switzerland: ~300 MB zipped)
  // do not fit in memory. Small tables are extracted next to it.
  const zip = join(dir, "feed.zip");
  await pipeline(Readable.fromWeb(res.body), createWriteStream(zip));
  const x = spawnSync("unzip", ["-o", "-qq", zip, ...names, "-d", dir], { stdio: "inherit" });
  if (x.status !== 0 && x.status !== 11) throw new Error(`unzip failed (${x.status})`); // 11: an optional file (calendar.txt) is absent
  return dir;
}

/** stop_times rows, streamed from the archive (or from a plain file when `dir` is an extracted feed). */
export async function* stopTimes(dir) {
  const zip = join(dir, "feed.zip");
  if (!existsSync(zip)) { yield* readTable(join(dir, "stop_times.txt")); return; }
  const p = spawn("unzip", ["-p", zip, "stop_times.txt"], { stdio: ["ignore", "pipe", "inherit"] });
  const rl = createInterface({ input: p.stdout, crlfDelay: Infinity });
  let header = null;
  for await (const raw of rl) {
    const line = header === null ? raw.replace(/^﻿/, "") : raw;
    if (!line) continue;
    const cells = splitCsv(line);
    if (header === null) { header = cells; continue; }
    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = (cells[i] ?? "").trim();
    yield row;
  }
}
