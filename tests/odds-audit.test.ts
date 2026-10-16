import { describe, expect, it } from "vitest";
import { MAX_ODDS, MIN_ODDS, computeOdds, historyAtThreshold, liveYesProbability, type DelayContext } from "../shared/odds.ts";
import { FUN_STAKE, stakeCap } from "../shared/wallet.ts";
import { buildSteamMarkets, diurnalRatio, buildCryptoMarkets, buildCustomTick, buildFxMarkets, buildNwsMarkets, buildStormMarkets, buildTicketMarkets, tickAbove, tickChance, tickDef, tickGrain, tickInclusive, tickSigma, tickYes } from "../shared/ticks.ts";
import { METRIC_IDS, metricOdds } from "../shared/metrics.ts";
import { ALL_BETS, evalBet, evalMatch, matchMarket, matchPriors, twoWayPriors, LEAGUES, type Fixture, type MatchBet } from "../shared/sport.ts";
import { marketToEvent } from "../shared/market.ts";
import { resolveEvent } from "../shared/resolve.ts";

const range = (a: number, b: number, step: number) => { const o: number[] = []; for (let x = a; x <= b + 1e-9; x += step) o.push(x); return o; };

describe("computeOdds", () => {
  it("is bounded, symmetric, monotone and keeps a margin over the whole range", () => {
    let prevYes = Infinity, prevNo = 0;
    for (const p of range(0.001, 0.999, 0.001)) {
      const o = computeOdds(p), mirror = computeOdds(1 - p);
      for (const x of [o.yes, o.no]) { expect(x).toBeGreaterThanOrEqual(MIN_ODDS); expect(x).toBeLessThanOrEqual(MAX_ODDS); }
      expect(o.yes).toBeLessThanOrEqual(prevYes + 1e-9); expect(o.no).toBeGreaterThanOrEqual(prevNo - 1e-9);
      expect(o.yes).toBeCloseTo(mirror.no, 1);
      // never a pair that locks in a profit, and a real margin except where a side is pinned at the floor or the cap
      expect(1 / o.yes + 1 / o.no).toBeGreaterThan(1.05);
      prevYes = o.yes; prevNo = o.no;
    }
  });
  it("margin is the stated 8% where nothing is clamped", () => {
    for (const p of range(0.1, 0.9, 0.05)) { const o = computeOdds(p); expect(1 / o.yes + 1 / o.no).toBeGreaterThan(1.07); expect(1 / o.yes + 1 / o.no).toBeLessThan(1.1); }
  });
  it("a side that is all but certain is not bettable (below the stake-cap floor)", () => {
    expect(stakeCap(computeOdds(0.97).yes)).toBe(FUN_STAKE);
    expect(stakeCap(computeOdds(0.03).no)).toBe(FUN_STAKE);
    expect(stakeCap(computeOdds(0.9).yes)).toBe(FUN_STAKE);
  });
});

