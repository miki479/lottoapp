import { describe, expect, it } from "vitest";
import { expectedDelay, liveYesProbability } from "../shared/odds.ts";
import { buildBoard, toneOf, trendOf, type StopRow } from "../shared/tripstops.ts";
import { createTtlCache } from "../web/src/lib/ttlCache.ts";

// Eight stops, five minutes apart, from 10:00.
const T0 = Date.parse("2026-10-13T10:00:00Z");
const MIN = 60_000;

function trip(over: Partial<StopRow>[] = [], n = 8, now: Partial<StopRow> = {}): StopRow[] {
  return Array.from({ length: n }, (_, i) => ({
    seq: i + 1, stop_id: `S${i + 1}`, name: `Stop ${i + 1}`, sched_at: new Date(T0 + i * 5 * MIN).toISOString(),
    delay_sec: null, seen_at: null, is_forecast: null, is_current: false, is_market: false, is_cancelled: false,
    now_delay_sec: null, now_at: null, now_forecast: null, prev_delay_sec: null,
    ...now, ...(over[i] ?? {}),
  }));
}

describe("trend of the delay", () => {
  it("is worse / better from a minute of change on, steady below it", () => {
    expect(trendOf(420, 300)).toBe("worse");
    expect(trendOf(300, 420)).toBe("better");
    expect(trendOf(300, 300)).toBe("steady");
    expect(trendOf(330, 300)).toBe("steady");
    expect(trendOf(359, 300)).toBe("steady");
    expect(trendOf(360, 300)).toBe("worse");
    expect(trendOf(240, 300)).toBe("better");
    expect(trendOf(241, 300)).toBe("steady");
  });
  it("says nothing without a reading to compare with", () => {
    expect(trendOf(300, null)).toBeNull();
    expect(trendOf(300, undefined)).toBeNull();
    expect(trendOf(null, 300)).toBeNull();
    expect(trendOf(300, Number.NaN)).toBeNull();
  });
  it("counts lateness only: early is as good as on time", () => {
    expect(trendOf(-180, -60)).toBe("steady");
    expect(trendOf(-60, 0)).toBe("steady");
    expect(trendOf(-120, 120)).toBe("better");
    expect(trendOf(120, -300)).toBe("worse");
  });
});

describe("tone of a figure", () => {
  it("is green when punctual or early, amber when late but under the line, orange past it", () => {
    expect(toneOf(null, 300)).toBeNull();
    expect(toneOf(-120, 300)).toBe("ok");
    expect(toneOf(0, 300)).toBe("ok");
    expect(toneOf(59, 300)).toBe("ok");
    expect(toneOf(60, 300)).toBe("late");
    expect(toneOf(300, 300)).toBe("late"); // the question is "more than 300 s"
    expect(toneOf(301, 300)).toBe("over");
  });
});

describe("recovery assumption", () => {
  it("is the one that prices the live questions: the delay it expects is where the chance of being later turns from likely to unlikely", () => {
    const rush = { hour: 8, weekday: true }, night = { hour: 23, weekday: true };
    for (const train of [true, false]) for (const ctx of [undefined, rush, night]) for (const [delay, n] of [[600, 1], [300, 2], [900, 1], [180, 3]] as const) {
      const mean = expectedDelay(delay, n, train, ctx), why = `${train ? "train" : "bus"} ${delay}s ${n} stops ${JSON.stringify(ctx)}`;
      const chance = (thr: number) => liveYesProbability(0.5, delay, thr, n, train, ctx);
      // a line half a second under the expected delay is a toss-up; a few minutes over it is unlikely, a few minutes under it likely
      expect(chance(mean - 0.5), why).toBeGreaterThan(0.3);
      expect(chance(mean - 0.5), why).toBeLessThan(0.6);
      expect(chance(mean + 300), why).toBeLessThan(0.25);
      expect(chance(Math.max(0, mean - 300) - 0.5), why).toBeGreaterThan(chance(mean - 0.5) - 0.01);
    }
  });
  it("lets a late service win back a few seconds per stop, a train fewer than a bus, and leaves a punctual one alone", () => {
    expect(expectedDelay(600, 4, true)).toBe(576);
    expect(expectedDelay(600, 4, false)).toBe(560);
    expect(expectedDelay(0, 9, true)).toBe(0);
    expect(expectedDelay(-90, 9, false)).toBe(-90);
    expect(expectedDelay(30, 20, false)).toBe(0); // never recovers into the negative
  });
});

