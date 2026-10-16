import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

/** Split one CSV line (RFC 4180 quotes, no multi-line fields; GTFS does not use them in practice). */
export function splitCsv(line) {
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/** Stream a GTFS table as objects; never loads the whole file in memory. */
export async function* readTable(path) {
  const rl = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  let header = null;
  for await (const raw of rl) {
    const line = header === null ? raw.replace(/^﻿/, "") : raw;
    if (!line) continue;
    const cells = splitCsv(line);
    if (header === null) { header = cells.map((c) => c.trim()); continue; }
    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = (cells[i] ?? "").trim();
    yield row;
  }
}

export async function readAll(path) {
  const rows = [];
  for await (const r of readTable(path)) rows.push(r);
  return rows;
}
