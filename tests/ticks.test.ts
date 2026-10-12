import { describe, expect, it } from "vitest";
import { buildCryptoMarkets, buildKpMarkets, buildWikiMarkets } from "../shared/ticks.ts";
import { marketToEvent } from "../shared/market.ts";
import { resolveEvent as resolve } from "../shared/resolve.ts";

const NOW = Date.UTC(2026, 9, 12, 8, 0, 0) / 1000;

describe("tick markets", () => {
  it("offers crypto questions at 6-hour UTC boundaries with sane odds", () => {
    const m = buildCryptoMarkets({ btc: 83_700 }, NOW);
    expect(m.length).toBeGreaterThan(3);
    for (const x of m) { expect(x.odds_yes).toBeGreaterThanOrEqual(1.1); expect((Date.parse(x.target_at) / 1000) % (6 * 3600)).toBe(0); }
  });
  it("offers Kp questions only when activity is forecast", () => {
    expect(buildKpMarkets(new Map([[NOW + 6 * 3600, 2]]), NOW)).toHaveLength(0);
    expect(buildKpMarkets(new Map([[NOW + 6 * 3600, 5]]), NOW).length).toBe(2);
  });
  it("offers daily page-view questions", () => {
    expect(buildWikiMarkets({ Taylor_Swift: 52_000 }, NOW).length).toBeGreaterThan(0);
  });
});

describe("tick resolution", () => {
  const [m] = buildCryptoMarkets({ btc: 83_700 }, NOW);
  const ev = marketToEvent({ ...m!, id: "x" } as never);
  const base = { event: ev, feed: { feedId: ev.feedId, lastOkAt: NOW }, staleAfterSec: 7200, delays: [], weather: [] };
  it("settles from a reading taken right after the instant", () => {
    const r = resolve({ ...base, now: ev.targetAt + 300, ticks: [{ series: "btc", at: ev.targetAt, value: 1e6, fetchedAt: ev.targetAt + 60 }] });
    expect(r).toMatchObject({ status: "resolved", outcome: "yes" });
  });
  it("ignores a price read long after the instant, then voids", () => {
    const r = resolve({ ...base, now: ev.deadlineAt + 1, ticks: [{ series: "btc", at: ev.targetAt, value: 1e6, fetchedAt: ev.targetAt + 3000 }] });
    expect(r.status).toBe("void");
  });
});

import { buildStormMarkets } from "../shared/ticks.ts";
describe("storm markets", () => {
  it("offers wind steps near the current intensity, one and two days ahead", () => {
    const m = buildStormMarkets([{ id: "ep202026", name: "Simon", kt: 100, cls: "HU" }], NOW);
    expect(m.length).toBeGreaterThan(1);
    for (const x of m) { expect(x.params.series).toBe("storm:ep202026"); expect(x.odds_yes).toBeGreaterThanOrEqual(1.1); expect(x.params.note).toBeTruthy(); }
  });
  it("ignores weak disturbances", () => { expect(buildStormMarkets([{ id: "al012026", name: "One", kt: 10, cls: "TD" }], NOW)).toHaveLength(0); });
  it("a storm that left the list settles as 0 kt", () => {
    const [m] = buildStormMarkets([{ id: "ep202026", name: "Simon", kt: 100, cls: "HU" }], NOW);
    const ev = marketToEvent({ ...m!, id: "s" } as never);
    const r = resolve({ event: ev, now: ev.targetAt + 120, feed: { feedId: ev.feedId, lastOkAt: ev.targetAt }, staleAfterSec: 7200, delays: [], weather: [], ticks: [{ series: "storm:ep202026", at: ev.targetAt, value: 0, fetchedAt: ev.targetAt + 60 }] });
    expect(r).toMatchObject({ status: "resolved", outcome: "no" });
  });
});
