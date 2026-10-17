import { describe, expect, it } from "vitest";
import { AIRQ, WAVES, buildFlightMarkets, buildHourlyMarkets, buildManifoldMarkets, diurnalRatio, isAir, isFlights, isMf, isSpot, isWave, tickDef } from "../shared/ticks.ts";
import { question, type MarketRow } from "../web/src/lib/format.ts";
import { MESSAGES } from "../web/src/i18n/all.ts";

const now = Date.UTC(2026, 9, 20, 10, 20) / 1000, H = 3600;
const row = (m: ReturnType<typeof buildFlightMarkets>[number]) => ({ ...m, id: "x", status: "open", flash_multiplier: 1, flash_until: null, flash_kind: null } as unknown as MarketRow);

describe("sea waves, air quality, flights and Manifold", () => {
  it("know their series", () => {
    expect(isWave("wave:pal")).toBe(true); expect(isWave("wave:xxx")).toBe(false);
    expect(isAir("air:rom")).toBe(true); expect(isFlights("flights:it")).toBe(true); expect(isMf("mf:AbC123xyz")).toBe(true); expect(isMf("mf:../x")).toBe(false);
    for (const s of ["wave:pal", "air:rom", "flights:it", "mf:AbC123xyz"]) expect(isSpot(s)).toBe(true);
    expect(tickDef("wave:cag")!.category).toBe("nature"); expect(tickDef("flights:it")!.category).toBe("traffic"); expect(tickDef("mf:AbC123xyz")!.category).toBe("culture");
  });
  it("make a question every three hours from the model's value, with fair odds", () => {
    const hours: Record<number, number> = {}; for (let t = now - 24 * H; t <= now + 48 * H; t += H) hours[Math.floor(t / H) * H] = 0.9 + 0.01 * ((t / H) % 7);
    const w = buildHourlyMarkets("wave", { pal: hours }, now);
    expect(w.length).toBeGreaterThanOrEqual(6); expect(w.every((m) => m.category === "nature" && m.odds_yes >= 1 && m.odds_no >= 1)).toBe(true);
    expect(w.every((m) => Date.parse(m.target_at) / 1000 > now + 600)).toBe(true);
    const calm = buildHourlyMarkets("wave", { pal: Object.fromEntries(Object.keys(hours).map((k) => [k, 0.1])) }, now);
    expect(calm).toEqual([]);
    const a = buildHourlyMarkets("air", { rom: Object.fromEntries(Object.keys(hours).map((k) => [k, 32])) }, now);
    expect(a.length).toBeGreaterThanOrEqual(6); expect(a.every((m) => Number(m.params.threshold) % 5 === 0)).toBe(true);
  });
  it("follow the daily rhythm of the air traffic", () => {
    expect(diurnalRatio("flights:it", now, Date.UTC(2026, 9, 21, 3, 0) / 1000)).toBeLessThan(0.5);
    const f = buildFlightMarkets(800, now); expect(f.length).toBeGreaterThan(0);
    expect(buildFlightMarkets(null, now)).toEqual([]); expect(buildFlightMarkets(10, now)).toEqual([]);
  });
  it("offer Manifold questions only while the crowd is undecided", () => {
    const m = buildManifoldMarkets([{ id: "AbC123xyz", question: "Will X happen?", prob: 0.4 }, { id: "ZzZ999aaa", question: "Sure thing?", prob: 0.97 }], now);
    expect(m.length).toBeGreaterThan(0); expect(m.every((x) => x.params.series === "mf:AbC123xyz" && x.params.label === "Will X happen?")).toBe(true);
  });
  it("read as sentences in every language", () => {
    const hours: Record<number, number> = {}; for (let t = now - H; t <= now + 48 * H; t += H) hours[Math.floor(t / H) * H] = 1.4;
    const samples = [...buildHourlyMarkets("wave", { pal: hours }, now), ...buildFlightMarkets(800, now), ...buildManifoldMarkets([{ id: "AbC123xyz", question: "Will X happen?", prob: 0.4 }], now)];
    for (const l of ["it", "en-US", "en-GB", "ja"] as const) for (const m of samples) {
      const text = question(row(m), MESSAGES[l], l, "", "UTC", new Date(now * 1000));
      expect(text.length).toBeGreaterThan(15); expect(text).not.toMatch(/undefined|\[object/);
    }
  });
  it("cover cities that exist", () => { expect(Object.keys(WAVES).length).toBeGreaterThan(5); expect(Object.keys(AIRQ).length).toBeGreaterThan(5); });
});
