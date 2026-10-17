import { describe, expect, it } from "vitest";
import { MESSAGES } from "../web/src/i18n/all.ts";
import { question } from "../web/src/lib/format.ts";
import { buildChessMarkets, buildF1Markets, buildHnMarkets, buildLaunchMarkets, isF1, isLaunch, tickDef, tickYes } from "../shared/ticks.ts";

const now = Date.UTC(2026, 9, 17, 13, 0) / 1000;

describe("hacker news, chess, launches and Formula 1 questions", () => {
  it("asks about the front page every six hours", () => {
    const m = buildHnMarkets(412, now);
    expect(m.length).toBeGreaterThanOrEqual(4);
    expect(m.every((x) => x.params.series === "hn:max" && x.params.threshold % 50 === 0 && x.odds_yes > 1 && x.odds_no > 1)).toBe(true);
    expect(buildHnMarkets(null, now)).toEqual([]);
    expect(buildHnMarkets(5, now)).toEqual([]);
  });
  it("asks about each chess player at 08 and 20 UTC", () => {
    const m = buildChessMarkets({ hikaru: 3465, magnuscarlsen: 3416 }, now);
    expect(new Set(m.map((x) => x.params.series))).toEqual(new Set(["chess:hikaru", "chess:magnuscarlsen"]));
    expect(m.every((x) => Number(x.params.threshold) % 10 === 0 && [8, 20].includes(new Date(x.target_at).getUTCHours()))).toBe(true);
    expect(m.every((x) => Math.abs(Number(x.params.threshold) - Number(x.params.forecast)) <= 10)).toBe(true);
  });
  it("offers only launches that are Go, soon and not too soon", () => {
    const id = "3b430f81-0ff1-4d85-8a1a-cef0de326198";
    const ok = { id, name: "Falcon 9 | Bandwagon 5", net: now + 2 * 86400, go: true };
    const m = buildLaunchMarkets([ok, { ...ok, id: "11111111-1111-1111-1111-111111111111", go: false }, { ...ok, id: "22222222-2222-2222-2222-222222222222", net: now + 600 }, { ...ok, id: "33333333-3333-3333-3333-333333333333", net: now + 9 * 86400 }], now);
    expect(m).toHaveLength(1);
    expect(isLaunch(String(m[0]!.params.series))).toBe(true);
    expect(new Date(m[0]!.closes_at).getTime() / 1000).toBe(ok.net - 900);
    expect(new Date(m[0]!.target_at).getTime() / 1000).toBe(ok.net + 3 * 3600);
  });
  it("prices the next Grand Prix from the championship", () => {
    const st = [{ code: "ANT", name: "Antonelli", points: 340 }, { code: "RUS", name: "Russell", points: 300 }, { code: "NOR", name: "Norris", points: 200 }, { code: "VER", name: "Verstappen", points: 150 }, { code: "LEC", name: "Leclerc", points: 100 }, { code: "HAM", name: "Hamilton", points: 80 }];
    const m = buildF1Markets({ season: 2026, round: 18, name: "United States Grand Prix", start: now + 8 * 86400 - 3 * 86400 }, st, now);
    expect(m).toHaveLength(10);
    expect(m.every((x) => isF1(String(x.params.series)))).toBe(true);
    const yes = (code: string, w: string) => m.find((x) => x.params.series === `f1:2026-18:${code}:${w}`)!.odds_yes;
    expect(yes("ANT", "w")).toBeLessThan(yes("LEC", "w"));         // the favourite pays less
    expect(yes("ANT", "p")).toBeLessThan(yes("ANT", "w"));          // the podium is likelier than the win
    expect(buildF1Markets({ season: 2026, round: 19, name: "x", start: now + 20 * 86400 }, st, now)).toEqual([]);
    expect(buildF1Markets(null, st, now)).toEqual([]);
  });
  it("reads a fact as yes only on 1", () => {
    expect(tickYes("f1:2026-18:ANT:w", 1, 0.5)).toBe(true);
    expect(tickYes("f1:2026-18:ANT:w", 0, 0.5)).toBe(false);
    expect(tickYes("launch:3b430f81-0ff1-4d85-8a1a-cef0de326198", 1, 0.5)).toBe(true);
    expect(tickDef("hn:max")?.category).toBe("culture");
    expect(tickDef("chess:hikaru")?.label).toBe("Hikaru Nakamura");
    expect(tickDef("launch:3b430f81-0ff1-4d85-8a1a-cef0de326198")?.category).toBe("nature");
  });
  it("tells every new question in every language, with no raw placeholder left", () => {
    const row = (series: string, params: Record<string, unknown>, at: string) => ({ id: "x", city_id: "world", category: "culture", kind: "tick_gt", feed_id: "t", params: { series, threshold: 3500, unit: "", forecast: 3480, at: 0, ...params }, closes_at: at, target_at: at, deadline_at: at, odds_yes: 2, odds_no: 1.8, status: "open" }) as never;
    const at = "2026-10-18T20:00:00Z";
    for (const loc of ["it", "en-US", "en-GB", "ja"] as const) {
      const msg = MESSAGES[loc];
      const texts = [
        question(row("hn:max", { label: "Hacker News" }, at), msg, loc, "", "UTC"),
        question(row("chess:hikaru", { label: "Hikaru Nakamura" }, at), msg, loc, "", "UTC"),
        question(row("launch:3b430f81-0ff1-4d85-8a1a-cef0de326198", { label: "Falcon 9 | Bandwagon 5", threshold: 0.5 }, at), msg, loc, "", "UTC"),
        question(row("f1:2026-18:ANT:w", { label: "Antonelli", note: "United States Grand Prix", threshold: 0.5 }, "2026-10-25T23:00:00Z"), msg, loc, "", "UTC"),
        question(row("f1:2026-18:ANT:p", { label: "Antonelli", note: "United States Grand Prix", threshold: 0.5 }, "2026-10-25T23:00:00Z"), msg, loc, "", "UTC"),
      ];
      for (const s of texts) { expect(s.length, loc).toBeGreaterThan(15); expect(s, loc).not.toMatch(/undefined|\$\{|NaN/); }
      expect(texts[1]).toContain("Hikaru");
      expect(texts[3]).toContain("Antonelli");
    }
  });
});
