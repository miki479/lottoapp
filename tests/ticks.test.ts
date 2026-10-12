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

import { isPlayerBet, playerBetId, playerChance, playerMarket } from "../shared/sport.ts";
describe("player bets", () => {
  it("recognises the bet ids", () => {
    expect(isPlayerBet("pg:123")).toBe(true); expect(isPlayerBet("ps:9")).toBe(true); expect(isPlayerBet("pg:abc")).toBe(false); expect(isPlayerBet("home_win")).toBe(false); expect(playerBetId("pa:77")).toBe(77);
  });
  it("prices by position and team goals, and skips what is not worth offering", () => {
    const fw = playerChance("pg", "F", 1.4)!, mf = playerChance("pg", "M", 1.4)!;
    expect(fw).toBeGreaterThan(0.3); expect(fw).toBeLessThan(0.45); expect(mf).toBeGreaterThan(0.08); expect(mf).toBeLessThan(fw);
    expect(playerChance("pg", "D", 1.4)).toBeNull(); expect(playerChance("pg", "G", 1.4)).toBeNull(); expect(playerChance("pa", "D", 1.4)).toBeNull();
    expect(playerChance("ps", "F", 1.4)!).toBeGreaterThan(0.5); expect(playerChance("ps", "G", 1.4)).toBeNull();
    expect(playerChance("pg", "F", 2.2)!).toBeGreaterThan(fw);
  });
  it("settles from the match facts and waits (then voids) without them", () => {
    const facts = { goals: [10, 10, 22], assists: [11], subs: [30, 31] };
    expect(evalMatch("pg:10", { hg: 3, ag: 0, players: facts })).toBe(true); expect(evalMatch("pg:99", { hg: 3, ag: 0, players: facts })).toBe(false);
    expect(evalMatch("pa:11", { hg: 3, ag: 0, players: facts })).toBe(true); expect(evalMatch("pa:10", { hg: 3, ag: 0, players: facts })).toBe(false);
    expect(evalMatch("ps:30", { hg: 3, ag: 0, players: facts })).toBe(true); expect(evalMatch("ps:12", { hg: 3, ag: 0, players: facts })).toBe(false);
    expect(evalMatch("pg:10", { hg: 3, ag: 0 })).toBeNull();
    const ev = { kind: "match_bet", category: "sport", eventId: "1", bet: "pg:10", cityId: "world", feedId: "sportsdb", closesAt: 1000, targetAt: 2000, deadlineAt: 5000 } as never;
    const base = { event: ev, feed: { feedId: "sportsdb", lastOkAt: 3000 }, staleAfterSec: 7200, delays: [], weather: [] } as never;
    const withFacts = { ...(base as object), now: 3000, match: { eventId: "1", homeGoals: 3, awayGoals: 0, status: "FT", fetchedAt: 2500, players: facts } };
    expect((resolveEvent(withFacts as never) as { outcome?: string }).outcome).toBe("yes");
    expect((resolveEvent({ ...(base as object), now: 6000, match: { eventId: "1", homeGoals: 3, awayGoals: 0, status: "FT", fetchedAt: 2500 } } as never) as { status: string }).status).toBe("void");
  });
  it("builds a market with the player and a distinct dedupe key", () => {
    const f = { eventId: "5", league: "Serie A", home: "Napoli", away: "Verona", kickoff: 2_000_000_000, apiId: "77" };
    const pr = matchPriors(undefined, undefined, 1.3, true);
    const m = playerMarket(f, "pg:10", { id: 10, name: "Scott McTominay", pos: "M", side: "home" }, 0.14, pr, undefined, { by: null });
    expect(m.params.bet).toBe("pg:10"); expect(m.params.player?.name).toBe("Scott McTominay"); expect(m.dedupe_key).toBe("sport|5|pg:10"); expect(m.odds_yes).toBeGreaterThan(m.odds_no);
  });
});

import { buildFuelMarkets, buildMetalMarkets, buildOilMarkets, tickDef, isSpot } from "../shared/ticks.ts";
describe("metals, fuel and oil", () => {
  const MON = Date.UTC(2026, 9, 12, 10, 0, 0) / 1000; // Monday 10:00 UTC
  it("metals: weekday questions at 12 and 18 UTC on a friendly step, priced from the current price", () => {
    const m = buildMetalMarkets({ xau: 4172.9, xag: 60.74, hg: 6.64 }, MON);
    expect(m.length).toBeGreaterThanOrEqual(6);
    for (const x of m) { expect([12, 18]).toContain((Date.parse(x.target_at) / 1000 % 86400) / 3600); expect(x.params.series.startsWith("metal:")).toBe(true); expect(x.odds_yes).toBeGreaterThan(1.15); expect(x.odds_yes).toBeLessThan(4.5); }
    const gold = m.find((x) => x.params.series === "metal:xau")!; expect(gold.params.threshold % 10).toBe(0); expect(gold.params.digits).toBe(0);
    expect(m.find((x) => x.params.series === "metal:xag")!.params.threshold % 0.25).toBeCloseTo(0, 6);
    expect(isSpot("metal:xau")).toBe(true); expect(tickDef("metal:xau")!.category).toBe("finance");
  });
  it("metals: nothing on a weekend", () => {
    const SAT = Date.UTC(2026, 9, 10, 8, 0, 0) / 1000;
    expect(buildMetalMarkets({ xau: 4172.9 }, SAT).every((x) => new Date(x.target_at).getUTCDay() !== 6 && new Date(x.target_at).getUTCDay() !== 0)).toBe(true);
  });
  it("fuel: questions about the next published days, closing before the day ends, never a near-certain one", () => {
    const m = buildFuelMarkets({ benzina: 2.035, gasolio: 2.251 }, "2026-10-11", MON);
    expect(m.length).toBeGreaterThanOrEqual(2);
    for (const x of m) { expect(Date.parse(x.target_at)).toBeGreaterThan(Date.parse(x.closes_at)); expect(x.odds_yes).toBeGreaterThan(1.25); expect(x.params.digits).toBe(3); expect(x.params.unit).toBe("€/l"); }
    expect(m.some((x) => x.params.series === "fuel:benzina" && Math.abs(x.params.threshold - 2.035) < 0.011)).toBe(true);
  });
  it("oil: only weekdays, closing at noon UTC of the day asked about", () => {
    const m = buildOilMarkets({ brent: { date: "2026-10-06", value: 82.4 } }, MON); // the source lags by days
    expect(m.length).toBe(2);
    for (const x of m) { const d = new Date(Date.parse(x.target_at) - 86400_000); expect([0, 6]).not.toContain(d.getUTCDay()); expect(new Date(x.closes_at).getUTCHours()).toBe(12); expect(x.params.threshold % 0.5).toBe(0); }
    expect(buildOilMarkets({}, MON)).toHaveLength(0);
  });
});

