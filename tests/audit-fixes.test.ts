import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bankMultBps } from "../shared/bank.ts";
import { closeSeason } from "../shared/leagues.ts";
import { MAX_ODDS, computeOdds } from "../shared/odds.ts";
import { offerPayout } from "../shared/offers.ts";
import { FUN_STAKE, boostedPayout, delayStakeCap, parlayOdds, payout, singleStakeCap, stakeCap } from "../shared/wallet.ts";

describe("payout rounds like the database (exact cents, floor)", () => {
  it("does not lose a credit to floating point", () => {
    expect(100 * 1.15).toBeLessThan(115); // the trap
    expect(payout(100, 1.15)).toBe(115);
    expect(payout(10, 1.01)).toBe(10);
    expect(payout(7, 1.29)).toBe(9); // 9.03
    expect(payout(333, 2.3)).toBe(765); // 765.9
    expect(boostedPayout(100, 1.15)).toBe(130);
  });
  it("agrees with exact integer arithmetic on a grid", () => {
    for (let s = 10; s <= 600; s += 7) for (let c = 101; c <= 1500; c += 13) expect(payout(s, c / 100)).toBe(Math.floor((s * c) / 100));
  });
  it("is 0 for non-finite input", () => {
    expect(payout(Number.NaN, 2)).toBe(0);
    expect(payout(10, Number.POSITIVE_INFINITY)).toBe(0);
  });
  it("offer payout uses the same rounding", () => {
    expect(offerPayout(20, 1.5, 10)).toBe(300);
    expect(offerPayout(20, 4, 100)).toBe(2000); // odds capped at 100
  });
});

describe("delay stake cap (mirrors place_bet 0124)", () => {
  it("is 2000 at most and 4999 profit at most, never under the fun stake", () => {
    expect(delayStakeCap(3)).toBe(2000);
    expect(delayStakeCap(15)).toBe(357); // floor(4999 / 14)
    expect(delayStakeCap(1.05)).toBe(FUN_STAKE);
    expect(delayStakeCap(1.5)).toBe(Math.min(stakeCap(1.5), 2000));
  });
  it("any other question wins at most 10000 profit on one bet", () => {
    expect(singleStakeCap(3)).toBe(5000);       // floor(10000 / 2) = 5000
    expect(singleStakeCap(15)).toBe(714);       // floor(10000 / 14)
    expect(singleStakeCap(1.05)).toBe(FUN_STAKE);
  });
});

describe("parlay odds", () => {
  it("is the product rounded to cents and capped at 200", () => {
    expect(parlayOdds([1.5, 2])).toBe(3);
    expect(parlayOdds([1.33, 1.77])).toBe(2.35);
    expect(parlayOdds([15, 15, 15])).toBe(200);
  });
});

describe("flash odds follow run_flash(): yes only, capped at MAX_ODDS", () => {
  it("leaves no untouched", () => {
    const base = computeOdds(0.5), flash = computeOdds(0.5, 3);
    expect(flash.no).toBe(base.no);
    expect(flash.yes).toBeCloseTo(base.yes * 3, 1);
    expect(computeOdds(0.04, 3).yes).toBeLessThanOrEqual(MAX_ODDS);
  });
});

describe("bank and leagues edge cases", () => {
  it("a non-finite age is the base multiplier, not NaN", () => expect(bankMultBps(Number.NaN)).toBe(10000));
  it("a bronze player with no bets stays bronze and keeps credits", () => {
    const [r] = closeSeason([{ id: "a", league: 0, credits: 5000, played: false }]);
    expect(r).toMatchObject({ leagueAfter: 0, newCredits: 5000 });
  });
});

describe("migration 0113", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0113_audit_fixes.sql", import.meta.url), "utf8");
  it("caps boosts at 20 wherever it adds one", () => {
    expect(sql).not.toMatch(/boosts = boosts \+ 1/);
    expect(sql.match(/least\(20, boosts \+ 1\)/g)?.length).toBe(2);
  });
  it("pays parlays on the rounded odds and rejects null legs", () => {
    expect(sql).toContain("prod := least(100, round(prod, 2))");
    expect(sql).toContain("p_legs is null or jsonb_typeof(p_legs)");
  });
});

import { parlayStakeCap as psc } from "../shared/wallet.ts";
describe("parlayStakeCap", () => {
  it("follows the combined quote, not the safest leg", () => { expect(psc([1.05, 3, 2])).toBe(5000); expect(psc([1.05, 1.05, 1.05])).toBe(200); });
  it("is limited by 50000 of profit and 5000", () => { expect(psc([2.5, 2.5, 2])).toBe(4347); expect(psc([1.8, 1.8, 1.5])).toBe(5000); expect(psc([6, 6, 6])).toBe(251); });
});

import { liveYesProbability as lyp } from "../shared/odds.ts";
describe("train drift in live pricing", () => {
  it("a train read on time far from its stop keeps a realistic chance of being late there", () => {
    const far = lyp(0.25, 0, 300, 17, true); // 45-90 minutes ahead: 23% were late in the logged results
    expect(far).toBeGreaterThan(0.18); expect(far).toBeLessThan(0.3);
    expect(lyp(0.25, 0, 300, 30, true)).toBeGreaterThan(lyp(0.25, 0, 300, 3, true)); // further ahead, more chance
  });
});

import { TRAIN_START_FLOOR, calibrateTrainYes, routePrior } from "../shared/odds.ts";
describe("Italian train calibration and per-line memory", () => {
  it("puts the model's chance on what the settled questions showed", () => {
    expect(calibrateTrainYes(0.07)).toBeCloseTo(0.112, 3);
    expect(calibrateTrainYes(0.05)).toBeGreaterThan(0.07);
    expect(calibrateTrainYes(0.92)).toBeLessThan(0.8);
    expect(calibrateTrainYes(0.5)).toBeGreaterThan(0.4); expect(calibrateTrainYes(0.5)).toBeLessThan(0.5);
    for (let p = 0.03; p < 0.97; p += 0.02) expect(calibrateTrainYes(p + 0.02)).toBeGreaterThanOrEqual(calibrateTrainYes(p)); // never turns around
  });
  it("a train that was almost always late gets a higher chance than the country, one that rarely was a lower one", () => {
    expect(routePrior(0.26, 0, 0)).toBeCloseTo(0.26, 2);
    expect(routePrior(0.26, 30, 24)).toBeGreaterThan(0.5);
    expect(routePrior(0.26, 30, 1)).toBeLessThan(0.1);
    expect(TRAIN_START_FLOOR).toBeGreaterThan(0.3);
  });
});
