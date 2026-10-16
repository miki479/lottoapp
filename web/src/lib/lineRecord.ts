import { useEffect, useState } from "preact/hooks";
import { sb } from "./api.ts";
import { cityOf } from "./cities.ts";
import type { MarketRow } from "./format.ts";
import { buildRecord, lineKey, type Closed, type LineRecord } from "./history.ts";

/** Reading of the closed questions behind a line's record (see history.ts), shared by every card that asks for it. */
const DAY = 86_400_000;
// ---- reading: one request for every line asked about in the same moment, kept for ten minutes ----
const TTL = 10 * 60_000;
const cache = new Map<string, { at: number; rec: LineRecord | null }>();
const asked = new Set<string>(), waiting = new Set<string>(), subs = new Set<() => void>();
let timer = 0;

async function flush() {
  timer = 0;
  const keys = [...waiting]; waiting.clear();
  if (!keys.length) return;
  try { await read(keys); } catch { for (const k of keys) asked.delete(k); } // a failed reading is asked again the next time a card needs it
}

async function read(keys: string[]) {
  const names = [...new Set(keys.map((k) => k.split("|").slice(2).join("|")))];
  const since = new Date(Date.now() - 8 * DAY).toISOString(), rows: { kind: string; city_id: string; routeName: string; target_at: string; outcome: "yes" | "no" | null; delay: number | null; thr: string | null; evThr: number | null }[] = [];
  for (let i = 0; i < names.length; i += 40) {
    const { data } = await sb.from("markets").select("kind,city_id,target_at,outcome,delay:evidence->delaySec,evThr:evidence->thresholdSec,thr:params->>thresholdSec,routeName:params->>routeName")
      .eq("status", "resolved").in("kind", ["train_delay_gt", "bus_delay_gt"]).in("params->>routeName", names.slice(i, i + 40)).is("params->>ladderOf", null).gte("target_at", since).limit(4000);
    rows.push(...((data ?? []) as unknown as typeof rows));
  }
  const now = Date.now();
  for (const k of keys) {
    const [kind, city, ...rest] = k.split("|"), name = rest.join("|");
    const mine = rows.filter((r) => r.kind === kind && r.city_id === city && r.routeName === name).map((r): Closed => ({ target_at: r.target_at, outcome: r.outcome, delay: r.delay === null ? null : Number(r.delay), threshold: Number(r.evThr ?? r.thr ?? 0) || null }));
    cache.set(k, { at: now, rec: buildRecord(mine, cityOf(city!).timezone, now) });
    asked.delete(k);
  }
  subs.forEach((f) => f());
}

/**
 * The record of the line behind a question: undefined while it is being read, null when there is nothing to show (not a delay question, or less than
 * two days of closed questions). One reading for the whole app: the home cards, the bet slip and the list of my bets all ask the same cache.
 */
export function useLineRecord(m: Pick<MarketRow, "kind" | "city_id" | "params"> | null | undefined): LineRecord | null | undefined {
  const key = m ? lineKey(m) : null;
  const [, tick] = useState(0);
  useEffect(() => {
    if (!key) return;
    const f = () => tick((n) => n + 1);
    subs.add(f);
    const hit = cache.get(key);
    if ((!hit || Date.now() - hit.at > TTL) && !asked.has(key)) { asked.add(key); waiting.add(key); if (!timer) timer = window.setTimeout(() => void flush(), 60); }
    return () => { subs.delete(f); };
  }, [key]);
  if (!key) return null;
  const hit = cache.get(key);
  return hit ? hit.rec : undefined;
}
