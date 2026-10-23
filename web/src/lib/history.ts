import type { MarketRow } from "./format.ts";
import { dtf } from "./intl.ts";

/**
 * "Why this quote": how a line did over the last seven days, read from the questions about it that have already closed (the same table the starting
 * chance of every delay quote is learned from: markets.outcome, with the delay measured when each one closed). Nothing is estimated here and nothing is
 * stored twice: a line with fewer than two days of closed questions has no record, and the card shows nothing about it.
 */

/** One closed question about a line, as the server stores it. */
export interface Closed { target_at: string; outcome: "yes" | "no" | null; delay: number | null; threshold: number | null }
/** One day of the week: the worst delay measured that day (seconds, 0 when on time) and whether a question about it was answered "late"; null when nothing closed that day. */
export interface DayPoint { day: string; delaySec: number | null; late: boolean }
export interface LineRecord {
  /** Seven days, oldest first, today last. */
  points: DayPoint[];
  /** Days with something measured, and how many of them were late. */
  days: number; lateDays: number;
  /** Mean of the daily worst delays and the worst of all, in minutes. */
  avgMin: number; worstMin: number;
  /** The line of the question (minutes): later than this is "late". */
  thresholdMin: number;
}

const DAY = 86_400_000;
const dayIn = (tz: string, ms: number) => dtf("en-CA", { timeZone: tz }).format(new Date(ms));

/** The record of a line from its closed questions (pure). Null under two days of data. */
export function buildRecord(rows: readonly Closed[], tz: string, nowMs: number): LineRecord | null {
  const keys = Array.from({ length: 7 }, (_, i) => dayIn(tz, nowMs - (6 - i) * DAY));
  const byDay = new Map<string, { delay: number; late: boolean; thr: number }>();
  for (const r of rows) {
    if (r.delay === null || !Number.isFinite(r.delay)) continue;
    const k = dayIn(tz, Date.parse(r.target_at));
    if (!keys.includes(k)) continue;
    const cur = byDay.get(k) ?? { delay: 0, late: false, thr: 0 };
    byDay.set(k, { delay: Math.max(cur.delay, r.delay), late: cur.late || r.outcome === "yes", thr: Math.max(cur.thr, r.threshold ?? 0) });
  }
  const points = keys.map((day): DayPoint => { const d = byDay.get(day); return d ? { day, delaySec: Math.max(0, d.delay), late: d.late } : { day, delaySec: null, late: false }; });
  const seen = points.filter((p) => p.delaySec !== null), days = seen.length;
  if (days < 2) return null;
  const delays = seen.map((p) => p.delaySec as number);
  const thr = [...byDay.values()].map((d) => d.thr).filter((x) => x > 0);
  return {
    points, days, lateDays: seen.filter((p) => p.late).length,
    avgMin: Math.round((delays.reduce((a, b) => a + b, 0) / days / 60) * 10) / 10, worstMin: Math.round(Math.max(...delays) / 60),
    thresholdMin: thr.length ? Math.round(thr.reduce((a, b) => a + b, 0) / thr.length / 60) : 0,
  };
}

/** What identifies a line: the kind of service, the city and the name of the line or train. Null for anything that has no such record. */
export const lineKey = (m: Pick<MarketRow, "kind" | "city_id" | "params">): string | null => {
  const name = String(m.params.routeName ?? "").trim();
  return (m.kind === "train_delay_gt" || m.kind === "bus_delay_gt") && name && m.city_id ? `${m.kind}|${m.city_id}|${name}` : null;
};