describe("live delay pricing", () => {
  const ctxs: (DelayContext | undefined)[] = [undefined, { hour: 8, weekday: true }, { hour: 23, weekday: true }, { hour: 12, weekday: false }];
  const hists = [0.03, 0.06, 0.27, 0.6];
  it("is non-increasing in the threshold, non-decreasing in the delay, and inside [0.03, 0.97]", () => {
    for (const train of [true, false]) for (const ctx of ctxs) for (const h of hists) for (const n of [0, 1, 3, 8, 15]) {
      for (const delay of [-120, -30, 0, 1, 45, 150, 299, 300, 301, 480, 900, 2400]) {
        let prev = 1;
        for (const thr of range(60, 3600, 90)) {
          const p = liveYesProbability(h, delay, thr, n, train, ctx);
          expect(p).toBeGreaterThanOrEqual(0.03); expect(p).toBeLessThanOrEqual(0.97);
          expect(p, `train=${train} h=${h} n=${n} delay=${delay} thr=${thr}`).toBeLessThanOrEqual(prev + 1e-9);
          prev = p;
        }
      }
      for (const thr of [180, 300, 600]) {
        let prev = 0;
        for (const delay of range(-300, 3000, 45)) {
          const p = liveYesProbability(h, delay, thr, n, train, ctx);
          expect(p, `train=${train} h=${h} n=${n} delay=${delay} thr=${thr}`).toBeGreaterThanOrEqual(prev - 1e-9);
          prev = p;
        }
      }
    }
  });
  it("a delay far past the line a few stops away cannot be backed at a profitable price (no ~1.01 free money, no 1.15 either)", () => {
    for (const ctx of ctxs) for (const h of hists) {
      for (const n of [0, 1, 2, 3, 5, 8, 10]) {
        const p = liveYesProbability(h, 300 + 900, 300, n, true, ctx);
        expect(computeOdds(p).yes, `train n=${n} h=${h}`).toBeLessThan(1.1);
      }
      for (const n of [0, 1, 2, 3, 5]) {
        const p = liveYesProbability(h, 180 + 900, 180, n, false, ctx);
        expect(computeOdds(p).yes, `bus n=${n} h=${h}`).toBeLessThan(1.1);
      }
    }
  });
  it("a service well on time a few stops away has its Yes at a long price but its No cannot be staked", () => {
    for (const h of hists.filter((x) => x <= 0.3)) for (const n of [0, 1, 2, 3, 5, 8]) {
      const o = computeOdds(liveYesProbability(h, -60, 300, n, true));
      expect(stakeCap(o.no), `n=${n} h=${h}`).toBe(FUN_STAKE);
    }
  });
  it("a higher line (apology ladder) is priced from its own thinner tail, not from the standard line's history", () => {
    expect(historyAtThreshold(0.27, 300, true)).toBeCloseTo(0.27);
    expect(historyAtThreshold(0.27, 2820, true)).toBeLessThan(0.01);
    const far = liveYesProbability(0.27, 180, 2820, 16, true);
    expect(far).toBeLessThan(0.05);
    expect(liveYesProbability(0.27, 360, 660, 4, true)).toBeGreaterThan(far);
  });
  it("rush hour does not jump when a service goes from on time to one second late", () => {
    const rush = { hour: 8, weekday: true };
    expect(Math.abs(liveYesProbability(0.06, 1, 300, 10, true, rush) - liveYesProbability(0.06, 0, 300, 10, true, rush))).toBeLessThan(0.02);
  });
});

