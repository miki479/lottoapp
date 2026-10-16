import { describe, expect, it } from "vitest";
import { resolveEvent } from "../shared/resolve.ts";
import { evalMatch, isTwoBet, LEAGUES, twoBetLine, twoWayPriors } from "../shared/sport.ts";
import type { MatchEvent } from "../shared/types.ts";

describe("bets of the sports without a draw", () => {
  it("reads the lines", () => {
    expect(isTwoBet("tot:225.5")).toBe(true); expect(isTwoBet("mrg:-6.5")).toBe(true); expect(isTwoBet("mrg:6")).toBe(false); expect(isTwoBet("home_win")).toBe(false);
    expect(twoBetLine("mrg:-6.5")).toBe(-6.5);
  });
  it("settles total points and handicaps from the final score", () => {
    expect(evalMatch("tot:225.5", { hg: 110, ag: 116 })).toBe(true);
    expect(evalMatch("tot:225.5", { hg: 100, ag: 125 })).toBe(false);
    expect(evalMatch("mrg:6.5", { hg: 110, ag: 103 })).toBe(true);
    expect(evalMatch("mrg:6.5", { hg: 110, ag: 104 })).toBe(false);
    expect(evalMatch("mrg:-6.5", { hg: 100, ag: 106 })).toBe(true);
    expect(evalMatch("mrg:-6.5", { hg: 100, ag: 107 })).toBe(false);
  });
  it("prices three total lines and four handicap lines for every league, always ending in .5 and between 10% and 90%", () => {
    for (const lg of LEAGUES.filter((l) => l.two)) {
      const pr = twoWayPriors(undefined, undefined, lg.two!) as unknown as Record<string, number>;
      const tot = Object.keys(pr).filter((k) => k.startsWith("tot:")), mrg = Object.keys(pr).filter((k) => k.startsWith("mrg:"));
      expect(tot).toHaveLength(3); expect(mrg.length).toBeGreaterThanOrEqual(3);
      for (const k of [...tot, ...mrg]) { expect(isTwoBet(k)).toBe(true); expect(pr[k]).toBeGreaterThanOrEqual(0.1); expect(pr[k]).toBeLessThanOrEqual(0.9); }
      const sorted = tot.sort((a, b) => twoBetLine(a) - twoBetLine(b)).map((k) => pr[k]!);
      expect(sorted[0]).toBeGreaterThan(sorted[2]!);
    }
  });
  it("does not void a basketball final as implausible, but still does for a football one", () => {
    const ev = (league: string): MatchEvent => ({ id: "m", cityId: "world", feedId: "sportsdb", kind: "match_bet", category: "sport", eventId: "1", bet: "home_win", league, closesAt: 0, targetAt: 100, deadlineAt: 1e6 });
    const run = (league: string, hg: number, ag: number) => resolveEvent({ event: ev(league), now: 5000, feed: { feedId: "sportsdb", lastOkAt: 4990 }, staleAfterSec: 180, delays: [], weather: [], match: { eventId: "1", homeGoals: hg, awayGoals: ag, status: "FT", fetchedAt: 4990 } } as never);
    expect(run("NBA", 112, 105)).toMatchObject({ status: "resolved", outcome: "yes" });
    expect(run("Serie A", 112, 105)).not.toMatchObject({ outcome: "yes" });
  });
});
