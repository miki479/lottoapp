import { describe, expect, it } from "vitest";
import { buildLastfmMarkets, isLastfm, isSpot, tickDef } from "../shared/ticks.ts";

describe("lastfm questions", () => {
  const now = Date.parse("2026-10-13T08:00:00Z") / 1000;
  it("needs a pace of growth", () => {
    expect(buildLastfmMarkets({ taylorswift: { listeners: 8_000_000, perHour: 0 } }, now)).toEqual([]);
  });
  it("puts the line above today's total, at 12 UTC", () => {
    const ms = buildLastfmMarkets({ taylorswift: { listeners: 8_000_000, perHour: 500 } }, now);
    expect(ms.length).toBeGreaterThan(0);
    for (const m of ms) { expect(m.params.series).toBe("lastfm:taylorswift"); expect(m.params.threshold).toBeGreaterThan(8_000_000); expect(new Date(m.target_at).getUTCHours()).toBe(12); }
  });
  it("is a spot series", () => { expect(isLastfm("lastfm:drake")).toBe(true); expect(isSpot("lastfm:drake")).toBe(true); expect(tickDef("lastfm:drake")?.category).toBe("culture"); });
});
