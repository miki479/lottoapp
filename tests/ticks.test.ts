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

import { alertLevel, alertQueryDate, buildAlertMarkets } from "../shared/ticks.ts";
describe("regional alerts", () => {
  const doc = { A1: { idraulica: "orange", idrogeologica: "red", temporali: "green" }, A2: { idraulica: "green", idrogeologica: "yellow", temporali: "green" }, B1: { idraulica: "red" }, B2: { idraulica: "yellow", mareggiate: "yellow" }, G1: { idraulica: "green" } };
  it("takes the highest level of the zones of an area", () => {
    expect(alertLevel(doc, "romagna", "idraulica")).toBe(3);
    expect(alertLevel(doc, "romagna", "idrogeologica")).toBe(3);
    expect(alertLevel(doc, "romagna", "temporali")).toBe(0);
    expect(alertLevel(doc, "parma", "idraulica")).toBe(0);
  });
  it("returns null for an unknown colour or area", () => {
    expect(alertLevel({ A1: { idraulica: "purple" } }, "romagna", "idraulica")).toBeNull();
    expect(alertLevel(doc, "nowhere", "idraulica")).toBeNull();
  });
  it("formats the query date in Italian local time", () => { expect(alertQueryDate(Date.UTC(2026, 9, 14, 10, 0) / 1000)).toBe("2026-10-14 12:00"); });
  it("offers questions that close before the bulletin of that day", () => {
    const m = buildAlertMarkets(NOW, { "alert:romagna:idraulica": 1 });
    expect(m.length).toBeGreaterThan(10);
    for (const x of m) { expect(Date.parse(x.closes_at) / 1000).toBeGreaterThan(NOW); expect(x.lat).toBeTruthy(); expect(x.params.local).toBe("true"); }
  });
});

import { evalBet, matchPriors, MATCH_BETS } from "../shared/sport.ts";
describe("football markets", () => {
  const pr = matchPriors({ team: "A", played: 6, points: 14, goalsFor: 12, goalsAgainst: 5 }, { team: "B", played: 6, points: 5, goalsFor: 6, goalsAgainst: 11 });
  it("1X2 chances add up and double chance is their sum", () => {
    expect(pr.home_win + pr.draw + pr.away_win).toBeGreaterThan(0.97);
    expect(pr.home_win + pr.draw + pr.away_win).toBeLessThan(1.03);
    expect(Math.abs(pr.dc_1x - (pr.home_win + pr.draw))).toBeLessThan(0.01);
    expect(pr.home_win).toBeGreaterThan(pr.away_win);
  });
  it("settles every reason from a final score", () => {
    expect(evalBet("dc_1x", 1, 1)).toBe(true); expect(evalBet("dc_1x", 0, 2)).toBe(false);
    expect(evalBet("dc_x2", 0, 2)).toBe(true); expect(evalBet("dc_12", 1, 1)).toBe(false); expect(evalBet("dc_12", 2, 1)).toBe(true);
    expect(evalBet("over_2_5", 2, 1)).toBe(true); expect(evalBet("over_2_5", 1, 1)).toBe(false); expect(evalBet("btts", 1, 1)).toBe(true);
    expect(evalBet("home_clean", 2, 0)).toBe(true); expect(evalBet("away_clean", 2, 0)).toBe(false);
    expect(MATCH_BETS).toHaveLength(12);
  });
});