describe("tick pricing", () => {
  const SERIES: [string, number][] = [
    ["btc", 83_700], ["eth", 3200], ["metal:xau", 4100], ["metal:hg", 5.1], ["fx:usd", 1.163], ["fx:jpy", 172.4], ["fx:chf", 0.93], ["carbon:gb", 140], ["nws:us", 600], ["feargreed", 48],
    ["power:it", 110], ["tide:nyc", 0.7], ["river:koeln", 180], ["fuel:benzina", 1.745], ["oil:brent", 82], ["steam:730", 1_400_000], ["lastfm:drake", 40_000_000], ["bikes:nyc", 24_000],
    ["tm:it", 900], ["tv:123", 7.8], ["kp", 4], ["storm:x", 70], ["wiki:Netflix", 90_000],
  ];
  it("every series: chance non-increasing in the threshold, odds inside the bounds, no profit-locking pair", () => {
    for (const [series, ref] of SERIES) {
      const def = tickDef(series)!;
      expect(def, series).toBeTruthy();
      for (const hours of [1, 6, 24, 72]) {
        const sigma = tickSigma(series, ref, hours);
        expect(sigma, series).toBeGreaterThan(0);
        let prevP = 1, prevYes = 0, prevNo = Infinity;
        for (let k = -40; k <= 40; k++) {
          const thr = ref + (k / 10) * sigma;
          const p = tickAbove(series, ref, thr, sigma);
          expect(p, `${series} ${hours}h k=${k}`).toBeLessThanOrEqual(prevP + 1e-9);
          const m = buildCustomTick(series, ref, thr, 1_800_000_000 + hours * 3600, 1_800_000_000);
          for (const x of [m.odds_yes, m.odds_no]) { expect(x).toBeGreaterThanOrEqual(MIN_ODDS); expect(x).toBeLessThanOrEqual(MAX_ODDS); }
          expect(m.odds_yes, `${series} ${hours}h k=${k}`).toBeGreaterThanOrEqual(prevYes - 1e-9);
          expect(m.odds_no).toBeLessThanOrEqual(prevNo + 1e-9);
          expect(1 / m.odds_yes + 1 / m.odds_no).toBeGreaterThan(1.05);
          prevP = p; prevYes = m.odds_yes; prevNo = m.odds_no;
        }
      }
    }
  });
  it("a number that can only take steps: counting the line on the right side (strict vs at-least)", () => {
    // whole-number series: "more than 100" is "at least 101", so the strict chance at T equals the at-least chance at T + 1
    for (const s of ["nws:us", "feargreed", "river:koeln", "carbon:gb", "bikes:nyc"]) {
      expect(tickInclusive(s)).toBe(false);
      for (const t of [50, 100, 101, 250]) expect(tickAbove(s, 100, t, 12)).toBeCloseTo(tickAbove("tm:it".replace("tm:it", s), 100, t, 12), 12);
    }
    expect(tickAbove("nws:us", 600, 600, 20)).toBeLessThan(0.5);      // P(X > 600) < half when X can be exactly 600
    expect(tickAbove("storm:x", 100, 100, 8)).toBeGreaterThan(0.5);   // 100 kt is in "at least 100"
    expect(tickAbove("tm:it", 100, 100, 1.2)).toBeGreaterThan(0.5);
    // kp moves in thirds: "reach 4" includes a reading of exactly 4.0
    expect(tickAbove("kp", 4, 4, 1)).toBeGreaterThan(0.55);
    // continuous series keep the plain normal chance
    expect(tickAbove("btc", 83_700, 83_700, 400)).toBeCloseTo(0.5, 6);
  });
  it("settlement on the line: 'above' is strict, 'at least' is inclusive, float noise does not decide", () => {
    expect(tickYes("feargreed", 45, 45)).toBe(false);
    expect(tickYes("feargreed", 46, 45)).toBe(true);
    expect(tickYes("nws:us", 600, 600)).toBe(false);
    expect(tickYes("fx:usd", 1.165, 1.1650000000000003)).toBe(false);
    expect(tickYes("fx:usd", 1.1651, 1.1650000000000003)).toBe(true);
    expect(tickYes("storm:x", 64, 64)).toBe(true);
    expect(tickYes("kp", 4, 4)).toBe(true);
    expect(tickYes("tm:it", 905, 905)).toBe(true);
    expect(tickYes("tv:5", 7.5, 7.5)).toBe(true);
    expect(tickYes("tv:5", 7.4, 7.5)).toBe(false);
    expect(tickGrain("btc")).toBe(0);
  });
  it("resolution uses the same rule and the line is stored without float noise", () => {
    const NOW = Date.UTC(2026, 9, 12, 8, 0, 0) / 1000;
    const fx = buildFxMarkets({ usd: { date: "2026-10-09", value: 1.165 } }, NOW);
    expect(fx.length).toBeGreaterThan(0);
    for (const m of fx) expect(String(m.params.threshold).length).toBeLessThan(9);
    const m = fx[0]!, ev = marketToEvent({ ...m, id: "x" } as never);
    const base = { event: ev, feed: { feedId: ev.feedId, lastOkAt: NOW }, staleAfterSec: 7200, delays: [], weather: [], now: ev.targetAt + 600 };
    const at = (v: number) => resolveEvent({ ...base, ticks: [{ series: "fx:usd", at: ev.targetAt, value: v, fetchedAt: ev.targetAt + 60 }] } as never) as { outcome?: string };
    expect(at(m.params.threshold).outcome).toBe("no");
    expect(at(m.params.threshold + 0.0001).outcome).toBe("yes");
  });
  it("crypto: the +2% question is always less likely (longer odds) than the one around today's price", () => {
    const NOW = Date.UTC(2026, 9, 12, 8, 0, 0) / 1000;
    const m = buildCryptoMarkets({ btc: 83_700, eth: 3200 }, NOW);
    const by = new Map<string, (typeof m)[number]>();
    for (const x of m) {
      const key = `${x.params.series}|${x.params.at}`, o = by.get(key);
      if (o) { const [lo, hi] = o.params.threshold < x.params.threshold ? [o, x] : [x, o]; expect(hi.odds_yes).toBeGreaterThanOrEqual(lo.odds_yes); expect(hi.odds_no).toBeLessThanOrEqual(lo.odds_no); }
      by.set(key, x);
    }
  });
  it("storm options and player questions are never offered when the outcome is all but decided", () => {
    const NOW = Date.UTC(2026, 9, 12, 8, 0, 0) / 1000;
    for (const m of buildStormMarkets([{ id: "a", name: "A", kt: 100, cls: "HU" }, { id: "b", name: "B", kt: 40, cls: "TS" }], NOW)) { expect(m.odds_yes).toBeGreaterThan(1.1); expect(m.odds_no).toBeGreaterThan(1.1); }
    for (const m of buildNwsMarkets(600, NOW)) { expect(m.odds_yes).toBeGreaterThan(1.1); expect(m.odds_no).toBeGreaterThan(1.1); }
    for (const m of buildTicketMarkets({ it: 900, milano: 120 }, NOW)) { expect(1 / m.odds_yes + 1 / m.odds_no).toBeGreaterThan(1.05); }
    expect(tickChance("btc", 83_700, 83_700 * 1.2, 6)).toBeLessThan(0.01);
  });
});

