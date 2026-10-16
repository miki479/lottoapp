import { describe, expect, it } from "vitest";
import { bankClaimValue, bankMatured, bankMultBps, bankSummary, bankWithhold } from "../shared/bank.ts";

const D = 86400;
describe("bank", () => {
  it("withholds 3% of the profit only", () => {
    expect(bankWithhold(300, 100, 0)).toBe(6);
    expect(bankWithhold(100, 100, 0)).toBe(0);
    expect(bankWithhold(0, 100, 0)).toBe(0);
    expect(bankWithhold(120, 100, 0)).toBe(0); // 0.6 rounds down
  });
  it("never lets the vault pass the cap", () => {
    expect(bankWithhold(100_100, 100, 2990)).toBe(10);
    expect(bankWithhold(100_100, 100, 3000)).toBe(0);
    expect(bankWithhold(100_100, 100, 5000)).toBe(0);
  });
  it("locks for 3 days", () => {
    expect(bankMatured(3 * D - 1)).toBe(false);
    expect(bankMatured(3 * D)).toBe(true);
    expect(bankClaimValue(100, 3 * D - 1)).toBe(0);
  });
  it("multiplier curve 1.00 -> 1.50", () => {
    expect(bankMultBps(0)).toBe(10000);
    expect(bankMultBps(3 * D)).toBe(10000);
    expect(bankMultBps(8.5 * D)).toBe(12500);
    expect(bankMultBps(14 * D)).toBe(15000);
    expect(bankMultBps(100 * D)).toBe(15000);
  });
  it("claim amount", () => {
    expect(bankClaimValue(100, 3 * D)).toBe(100);
    expect(bankClaimValue(100, 14 * D)).toBe(150);
    expect(bankClaimValue(3000, 30 * D)).toBe(4500);
    expect(bankClaimValue(7, 8.5 * D)).toBe(8); // floor(8.75)
  });
  it("summary", () => {
    expect(bankSummary([{ amount: 50, ageSec: D }, { amount: 100, ageSec: 14 * D }])).toEqual({ locked: 50, matured: 100, claimable: 150 });
  });
});