import { ALL_BETS, DETAIL_BETS, evalMatch, leagueAverage, tableFromResults } from "../shared/sport.ts";
import { resolveEvent } from "../shared/resolve.ts";
describe("football details (half-time, corners, cards)", () => {
  const pr = matchPriors(undefined, undefined, 1.3, true);
  it("every bet has a chance, and the extra ones sit inside the fair band", () => {
    expect(ALL_BETS).toHaveLength(12 + DETAIL_BETS.length);
    for (const b of ALL_BETS) expect(pr[b]).toBeGreaterThan(0.04);
    for (const b of DETAIL_BETS) { expect(pr[b]).toBeGreaterThanOrEqual(0.08); expect(pr[b]).toBeLessThanOrEqual(0.92); }
    expect(pr.corners_8_5).toBeGreaterThan(pr.corners_9_5); expect(pr.corners_9_5).toBeGreaterThan(pr.corners_10_5); expect(pr.cards_3_5).toBeGreaterThan(pr.cards_5_5);
    expect(pr.ht_home + pr.ht_draw + pr.ht_away).toBeGreaterThan(0.96); expect(pr.ht_draw).toBeGreaterThan(pr.st_draw);
  });
  it("settles halves, corners and cards, and refuses to guess when a figure is missing", () => {
    const s = { hg: 3, ag: 1, htHome: 1, htAway: 1, corners: 11, cards: 5, reds: 1 };
    expect(evalMatch("ht_draw", s)).toBe(true); expect(evalMatch("ht_home", s)).toBe(false);
    expect(evalMatch("st_home", s)).toBe(true); expect(evalMatch("st_draw", s)).toBe(false); expect(evalMatch("st_goal", s)).toBe(true);
    expect(evalMatch("corners_10_5", s)).toBe(true); expect(evalMatch("corners_11_5", s)).toBe(false);
    expect(evalMatch("cards_4_5", s)).toBe(true); expect(evalMatch("cards_5_5", s)).toBe(false); expect(evalMatch("red_card", s)).toBe(true);
    expect(evalMatch("ht_goal", { hg: 0, ag: 0, htHome: 0, htAway: 0 })).toBe(false);
    expect(evalMatch("ht_home", { hg: 2, ag: 0 })).toBeNull(); expect(evalMatch("corners_9_5", { hg: 2, ag: 0 })).toBeNull(); expect(evalMatch("red_card", { hg: 2, ag: 0, cards: 3 })).toBeNull();
    expect(evalMatch("st_home", { hg: 1, ag: 0, htHome: 2, htAway: 0 })).toBeNull(); // half-time above full-time: not believable
    expect(evalMatch("home_win", { hg: 1, ag: 0 })).toBe(true);
  });
  it("a detail bet stays pending without the figures, then is voided at the deadline", () => {
    const ev = { kind: "match_bet", category: "sport", eventId: "1", bet: "corners_9_5", cityId: "world", feedId: "sportsdb", closesAt: 1000, targetAt: 2000, deadlineAt: 5000 } as never;
    const base = { event: ev, feed: { feedId: "sportsdb", lastOkAt: 3000 }, staleAfterSec: 7200, delays: [], weather: [], match: { eventId: "1", homeGoals: 1, awayGoals: 0, status: "FT", fetchedAt: 2500 } } as never;
    expect((resolveEvent({ ...(base as object), now: 3000 } as never) as { status: string }).status).toBe("pending");
    expect((resolveEvent({ ...(base as object), now: 6000 } as never) as { status: string }).status).toBe("void");
    const withData = { ...(base as { match: object }), match: { eventId: "1", homeGoals: 1, awayGoals: 0, status: "FT", fetchedAt: 2500, corners: 12 } };
    expect((resolveEvent({ ...(withData as object), now: 3000 } as never) as { status: string; outcome?: string }).outcome).toBe("yes");
  });
  it("team strengths come from the matches played, pulled towards the league average", () => {
    const t = tableFromResults([{ home: "A", away: "B", hg: 3, ag: 0 }, { home: "B", away: "C", hg: 1, ag: 1 }, { home: "C", away: "A", hg: 0, ag: 2 }]);
    expect(t.find((r) => r.team === "A")).toMatchObject({ played: 2, points: 6, goalsFor: 5, goalsAgainst: 0 });
    expect(leagueAverage(t)).toBe(1.3); // too few games: default
    const strong = { team: "S", played: 6, points: 16, goalsFor: 16, goalsAgainst: 4 }, weak = { team: "W", played: 6, points: 3, goalsFor: 3, goalsAgainst: 14 };
    const p = matchPriors(strong, weak, 1.3, true);
    expect(p.home_win).toBeGreaterThan(0.6); expect(p.home_win).toBeLessThan(0.9);
  });
});

import { LEAGUES, twoWayPriors, buildMatchMarkets as bmm } from "../shared/sport.ts";
describe("two-way sports (basketball, hockey…)", () => {
  const nba = LEAGUES.find((l) => l.name === "NBA")!.two!;
  it("no draw: the two chances add up, home advantage and strength both count", () => {
    const even = twoWayPriors(undefined, undefined, nba);
    expect(even.home_win + even.away_win).toBeGreaterThan(0.99); expect(even.home_win).toBeGreaterThan(0.5); expect(even.home_win).toBeLessThan(0.65);
    const strong = twoWayPriors({ team: "S", played: 10, points: 0, goalsFor: 1200, goalsAgainst: 1050 }, { team: "W", played: 10, points: 0, goalsFor: 1050, goalsAgainst: 1200 }, nba);
    expect(strong.home_win).toBeGreaterThan(0.8);
  });
  it("only home and away markets are made, with the sport's own duration", () => {
    const NOW = 1_800_000_000;
    const m = bmm([{ eventId: "9", league: "NBA", home: "A", away: "B", kickoff: NOW + 7200 }], [], NOW, false, new Map(), true, nba);
    expect(m.map((x) => x.params.bet).sort()).toEqual(["away_win", "home_win"]);
    expect(Date.parse(m[0]!.target_at) / 1000).toBe(NOW + 7200 + 3 * 3600);
  });
});