import { liveYesProbability } from "../shared/odds.ts";
describe("live delay odds", () => {
  it("a train already 10 min late is far likelier to exceed 5 min than history says", () => {
    expect(liveYesProbability(0.06, 600, 300, 9, true)).toBeGreaterThan(0.35);
    expect(liveYesProbability(0.06, 600, 300, 1, true)).toBeGreaterThan(0.9);
  });
  it("an on-time train keeps the historical chance", () => {
    expect(liveYesProbability(0.06, 0, 300, 9, true)).toBeLessThan(0.1);
  });
});

import { buildTicketMarkets, isTicket, tmWindow } from "../shared/ticks.ts";
describe("concert counts (Ticketmaster)", () => {
  it("knows its series and window", () => {
    expect(isTicket("tm:milano")).toBe(true); expect(isTicket("tm:nowhere")).toBe(false);
    const w = tmWindow(Date.UTC(2026, 9, 14, 6) / 1000);
    expect(w.from).toBe("2026-10-16T00:00:00Z"); expect(w.to).toBe("2026-11-12T23:59:59Z");
  });
  it("one question per place, a little above today's count, resolved with the same window", () => {
    const now = Date.UTC(2026, 9, 13, 6) / 1000;
    const ms = buildTicketMarkets({ it: 79, milano: 22, roma: 2 }, now);
    expect(ms.map((m) => m.params.series)).toEqual(["tm:it", "tm:milano"]);
    for (const m of ms) { expect(m.params.threshold).toBeGreaterThan(m.params.now as number); expect(m.params.from).toBe(tmWindow(Date.parse(m.target_at) / 1000).from); expect(m.odds_yes).toBeGreaterThanOrEqual(1.1); expect(m.category).toBe("culture"); }
  });
});

import { buildTvMarket, isTv } from "../shared/ticks.ts";
describe("TV episode ratings", () => {
  it("is asked three days after the episode airs, priced around the recent score", () => {
    expect(isTv("tv:3767919")).toBe(true); expect(isTv("tv:abc")).toBe(false);
    const air = Date.UTC(2026, 9, 14, 1) / 1000, now = Date.UTC(2026, 9, 12, 12) / 1000;
    const m = buildTvMarket({ showId: 1, showName: "Show", episodeId: 99, season: 5, number: 8, airstamp: air, reference: 7.8, threshold: 7.8, now });
    expect(Date.parse(m.target_at) / 1000).toBe(air + 72 * 3600);
    expect(m.category).toBe("culture"); expect(m.params).toMatchObject({ series: "tv:99", showId: 1, season: 5, number: 8, digits: 1 });
    expect(Math.abs(m.odds_yes - m.odds_no)).toBeLessThan(0.6);
    expect(Date.parse(m.closes_at)).toBeLessThanOrEqual(Date.parse(m.target_at));
  });
});

import { bookPriors } from "../shared/sport.ts";
describe("bookmaker priors", () => {
  const book = (h: string, d: string, a: string, o: string, u: string, y: string, n: string) => ({ name: "b", bets: [
    { name: "Match Winner", values: [{ value: "Home", odd: h }, { value: "Draw", odd: d }, { value: "Away", odd: a }] },
    { name: "Goals Over/Under", values: [{ value: "Over 2.5", odd: o }, { value: "Under 2.5", odd: u }] },
    { name: "Both Teams Score", values: [{ value: "Yes", odd: y }, { value: "No", odd: n }] }] });
  it("removes the margin and derives double chance", () => {
    const pr = bookPriors([book("2.5", "3.0", "3.1", "2.2", "1.65", "1.85", "1.87"), book("2.5", "3.0", "3.1", "2.2", "1.65", "1.85", "1.87"), book("2.5", "3.0", "3.1", "2.2", "1.65", "1.85", "1.87")]);
    expect((pr.home_win ?? 0) + (pr.draw ?? 0) + (pr.away_win ?? 0)).toBeCloseTo(1, 2);
    expect(pr.dc_x2).toBeCloseTo((pr.draw ?? 0) + (pr.away_win ?? 0), 2);
    expect(pr.over_2_5).toBeGreaterThan(0.4); expect(pr.over_2_5).toBeLessThan(0.5); expect(pr.btts).toBeCloseTo(0.5, 1);
  });
  it("needs at least three bookmakers", () => { expect(bookPriors([book("2", "3", "4", "2", "1.8", "1.8", "1.9")])).toEqual({}); });
});