describe("board of a trip with a measured position (position feeds, trains with every reached stop)", () => {
  // the vehicle has been through stops 1-4; +5 min at the last one
  const rows = trip([
    { delay_sec: 120, is_forecast: false }, { delay_sec: 180, is_forecast: false }, { delay_sec: 240, is_forecast: false },
    { delay_sec: 300, is_forecast: false, is_current: true },
    {}, {}, { is_market: true }, {},
  ], 8, { now_delay_sec: 330, now_at: new Date(T0 + 17 * MIN).toISOString(), now_forecast: false, prev_delay_sec: 120 });

  it("marks reached stops as measured and the last one as the current position", () => {
    const b = buildBoard(rows, { nowMs: T0 + 18 * MIN, train: false });
    expect(b.currentIdx).toBe(3);
    expect(b.currentEstimated).toBe(false);
    expect(b.stops.slice(0, 4).map((s) => [s.cell, s.phase])).toEqual([["actual", "done"], ["actual", "done"], ["actual", "done"], ["actual", "current"]]);
    expect(b.stops[3]!.delaySec).toBe(300);
    expect(b.stops[3]!.atMs).toBe(T0 + 15 * MIN + 300_000);
  });
  it("predicts the stops ahead from the last measured one with the recovery of the model, and says so", () => {
    const b = buildBoard(rows, { nowMs: T0 + 18 * MIN, train: false });
    const ahead = b.stops.slice(4);
    expect(ahead.every((s) => s.cell === "predicted" && s.phase === "ahead")).toBe(true);
    expect(ahead.map((s) => s.delaySec)).toEqual([1, 2, 3, 4].map((n) => Math.round(expectedDelay(300, n, false))));
    expect(ahead[0]!.delaySec).toBe(290); // a bus: 10 s per stop
    expect(ahead[0]!.atMs).toBe(T0 + 20 * MIN + 290_000);
    expect(ahead[2]!.market).toBe(true);
  });
  it("recovers more slowly for a train", () => {
    const b = buildBoard(rows, { nowMs: T0 + 18 * MIN, train: true });
    expect(b.stops[4]!.delaySec).toBe(294);
    expect(b.stops[7]!.delaySec).toBe(276);
  });
  it("takes the rush hour into account", () => {
    const calm = buildBoard(rows, { nowMs: T0, train: true }), rush = buildBoard(rows, { nowMs: T0, train: true, ctx: { hour: 8, weekday: true } });
    expect(rush.stops[7]!.delaySec!).toBeGreaterThan(calm.stops[7]!.delaySec!);
  });
  it("asks for the rush hour at the time of each stop", () => {
    // the first stops ahead are outside the rush hour, the later ones inside it
    const seen: number[] = [];
    const b = buildBoard(rows, { nowMs: T0, train: true, ctxAt: (ms) => { seen.push(ms); return ms >= T0 + 30 * MIN ? { hour: 8, weekday: true } : { hour: 12, weekday: true }; } });
    expect(seen).toEqual(rows.slice(4).map((r) => Date.parse(r.sched_at)));
    const calm = buildBoard(rows, { nowMs: T0, train: true });
    expect(b.stops[4]!.delaySec).toBe(calm.stops[4]!.delaySec); // 10:20: still calm
    expect(b.stops[7]!.delaySec!).toBeGreaterThan(calm.stops[7]!.delaySec!); // 10:35: in the rush
  });
  it("gives the delay of the moment with its trend", () => {
    const b = buildBoard(rows, { nowMs: T0 + 18 * MIN, train: false });
    expect(b.live).toEqual({ delaySec: 330, atMs: T0 + 17 * MIN, forecast: false, trend: "worse" });
  });
  it("falls back to the app's previous reading when the database has none", () => {
    const bare = rows.map((r) => ({ ...r, prev_delay_sec: null }));
    expect(buildBoard(bare, { nowMs: T0, train: false }).live!.trend).toBeNull();
    expect(buildBoard(bare, { nowMs: T0, train: false, fallbackPrevSec: 500 }).live!.trend).toBe("better");
  });
});

