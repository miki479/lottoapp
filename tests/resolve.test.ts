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
const obs = (o: Partial<{ observedAt: number; delaySec: number; tripId: string; stopId: string; feedId: string; predictedAt: number; stopSequence: number }> = {}) => ({
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

describe("position feeds that skip a stop between samples", () => {
  const ev = { ...bus, stopSequence: 5 };
  const pos = (seq: number, observedAt: number, delaySec: number) => obs({ stopId: `s${seq}`, stopSequence: seq, observedAt, delaySec });
  const run = (delays: ReturnType<typeof pos>[]) => resolveEvent(base({ event: ev, delays }));
  it("accepts a reading one or two stops after the event's stop", () => {
    expect(run([pos(6, T + 40, 250)])).toMatchObject({ status: "resolved", outcome: "yes" });
    expect(run([pos(7, T + 90, 100)])).toMatchObject({ status: "resolved", outcome: "no" });
  });
  it("prefers the stop closest to the question", () => {
    expect(run([pos(7, T + 30, 900), pos(6, T + 60, 20)])).toMatchObject({ outcome: "no", evidence: { delaySec: 20 } });
  });
  it("does not use readings from before the stop or too many stops after", () => {
    expect(run([pos(4, T + 10, 900), pos(8, T + 100, 900)])).toEqual({ status: "pending" });
  });
  it("still matches by stop id when there is no sequence (trip updates)", () => {
    expect(resolveEvent(base({ event: ev, delays: [obs({ delaySec: 200 })] }))).toMatchObject({ outcome: "yes" });
  });
});

import { buildMetricMarkets, metricOdds, thresholdFor, normalCdf } from "../shared/metrics.ts";

describe("metric and quake events", () => {
  const base = { id: "m", cityId: "tokyo", feedId: "om-tokyo", closesAt: 0, deadlineAt: 10 * 3600 };
  const feed = { feedId: "om-tokyo", lastOkAt: 100_000 };
  const ev = { ...base, kind: "metric_gt" as const, category: "weather" as const, metric: "temp" as const, threshold: 20, targetAt: 1800 };
  it("settles on a reading fetched after its hour ended", () => {
    const r = resolveEvent({ event: ev, now: 5000, feed, staleAfterSec: 99999, delays: [], weather: [], metrics: [{ feedId: "om-tokyo", metric: "temp", hourStart: 0, value: 21, fetchedAt: 4000 }] });
    expect(r).toMatchObject({ status: "resolved", outcome: "yes" });
  });
  it("does not settle on a value fetched while the hour was still running", () => {
    const r = resolveEvent({ event: ev, now: 5000, feed, staleAfterSec: 99999, delays: [], weather: [], metrics: [{ feedId: "om-tokyo", metric: "temp", hourStart: 0, value: 25, fetchedAt: 1000 }] });
    expect(r.status).toBe("pending");
  });
  it("voids implausible values after the deadline path", () => {
    const r = resolveEvent({ event: ev, now: 5000, feed, staleAfterSec: 99999, delays: [], weather: [], metrics: [{ feedId: "om-tokyo", metric: "temp", hourStart: 0, value: 999, fetchedAt: 4000 }] });
    expect(r).toMatchObject({ status: "void", reason: "implausible_data" });
  });
  const q = { ...base, feedId: "usgs", kind: "quake_m" as const, category: "nature" as const, minMag: 5, targetAt: 21600 };
  it("quake: waits for USGS to settle, then counts events", () => {
    expect(resolveEvent({ event: q, now: 21700, feed, staleAfterSec: 1, delays: [], weather: [], quake: { count: 2, maxMag: 5.4 } }).status).toBe("pending");
    expect(resolveEvent({ event: q, now: 21600 + 1900, feed, staleAfterSec: 1, delays: [], weather: [], quake: { count: 0, maxMag: null } })).toMatchObject({ status: "resolved", outcome: "no" });
    expect(resolveEvent({ event: q, now: 21600 + 1900, feed, staleAfterSec: 1, delays: [], weather: [], quake: { count: 1, maxMag: 5.2 } })).toMatchObject({ status: "resolved", outcome: "yes" });
  });
  it("quake: unreadable USGS is pending, then void after the deadline", () => {
    expect(resolveEvent({ event: q, now: 21600 + 1900, feed, staleAfterSec: 1, delays: [], weather: [], quake: null }).status).toBe("pending");
    expect(resolveEvent({ event: q, now: 10 * 3600 + 1, feed, staleAfterSec: 1, delays: [], weather: [], quake: null }).status).toBe("void");
  });
  it("pricing: a threshold at the forecast is a near coin flip; higher thresholds pay more", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 2);
    expect(thresholdFor("temp", 17.4)).toBe(17);
    const fair = metricOdds("temp", 17, 17), high = metricOdds("temp", 17, 21);
    expect(fair.pYes).toBeCloseTo(0.5, 1);
    expect(high.yes).toBeGreaterThan(fair.yes);
  });
  it("builds at most one market per metric per day and skips useless ones", () => {
    const now = Date.UTC(2026, 5, 1, 0, 0) / 1000;
    const series = (v: number) => new Map(Array.from({ length: 96 }, (_, i) => [Math.floor(now / 3600) * 3600 + i * 3600, v]));
    const out = buildMetricMarkets({ id: "x", tz: "UTC", nowEpoch: now, series: { temp: series(18), uv: series(0.5), snow: series(0), wind: series(30) } });
    expect(out.filter((m) => m.params.metric === "temp")).toHaveLength(2);
    expect(out.some((m) => m.params.metric === "uv" || m.params.metric === "snow")).toBe(false);
    expect(out.filter((m) => m.params.metric === "wind")).toHaveLength(2);
  });
});