describe("weather metrics", () => {
  it("odds are monotone in the threshold for every metric", () => {
    for (const metric of METRIC_IDS) for (const fc of [0.2, 3, 12, 25, 60]) {
      let prev = 0;
      for (const thr of range(fc - 20, fc + 20, 0.5)) {
        const o = metricOdds(metric, fc, thr);
        expect(o.yes).toBeGreaterThanOrEqual(prev - 1e-9); prev = o.yes;
        expect(o.yes).toBeGreaterThanOrEqual(MIN_ODDS); expect(o.no).toBeLessThanOrEqual(MAX_ODDS);
        expect(1 / o.yes + 1 / o.no).toBeGreaterThan(1.05);
      }
    }
  });
});

describe("football and two-way sports", () => {
  const tables = (gf: number, ga: number, played = 10) => ({ team: "x", played, points: 0, goalsFor: gf, goalsAgainst: ga });
  const cases: [ReturnType<typeof tables> | undefined, ReturnType<typeof tables> | undefined][] = [
    [undefined, undefined], [tables(25, 8), tables(6, 22)], [tables(6, 22), tables(25, 8)], [tables(30, 30), tables(30, 30)], [tables(3, 3, 2), tables(20, 5, 12)], [tables(40, 40, 20), tables(8, 40, 20)],
  ];
  it("1X2 chances sum to one (before the clamp), goal lines and double chance are consistent", () => {
    for (const [h, a] of cases) for (const avg of [1.0, 1.3, 1.7]) {
      const p = matchPriors(h, a, avg, true);
      expect(p.home_win + p.draw + p.away_win).toBeGreaterThan(0.97); expect(p.home_win + p.draw + p.away_win).toBeLessThan(1.04);
      expect(p.over_1_5).toBeGreaterThanOrEqual(p.over_2_5); expect(p.over_2_5).toBeGreaterThanOrEqual(p.over_3_5);
      expect(p.dc_1x).toBeGreaterThanOrEqual(p.home_win); expect(p.dc_x2).toBeGreaterThanOrEqual(p.away_win); expect(p.dc_12).toBeGreaterThanOrEqual(Math.max(p.home_win, p.away_win));
      expect(p.btts).toBeLessThanOrEqual(Math.min(1 - p.home_clean + 0.01, 1 - p.away_clean + 0.01));
      expect(p.corners_8_5).toBeGreaterThanOrEqual(p.corners_9_5); expect(p.corners_9_5).toBeGreaterThanOrEqual(p.corners_10_5); expect(p.corners_10_5).toBeGreaterThanOrEqual(p.corners_11_5);
      expect(p.cards_3_5).toBeGreaterThanOrEqual(p.cards_4_5); expect(p.cards_4_5).toBeGreaterThanOrEqual(p.cards_5_5);
      for (const b of ALL_BETS) { expect(p[b]).toBeGreaterThanOrEqual(0.04); expect(p[b]).toBeLessThanOrEqual(0.96); }
    }
  });
  it("backing every outcome of a match (or both sides of any pair that covers everything) never locks in a profit", () => {
    const f: Fixture = { eventId: "1", league: "Serie A", home: "A", away: "B", kickoff: 2_000_000_000 };
    for (const [h, a] of cases) {
      const p = matchPriors(h, a, 1.3, true), q = (b: MatchBet) => 1 / matchMarket(f, b, p, undefined, false).odds_yes;
      expect(q("home_win") + q("draw") + q("away_win")).toBeGreaterThan(1.05);
      expect(q("dc_1x") + q("away_win")).toBeGreaterThan(1.05); expect(q("dc_x2") + q("home_win")).toBeGreaterThan(1.05); expect(q("dc_12") + q("draw")).toBeGreaterThan(1.05);
      expect(1 / matchMarket(f, "over_2_5", p, undefined, false).odds_yes + 1 / matchMarket(f, "over_2_5", p, undefined, false).odds_no).toBeGreaterThan(1.05);
    }
  });
  it("settlement of draws and exact lines", () => {
    expect(evalBet("draw", 1, 1)).toBe(true); expect(evalBet("home_win", 1, 1)).toBe(false); expect(evalBet("away_win", 1, 1)).toBe(false);
    expect(evalBet("dc_1x", 1, 1)).toBe(true); expect(evalBet("dc_x2", 1, 1)).toBe(true); expect(evalBet("dc_12", 1, 1)).toBe(false);
    expect(evalBet("over_2_5", 2, 0)).toBe(false); expect(evalBet("over_2_5", 2, 1)).toBe(true); expect(evalBet("over_1_5", 1, 1)).toBe(true);
    expect(evalBet("btts", 1, 0)).toBe(false); expect(evalBet("home_clean", 1, 0)).toBe(true); expect(evalBet("away_clean", 0, 0)).toBe(true);
    expect(evalMatch("tot:226.5", { hg: 113, ag: 113 })).toBe(false); expect(evalMatch("tot:226.5", { hg: 114, ag: 113 })).toBe(true);
    expect(evalMatch("mrg:-6.5", { hg: 100, ag: 106 })).toBe(true); expect(evalMatch("mrg:-6.5", { hg: 100, ag: 107 })).toBe(false); expect(evalMatch("mrg:6.5", { hg: 107, ag: 100 })).toBe(true);
  });
  it("two-way sports: no draws, lines monotone, both sides priced with a margin", () => {
    for (const lg of LEAGUES.filter((l) => l.two)) for (const [h, a] of cases) {
      const p = twoWayPriors(h, a, lg.two!) as Record<string, number>;
      expect(p.home_win! + p.away_win!).toBeCloseTo(1, 2);
      const tot = Object.keys(p).filter((k) => k.startsWith("tot:")).map((k) => [Number(k.slice(4)), p[k]!] as const).sort((x, y) => x[0] - y[0]);
      const mrg = Object.keys(p).filter((k) => k.startsWith("mrg:")).map((k) => [Number(k.slice(4)), p[k]!] as const).sort((x, y) => x[0] - y[0]);
      for (const rows of [tot, mrg]) for (let i = 1; i < rows.length; i++) expect(rows[i]![1], lg.name).toBeLessThanOrEqual(rows[i - 1]![1] + 1e-9);
      for (const [line] of [...tot, ...mrg]) expect(Math.abs(line * 2) % 2).toBe(1); // always a half line: no ties
      for (const v of Object.values(p)) { const o = computeOdds(v); expect(1 / o.yes + 1 / o.no).toBeGreaterThan(1.05); }
    }
  });
});

