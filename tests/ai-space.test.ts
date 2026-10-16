import { describe, expect, it } from "vitest";
import { buildHfMarkets, buildSolarWindMarkets, CRYPTO, isCrypto, isHf, isSolarWind, isSpot, tickDef, WIKI_ARTICLES } from "../shared/ticks.ts";

const now = Date.parse("2026-10-14T16:00:00Z") / 1000;

describe("Hugging Face likes", () => {
  it("needs a pace of growth", () => { expect(buildHfMarkets({ "deepseek-r1": { likes: 14_000, perHour: 0 } }, now)).toEqual([]); });
  it("puts the line at noon UTC, above nothing we invented", () => {
    const ms = buildHfMarkets({ "deepseek-r1": { likes: 14_000, perHour: 4 } }, now);
    expect(ms.length).toBeGreaterThan(0);
    for (const m of ms) { expect(m.params.series).toBe("hf:deepseek-r1"); expect(new Date(m.target_at).getUTCHours()).toBe(12); expect(m.params.threshold).toBeGreaterThanOrEqual(14_000); expect(m.odds_yes).toBeGreaterThan(1); }
  });
  it("is a spot series in Cultura", () => { expect(isHf("hf:flux-dev")).toBe(true); expect(isSpot("hf:flux-dev")).toBe(true); expect(tickDef("hf:flux-dev")?.category).toBe("culture"); expect(isHf("hf:nope")).toBe(false); });
});

describe("solar wind", () => {
  it("asks 6, 12 and 24 hours ahead, with two lines each", () => {
    const ms = buildSolarWindMarkets(480, now);
    expect(ms.length).toBe(6);
    for (const m of ms) { expect(m.params.series).toBe("sw"); expect(m.category).toBe("nature"); expect(Number(m.params.threshold) % 25).toBe(0); expect(new Date(m.target_at).getUTCMinutes()).toBe(0); }
  });
  it("refuses an absurd reading", () => { expect(buildSolarWindMarkets(0, now)).toEqual([]); expect(buildSolarWindMarkets(9000, now)).toEqual([]); });
  it("is a spot series", () => { expect(isSolarWind("sw")).toBe(true); expect(isSpot("sw")).toBe(true); });
});

describe("more coins and articles", () => {
  it("knows the new coins", () => { for (const k of ["btc", "eth", "sol", "bnb", "xrp"]) expect(isCrypto(k)).toBe(true); expect(isCrypto("doge")).toBe(false); expect(CRYPTO.xrp.step).toBeLessThan(1); });
  it("has the tech and space articles", () => { for (const a of ["ChatGPT", "SpaceX", "NASA", "Nvidia"]) expect(WIKI_ARTICLES).toContain(a); });
});