import { buildStrikeMarkets, parseStrikeRss } from "../shared/strikes.ts";
describe("strikes", () => {
  const xml = `<rss><channel><item><title>Data inizio: 04/12/2026 - Settore: Generale - Rilevanza: Nazionale - Regione:  Italia - Provincia: Tutte</title><description><![CDATA[modalità: 24 ORE<br/>Data fine: 04/12/2026<br/>Settore: Generale<br/>Rilevanza: Nazionale<br/>Regione:  Italia<br/>Sindacati: CUB<br/>Categoria interessata: TUTTI I SETTORI]]></description><guid>http://scioperi.mit.gov.it/8600</guid></item><item><title>Data inizio: 12/10/2026 - Settore: Trasporto pubblico locale - Rilevanza: Locale - Regione: Puglia</title><description><![CDATA[Settore: Trasporto pubblico locale<br/>Rilevanza: Locale]]></description><guid>http://scioperi.mit.gov.it/8568</guid></item></channel></rss>`;
  it("parses the ministry feed and offers only national train strikes", () => {
    const s = parseStrikeRss(xml);
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ date: "2026-12-04", sector: "Generale", scope: "Nazionale", unions: "CUB" });
    const now = Date.UTC(2026, 9, 12) / 1000;
    const m = buildStrikeMarkets(s, now);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ kind: "strike_on", dedupe_key: "mit|http://scioperi.mit.gov.it/8600|2026-12-04" });
    expect(Date.parse(m[0]!.closes_at)).toBeLessThan(Date.parse(m[0]!.target_at));
  });
  it("garbage feed yields nothing; strikes too soon or too far are skipped", () => {
    expect(parseStrikeRss("<html>blocked</html>")).toEqual([]);
    expect(buildStrikeMarkets(parseStrikeRss(xml), Date.UTC(2026, 11, 3) / 1000)).toEqual([]);
  });
  const ev = { id: "s", cityId: "rome", feedId: "mit-scioperi", closesAt: 0, targetAt: 100, deadlineAt: 50000, kind: "strike_on" as const, category: "strike" as const, guid: "g", date: "2026-12-04" };
  const feed = { feedId: "mit-scioperi", lastOkAt: 100 };
  it("resolves yes if still listed, no if gone, pending if the list is unreadable", () => {
    expect(resolveEvent({ event: ev, now: 200, feed, staleAfterSec: 9999, delays: [], weather: [], strike: { present: true } })).toMatchObject({ status: "resolved", outcome: "yes" });
    expect(resolveEvent({ event: ev, now: 200, feed, staleAfterSec: 9999, delays: [], weather: [], strike: { present: false } })).toMatchObject({ status: "resolved", outcome: "no" });
    expect(resolveEvent({ event: ev, now: 200, feed, staleAfterSec: 9999, delays: [], weather: [], strike: null }).status).toBe("pending");
  });
});