describe("steam players follow the sun", () => {
  const NOW = Date.UTC(2026, 9, 13, 4, 0, 0) / 1000; // the quiet hour
  it("a question about the evening peak is not priced as if the count stayed where it is at night", () => {
    expect(diurnalRatio("steam:730", NOW, NOW + 9 * 3600)).toBeGreaterThan(1.8);
    expect(diurnalRatio("btc", NOW, NOW + 9 * 3600)).toBe(1);
    // a player-made "stay above what it is now" at the 13 UTC peak was a 50/50 question and is now a long shot for the No side
    expect(tickChance("steam:730", 430_000, 430_000, 9, NOW)).toBeGreaterThan(0.95);
    const m = buildCustomTick("steam:730", 430_000, 430_000, NOW + 9 * 3600, NOW);
    expect(m.odds_yes).toBeLessThan(1.1);
    expect(m.params.forecast).toBeGreaterThan(700_000);
  });
  it("offered steam questions sit at the expected count for their hour, near a fair coin", () => {
    const ms = buildSteamMarkets({ "730": 430_000, "570": 430_000 }, NOW);
    expect(ms.length).toBeGreaterThan(0);
    for (const m of ms) { expect(m.odds_yes).toBeGreaterThan(1.5); expect(m.odds_no).toBeGreaterThan(1.5); expect(m.params.threshold).toBeGreaterThan(430_000); }
  });
});
