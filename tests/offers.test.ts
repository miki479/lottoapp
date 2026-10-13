import { describe, expect, it } from "vitest";
import { marketEligible, offerCheck, offerMultiplier, offerOdds, offerPayout, offerReason, type OfferPlayer } from "../shared/offers.ts";

const base: OfferPlayer = { credits: 500, absentDays: 1, lastSettled: ["won", "lost", "won"], daysSinceLastSettled: 1, daysSinceLastOffer: null, localHour: 15, roll: 0.5 };
const lose = (n: number, of = 8) => [...Array(n).fill("lost"), ...Array(of - n).fill("won")] as ("won" | "lost")[];

describe("offerReason", () => {
  it("nobody by default", () => expect(offerReason(base)).toBeNull());
  it("absent from 5 days", () => {
    expect(offerReason({ ...base, absentDays: 4 })).toBeNull();
    expect(offerReason({ ...base, absentDays: 5 })).toBe("absent");
    expect(offerReason({ ...base, absentDays: 400 })).toBeNull();
  });
  it("lost 6 of the last 8", () => {
    expect(offerReason({ ...base, lastSettled: lose(5) })).toBeNull();
    expect(offerReason({ ...base, lastSettled: lose(6) })).toBe("losses");
    expect(offerReason({ ...base, lastSettled: lose(8) })).toBe("losses");
    expect(offerReason({ ...base, lastSettled: lose(6), daysSinceLastSettled: 45 })).toBeNull();
  });
  it("random only at 10:00 local, 2%, for players who have played (the absent ones are caught earlier)", () => {
    expect(offerReason({ ...base, localHour: 10, roll: 0.01 })).toBe("random");
    expect(offerReason({ ...base, localHour: 10, roll: 0.02 })).toBeNull();
    expect(offerReason({ ...base, localHour: 11, roll: 0.01 })).toBeNull();
    expect(offerReason({ ...base, localHour: 10, roll: 0.01, absentDays: null })).toBeNull(); // never played: not "active"
  });
  it("priority absent > losses > random", () => {
    expect(offerReason({ ...base, absentDays: 6, lastSettled: lose(7), localHour: 10, roll: 0 })).toBe("absent");
    expect(offerReason({ ...base, lastSettled: lose(7), localHour: 10, roll: 0 })).toBe("losses");
  });
  it("at most one offer per 10 days, and not for players who cannot bet", () => {
    expect(offerReason({ ...base, absentDays: 9, daysSinceLastOffer: 9 })).toBeNull();
    expect(offerReason({ ...base, absentDays: 9, daysSinceLastOffer: 10 })).toBe("absent");
    expect(offerReason({ ...base, absentDays: 9, credits: 5 })).toBeNull();
  });
  it("multiplier 10 for absent/losses, 5 for random", () => {
    expect(offerMultiplier("absent")).toBe(10);
    expect(offerMultiplier("losses")).toBe(10);
    expect(offerMultiplier("random")).toBe(5);
  });
});

describe("marketEligible", () => {
  const m = { odds_yes: 2, odds_no: 1.8, closesInH: 20, flash: false, delayKind: false };
  it("accepts a balanced question in the window", () => expect(marketEligible(m)).toBe(true));
  it("rejects near-certain, long shots, flash, delay kinds and bad timing", () => {
    expect(marketEligible({ ...m, odds_no: 1.2 })).toBe(false);
    expect(marketEligible({ ...m, odds_yes: 6 })).toBe(false);
    expect(marketEligible({ ...m, flash: true })).toBe(false);
    expect(marketEligible({ ...m, delayKind: true })).toBe(false);
    expect(marketEligible({ ...m, closesInH: 5 })).toBe(false);
    expect(marketEligible({ ...m, closesInH: 49 })).toBe(false);
  });
});

describe("odds and payout", () => {
  it("multiplies and caps at 100", () => {
    expect(offerOdds(1.79, 10)).toBe(17.9);
    expect(offerOdds(2.5, 40)).toBe(100);
    expect(offerOdds(3.99, 20)).toBe(79.8);
    expect(offerOdds(4, 40)).toBe(100);
  });
  it("pays stake x odds, floored", () => {
    expect(offerPayout(20, 1.79, 10)).toBe(358);
    expect(offerPayout(20, 3, 40)).toBe(2000);
  });
});

describe("offerCheck", () => {
  const o = { user_id: "u", market_id: "m", used_at: null, expires_at: "2026-10-14T00:00:00Z", max_stake: 20 };
  const ctx = { userId: "u", marketId: "m", stake: 20, baseOdds: 2, now: Date.parse("2026-10-13T00:00:00Z") };
  it("passes a valid use", () => expect(offerCheck(o, ctx)).toBeNull());
  it("rejects the wrong owner, market, used, expired, extras, big stakes, moved odds", () => {
    expect(offerCheck(null, ctx)).toBe("bad_offer");
    expect(offerCheck(o, { ...ctx, userId: "x" })).toBe("bad_offer");
    expect(offerCheck(o, { ...ctx, marketId: "x" })).toBe("bad_offer");
    expect(offerCheck({ ...o, used_at: "2026-10-13T00:00:00Z" }, ctx)).toBe("offer_used");
    expect(offerCheck(o, { ...ctx, now: Date.parse("2026-10-14T00:00:01Z") })).toBe("offer_expired");
    expect(offerCheck(o, { ...ctx, extras: true })).toBe("bad_offer");
    expect(offerCheck(o, { ...ctx, stake: 21 })).toBe("stake_too_high");
    expect(offerCheck(o, { ...ctx, baseOdds: 1.2 })).toBe("odds_too_low");
  });
});
