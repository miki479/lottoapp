import { describe, expect, it } from "vitest";
import { resolveEvent, type ResolveInput } from "../shared/resolve.ts";
import type { BusDelayEvent, RainEvent } from "../shared/types.ts";

const T = 1_800_000_000; // arbitrary target, multiple of 3600
const bus: BusDelayEvent = {
  id: "e1", cityId: "tokyo", feedId: "toei", kind: "bus_delay_gt", category: "bus",
  routeId: "r", tripId: "t1", stopId: "s1", thresholdSec: 180,
  closesAt: T - 600, targetAt: T, deadlineAt: T + 1800,
};
const rain: RainEvent = {
  id: "e2", cityId: "tokyo", feedId: "om", kind: "rain_at", category: "weather",
  minMm: 0.1, closesAt: T - 600, targetAt: T + 1200, deadlineAt: T + 3600 * 4,
};
const base = (over: Partial<ResolveInput>): ResolveInput => ({
  event: bus, now: T + 600, feed: { feedId: "toei", lastOkAt: T + 590 }, staleAfterSec: 180,
  delays: [], weather: [], ...over,
});
const obs = (o: Partial<{ observedAt: number; delaySec: number; tripId: string; stopId: string; feedId: string; predictedAt: number }> = {}) => ({
  feedId: "toei", tripId: "t1", stopId: "s1", routeId: "r", observedAt: T + 30, delaySec: 200, ...o,
});

describe("bus delay resolution", () => {
  it("stays pending before the target time", () => {
    expect(resolveEvent(base({ now: T - 1 }))).toEqual({ status: "pending" });
  });
  it("is yes when delay is strictly above the threshold", () => {
    const r = resolveEvent(base({ delays: [obs({ delaySec: 181 })] }));
    expect(r).toMatchObject({ status: "resolved", outcome: "yes" });
  });
  it("is no when delay equals the threshold", () => {
    const r = resolveEvent(base({ delays: [obs({ delaySec: 180 })] }));
    expect(r).toMatchObject({ status: "resolved", outcome: "no" });
  });
  it("uses the first reading at the stop, not later ones", () => {
    const r = resolveEvent(base({ delays: [obs({ observedAt: T + 400, delaySec: 900 }), obs({ observedAt: T + 20, delaySec: 60 })] }));
    expect(r).toMatchObject({ outcome: "no", evidence: { delaySec: 60 } });
  });
  it("ignores readings for other trips, stops, feeds or outside the window", () => {
    const delays = [obs({ tripId: "x" }), obs({ stopId: "x" }), obs({ feedId: "x" }), obs({ observedAt: T - 3600 }), obs({ observedAt: T + 5000 })];
    expect(resolveEvent(base({ delays }))).toEqual({ status: "pending" });
  });
  it("stays pending without data before the deadline", () => {
    expect(resolveEvent(base({ now: T + 1700 }))).toEqual({ status: "pending" });
  });
  it("voids with no_observation when the feed was healthy but the trip never showed", () => {
    const r = resolveEvent(base({ now: T + 2000, feed: { feedId: "toei", lastOkAt: T + 1990 } }));
    expect(r).toEqual({ status: "void", reason: "no_observation" });
  });
  it("voids with feed_down when the feed died", () => {
    const r = resolveEvent(base({ now: T + 2000, feed: { feedId: "toei", lastOkAt: T - 5000 } }));
    expect(r).toEqual({ status: "void", reason: "feed_down" });
  });
  it("voids with feed_down when the feed never worked", () => {
    expect(resolveEvent(base({ now: T + 2000, feed: { feedId: "toei", lastOkAt: null } }))).toEqual({ status: "void", reason: "feed_down" });
  });
  it("voids on non-finite data instead of guessing", () => {
    const r = resolveEvent(base({ delays: [obs({ delaySec: Number.NaN })] }));
    expect(r).toEqual({ status: "void", reason: "implausible_data" });
  });
});

describe("rain resolution", () => {
  const w = (mm: number, hourStart = T) => ({ feedId: "om", hourStart, precipitationMm: mm });
  const input = (over: Partial<ResolveInput>) =>
    base({ event: rain, now: T + 3600 + 60, feed: { feedId: "om", lastOkAt: T + 3600 }, staleAfterSec: 10800, ...over });
  it("waits for the observed hour to end", () => {
    expect(resolveEvent(input({ now: T + 1300, weather: [w(2)] }))).toEqual({ status: "pending" });
  });
  it("yes at or above the minimum", () => {
    expect(resolveEvent(input({ weather: [w(0.1)] }))).toMatchObject({ outcome: "yes" });
  });
  it("no below the minimum", () => {
    expect(resolveEvent(input({ weather: [w(0.0)] }))).toMatchObject({ outcome: "no" });
  });
  it("uses the hour containing the target only", () => {
    expect(resolveEvent(input({ weather: [w(5, T + 3600)] }))).toEqual({ status: "pending" });
  });
  it("voids after the deadline when the weather feed is down", () => {
    const r = input({ now: T + 3600 * 5, feed: { feedId: "om", lastOkAt: T - 86400 } });
    expect(resolveEvent(r)).toEqual({ status: "void", reason: "feed_down" });
  });
  it("voids on negative precipitation", () => {
    expect(resolveEvent(input({ weather: [w(-1)] }))).toEqual({ status: "void", reason: "implausible_data" });
  });
});

describe("train delays use the same rules", () => {
  it("resolves a train_delay_gt event", () => {
    const train = { ...bus, kind: "train_delay_gt" as const, category: "train" as const, thresholdSec: 300 };
    const r = resolveEvent(base({ event: train, delays: [obs({ delaySec: 301 })] }));
    expect(r).toMatchObject({ status: "resolved", outcome: "yes" });
  });
});

describe("forecasts are not facts", () => {
  const forecast = (observedAt: number, delaySec: number) => obs({ observedAt, delaySec, predictedAt: T + 100 });
  it("ignores a forecast made long before the predicted passage", () => {
    expect(resolveEvent(base({ delays: [forecast(T - 200, 900)] }))).toEqual({ status: "pending" });
  });
  it("accepts the forecast refreshed close to the predicted passage", () => {
    const r = resolveEvent(base({ delays: [forecast(T - 200, 900), forecast(T + 20, 250)] }));
    expect(r).toMatchObject({ status: "resolved", outcome: "yes", evidence: { delaySec: 250 } });
  });
  it("voids at the deadline if only early forecasts exist", () => {
    const r = resolveEvent(base({ now: T + 2000, delays: [forecast(T - 200, 900)], feed: { feedId: "toei", lastOkAt: T + 1990 } }));
    expect(r).toEqual({ status: "void", reason: "no_observation" });
  });
});
