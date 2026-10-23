/**
 * "How did this part of the day go lately?" for the rain hours of one city: read from the rain questions about it that have already closed (the same
 * markets table the starting chance of every rain quote is learned from; the rain that fell is stored with each answer). Nothing is estimated here.
 */
import { dtf } from "./intl.ts";
export type Part = "m" | "a" | "e";
/** One closed rain question: the hour it was about and what fell. */
export interface RainClosed { target_at: string; outcome: "yes" | "no" | null; evidence: { precipitationMm?: number } | null }
export interface RainRecord {
  /** Seven days, oldest first: the most rain of the day in the band (mm), null when no hour of the band closed that day. */
  days: { day: string; mm: number | null }[];
  /** Hours that closed in the band, how many of them were rainy, and the mean and highest millimetres of the rainy ones. */
  hours: number; rainy: number; avgMm: number; maxMm: number;
}

/** Morning 05–12, afternoon 12–18, evening and night 18–05 (local hour). */
export const partOfHour = (h: number): Part => (h >= 5 && h < 12 ? "m" : h >= 12 && h < 18 ? "a" : "e");
const DAY = 86_400_000;
const dayIn = (tz: string, ms: number) => dtf("en-CA", { timeZone: tz }).format(new Date(ms));
const hourIn = (tz: string, ms: number) => Number(dtf("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: tz }).format(new Date(ms)));

/** The record of a band of the day ("all" = every hour) from the closed questions (pure). Null under six closed hours: too few to say anything. */
export function buildRainRecord(rows: readonly RainClosed[], tz: string, part: Part | "all", nowMs: number): RainRecord | null {
  const keys = Array.from({ length: 7 }, (_, i) => dayIn(tz, nowMs - (6 - i) * DAY));
  const byDay = new Map<string, number>();
  let hours = 0, rainy = 0, sum = 0, max = 0;
  for (const r of rows) {
    if (r.outcome === null) continue;
    const at = Date.parse(r.target_at);
    if (!(at <= nowMs) || nowMs - at > 7 * DAY) continue;
    if (part !== "all" && partOfHour(hourIn(tz, at)) !== part) continue;
    const mm = Math.max(0, Number(r.evidence?.precipitationMm ?? 0)), key = dayIn(tz, at);
    if (!keys.includes(key)) continue;
    hours++; byDay.set(key, Math.max(byDay.get(key) ?? 0, mm));
    if (r.outcome === "yes") { rainy++; sum += mm; max = Math.max(max, mm); }
  }
  if (hours < 6) return null;
  return { days: keys.map((day) => ({ day, mm: byDay.has(day) ? byDay.get(day)! : null })), hours, rainy, avgMm: rainy ? sum / rainy : 0, maxMm: max };
}
