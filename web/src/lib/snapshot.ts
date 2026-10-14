import type { MarketRow } from "./format.ts";

/** What the server prepares once a minute for every home screen (supabase/functions/snapshot): the open questions and the public aggregates. */
export interface Snapshot { t: number; markets: MarketRow[]; health: { feed_id: string; last_ok_at: string | null }[]; popular: unknown[]; activity: unknown[]; places: unknown[]; results: unknown[] }

const MAX_AGE_MS = 4 * 60_000;
let cached: { at: number; snap: Snapshot | null } | null = null, inflight: Promise<Snapshot | null> | null = null;

/**
 * The picture, from the CDN: a file for everybody instead of a dozen database questions per phone. Asked at most once every 20 seconds, null when it cannot be had or is
 * older than four minutes (the caller then asks the database itself, as before).
 */
export function getSnapshot(base: string): Promise<Snapshot | null> {
  if (cached && Date.now() - cached.at < 20_000) return Promise.resolve(cached.snap);
  if (inflight) return inflight;
  // the number in the address changes every 30 seconds: everybody asks for the same address, so the CDN answers from its copy
  inflight = fetch(`${base}/storage/v1/object/public/snap/home.json?v=${Math.floor(Date.now() / 30_000)}`, { cache: "no-store" })
    .then(async (r) => { if (!r.ok) return null; const s = (await r.json()) as Snapshot; return s && Array.isArray(s.markets) && Date.now() - s.t < MAX_AGE_MS ? s : null; })
    .catch(() => null)
    .then((snap) => { cached = { at: Date.now(), snap }; inflight = null; return snap; });
  return inflight;
}
