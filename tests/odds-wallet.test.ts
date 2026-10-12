import { describe, expect, it } from "vitest";
import { DEFAULT_YES_PROBABILITY, FLASH_MAX_MULTIPLIER, MAX_ODDS, MIN_ODDS, computeOdds, yesProbability } from "../shared/odds.ts";
import { MAX_STAKE, MIN_STAKE, REFILL_THRESHOLD, REFILL_TO, dailyRefill, payout, validateStake } from "../shared/wallet.ts";

describe("odds", () => {
  it("uses the fixed starting probability when history is empty", () => {
    expect(yesProbability(null, 0.3)).toBeCloseTo(0.3);
    expect(yesProbability({ n: 0, yes: 0 }, DEFAULT_YES_PROBABILITY.rain_at)).toBeCloseTo(0.25);
  });
  it("moves toward observed frequency as history grows", () => {
    const small = yesProbability({ n: 5, yes: 5 }, 0.3);
    const big = yesProbability({ n: 500, yes: 500 }, 0.3);
    expect(small).toBeGreaterThan(0.3);
    expect(big).toBeGreaterThan(small);
    expect(big).toBeLessThanOrEqual(0.97);
  });
  it("never lets probability reach 0 or 1", () => {
    expect(yesProbability({ n: 1000, yes: 0 }, 0.3)).toBeGreaterThanOrEqual(0.03);
  });
  it("keeps a house edge: both sides' implied probabilities sum above 1", () => {
    const o = computeOdds(0.4);
    expect(1 / o.yes + 1 / o.no).toBeGreaterThan(1);
  });
  it("clamps odds", () => {
    expect(computeOdds(0.99).yes).toBe(MIN_ODDS);
    expect(computeOdds(0.03).yes).toBeLessThanOrEqual(MAX_ODDS);
  });
  it("applies flash multiplier but caps it", () => {
    const normal = computeOdds(0.5).yes;
    expect(computeOdds(0.5, 3).yes).toBeCloseTo(normal * 3, 1);
    expect(computeOdds(0.5, 10).yes).toBeCloseTo(normal * FLASH_MAX_MULTIPLIER, 1);
  });
});

describe("wallet", () => {
  it("validates stakes", () => {
    expect(validateStake(50, 1000)).toBe("ok");
    expect(validateStake(MIN_STAKE - 1, 1000)).toBe("too_low");
    expect(validateStake(MAX_STAKE + 1, 5000)).toBe("too_high");
    expect(validateStake(50, 40)).toBe("insufficient");
    expect(validateStake(10.5, 1000)).toBe("not_integer");
  });
  it("pays whole credits, rounded down", () => {
    expect(payout(100, 2.5)).toBe(250);
    expect(payout(33, 1.5)).toBe(49);
  });
  const tz = "Asia/Tokyo";
  const day1 = Date.UTC(2026, 0, 10, 3, 0, 0) / 1000; // 12:00 JST
  it("refills once per local day when under the threshold", () => {
    const r = dailyRefill(REFILL_THRESHOLD - 1, null, day1, tz);
    expect(r).toEqual({ balance: REFILL_TO, refillDate: "2026-01-10" });
    expect(dailyRefill(5, "2026-01-10", day1, tz)).toBeNull();
    expect(dailyRefill(5, "2026-01-09", day1, tz)).not.toBeNull();
  });
  it("does not refill at or above the threshold", () => {
    expect(dailyRefill(REFILL_THRESHOLD, null, day1, tz)).toBeNull();
  });
  it("uses the city's local day, not UTC", () => {
    const lateUtc = Date.UTC(2026, 0, 10, 16, 0, 0) / 1000; // 01:00 JST on the 11th
    expect(dailyRefill(0, "2026-01-10", lateUtc, tz)?.refillDate).toBe("2026-01-11");
  });
});

import { settleBet } from "../shared/settle.ts";
describe("settlement", () => {
  const bet = { pick: "yes" as const, stake: 100, odds: 2.5 };
  it("pays winners the locked odds, floored", () => expect(settleBet(bet, "yes")).toEqual({ status: "won", payout: 250 }));
  it("pays nothing to losers", () => expect(settleBet(bet, "no")).toEqual({ status: "lost", payout: 0 }));
  it("refunds the stake on void, whatever the pick", () => {
    expect(settleBet(bet, "void")).toEqual({ status: "void", payout: 100 });
    expect(settleBet({ ...bet, pick: "no" }, "void")).toEqual({ status: "void", payout: 100 });
  });
});

import { boostedPayout } from "../shared/wallet.ts";
describe("boost", () => {
  it("doubles the net win", () => { expect(boostedPayout(100, 2)).toBe(300); expect(boostedPayout(100, 3.07)).toBe(100 * 3.07 > 0 ? 307 + 207 : 0); });
  it("caps the extra at 1000", () => { expect(boostedPayout(500, 15)).toBe(7500 + 1000); });
});

import { learnedPrior } from "../shared/odds.ts";
describe("learned starting chance", () => {
  it("moves the guess toward what happened, more as the sample grows", () => {
    expect(learnedPrior(0, 0, 0.05)).toBeCloseTo(0.05);
    expect(learnedPrior(44, 135, 0.05)).toBeGreaterThan(0.28);
    expect(learnedPrior(1, 28, 0.3)).toBeLessThan(0.12);
    expect(learnedPrior(0, 500, 0.3)).toBe(0.03);
  });
});
