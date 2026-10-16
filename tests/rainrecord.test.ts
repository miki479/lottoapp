import { describe, expect, it } from "vitest";
import { buildRainRecord, partOfHour, type RainClosed } from "../web/src/lib/rainRecord.ts";

const NOW = Date.parse("2026-10-14T20:00:00Z");
const row = (iso: string, outcome: "yes" | "no", mm: number): RainClosed => ({ target_at: iso, outcome, evidence: { precipitationMm: mm } });

describe("rain record by part of the day", () => {
  it("splits the day into morning, afternoon, evening", () => {
    expect([4, 5, 11, 12, 17, 18, 23].map(partOfHour)).toEqual(["e", "m", "m", "a", "a", "e", "e"]);
  });
  it("says nothing with fewer than six closed hours", () => {
    expect(buildRainRecord([row("2026-10-13T10:00:00Z", "yes", 1)], "UTC", "all", NOW)).toBeNull();
  });
  it("counts the rainy hours of the band and their millimetres", () => {
    const rows: RainClosed[] = [];
    for (let d = 8; d <= 13; d++) rows.push(row(`2026-10-${String(d).padStart(2, "0")}T14:00:00Z`, d % 2 ? "yes" : "no", d % 2 ? 1.5 : 0));
    rows.push(row("2026-10-13T07:00:00Z", "yes", 9)); // morning: not in the afternoon band
    const r = buildRainRecord(rows, "UTC", "a", NOW)!;
    expect(r.hours).toBe(6); expect(r.rainy).toBe(3); expect(r.avgMm).toBeCloseTo(1.5); expect(r.maxMm).toBeCloseTo(1.5);
    expect(r.days).toHaveLength(7); expect(r.days.at(-2)!.mm).toBe(1.5);
  });
});