describe("board of a trip known only by the operator's forecast for the question's stop", () => {
  // stop 5 is forecast +3 min; nothing was measured
  const rows = trip([{}, {}, {}, {}, { delay_sec: 180, is_forecast: true, is_market: true }], 8, { now_delay_sec: 180, now_at: new Date(T0 + 12 * MIN).toISOString(), now_forecast: true });

  it("works out where the vehicle is from the clock and says it is an estimate", () => {
    const b = buildBoard(rows, { nowMs: T0 + 11 * MIN, train: false });
    // 10:11 now: stop 3 was due 10:10 (+3 min = 10:13), stop 2 at 10:05 (+3 = 10:08): the vehicle is past stop 2
    expect(b.currentEstimated).toBe(true);
    expect(b.currentIdx).toBe(1);
    expect(b.live?.forecast).toBe(true);
  });
  it("shows the forecast as such, the stops before it as that same delay and the ones after with the recovery", () => {
    const b = buildBoard(rows, { nowMs: T0 + 11 * MIN, train: false });
    expect(b.stops[4]).toMatchObject({ cell: "forecast", delaySec: 180, market: true });
    expect(b.stops.slice(1, 4).map((s) => [s.cell, s.delaySec])).toEqual([["predicted", 180], ["predicted", 180], ["predicted", 180]]);
    expect(b.stops.slice(5).map((s) => s.delaySec)).toEqual([170, 160, 150]);
    expect(b.stops[0]).toMatchObject({ cell: "none", phase: "done" }); // already passed, nothing was read there
  });
  it("estimates nothing before the trip starts", () => {
    const b = buildBoard(rows, { nowMs: T0 - 60 * MIN, train: false });
    expect(b.currentIdx).toBe(-1);
    expect(b.stops.every((s) => s.phase === "ahead")).toBe(true);
  });
});

describe("board with no data", () => {
  it("lists the stops with their scheduled time and nothing else", () => {
    const b = buildBoard(trip(), { nowMs: T0 + 12 * MIN, train: true });
    expect(b.stops).toHaveLength(8);
    expect(b.live).toBeNull();
    expect(b.currentIdx).toBe(-1);
    expect(b.stops.every((s) => s.cell === "none" && s.delaySec === null && s.atMs === null)).toBe(true);
    expect(b.stops[2]!.schedMs).toBe(T0 + 10 * MIN);
  });
  it("sorts the stops by sequence and survives an empty list", () => {
    const rows = trip().reverse();
    expect(buildBoard(rows, { nowMs: T0, train: true }).stops.map((s) => s.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(buildBoard([], { nowMs: T0, train: true })).toEqual({ stops: [], currentIdx: -1, currentEstimated: false, live: null });
  });
});

describe("cancelled stops", () => {
  it("get no figure and do not count as a stop of recovery", () => {
    const rows = trip([{ delay_sec: 300, is_forecast: false, is_current: true }, { is_cancelled: true }, { is_cancelled: true }, {}]);
    const b = buildBoard(rows, { nowMs: T0, train: false });
    expect(b.stops[1]).toMatchObject({ cell: "none", cancelled: true });
    expect(b.stops[2]).toMatchObject({ cell: "none", cancelled: true });
    // stop 4 is one stop after stop 1, the two cancelled ones in between are not served
    expect(b.stops[3]!.delaySec).toBe(290);
    expect(b.stops[4]!.delaySec).toBe(280);
  });
});

describe("short-lived cache", () => {
  it("serves the same answer for 30 seconds and asks again after", async () => {
    let t = 1000, calls = 0;
    const cache = createTtlCache(30_000, async (k: string) => { calls++; return `${k}#${calls}`; }, () => t);
    expect(await cache.get("a")).toBe("a#1");
    t += 29_999;
    expect(await cache.get("a")).toBe("a#1");
    t += 1;
    expect(await cache.get("a")).toBe("a#2");
    expect(await cache.get("b")).toBe("b#3");
    expect(calls).toBe(3);
  });
  it("shares one request between callers that ask at the same time, and can be forced", async () => {
    let calls = 0;
    const cache = createTtlCache(30_000, async (k: string) => { calls++; await Promise.resolve(); return `${k}${calls}`; }, () => 0);
    const [x, y] = await Promise.all([cache.get("a"), cache.get("a")]);
    expect(x).toBe(y);
    expect(calls).toBe(1);
    expect(await cache.get("a", true)).toBe("a2");
  });
  it("does not remember a failure", async () => {
    let calls = 0;
    const cache = createTtlCache(30_000, async () => { calls++; if (calls === 1) throw new Error("down"); return "ok"; }, () => 0);
    await expect(cache.get("a")).rejects.toThrow("down");
    expect(await cache.get("a")).toBe("ok");
  });
  it("peeks at what it holds without asking", async () => {
    let t = 0;
    const cache = createTtlCache(30_000, async (k: string) => k.toUpperCase(), () => t);
    expect(cache.peek("a")).toBeUndefined();
    await cache.get("a");
    expect(cache.peek("a")).toBe("A");
    t = 31_000;
    expect(cache.peek("a")).toBeUndefined();
  });
});
