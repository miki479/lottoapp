import { describe, expect, it } from "vitest";
import { alignNames, findRow, mergeForm, parseEspnTable } from "../shared/form.ts";
import { ESPN_PATH } from "../shared/live.ts";
import { resolveEvent } from "../shared/resolve.ts";
import { buildMatchMarkets, LEAGUES, MIN_FORM_GAMES, type Fixture, type TableRow } from "../shared/sport.ts";
import type { MatchEvent } from "../shared/types.ts";

const row = (team: string, played: number, goalsFor: number, goalsAgainst: number): TableRow => ({ team, played, points: 0, goalsFor, goalsAgainst });

describe("European football leagues", () => {
  it("has unique TheSportsDB ids, every name known to the live scores, and the UEFA ones flagged", () => {
    expect(new Set(LEAGUES.map((l) => l.id)).size).toBe(LEAGUES.length);
    for (const n of ["Champions League", "Europa League", "Conference League", "Premier League", "La Liga", "Bundesliga", "Ligue 1"]) {
      const l = LEAGUES.find((x) => x.name === n); expect(l, n).toBeTruthy(); expect(l!.deep).toBe(true); expect(ESPN_PATH[n]).toMatch(/^soccer\//);
    }
    expect(LEAGUES.filter((l) => l.euro).map((l) => l.id)).toEqual(["4480", "4481", "5071"]);
  });
  it("matches club names across sources without mixing up look-alikes", () => {
    const t = [row("Internazionale", 6, 18, 8), row("Real Madrid", 6, 15, 5), row("Real Sociedad", 6, 8, 9), row("Brighton & Hove Albion", 6, 10, 7), row("Bayer Leverkusen", 6, 12, 6), row("Napoli", 6, 11, 6)];
    expect(findRow("Inter Milan", t)?.team).toBe("Internazionale");
    expect(findRow("Real Madrid", t)?.team).toBe("Real Madrid");
    expect(findRow("Real Betis", t)).toBeNull();
    expect(findRow("Brighton and Hove Albion", t)?.team).toBe("Brighton & Hove Albion");
    expect(findRow("Bayer 04 Leverkusen", t)?.team).toBe("Bayer Leverkusen");
    expect(findRow("SSC Napoli", t)?.team).toBe("Napoli");
  });
  it("reads a standings answer", () => {
    const j = { children: [{ standings: { entries: [{ team: { displayName: "Napoli" }, stats: [{ name: "gamesPlayed", value: 2 }, { name: "pointsFor", value: 5 }, { name: "pointsAgainst", value: 1 }, { name: "points", value: 4 }] }, { team: { displayName: "Broken" }, stats: [] }] } }] };
    expect(parseEspnTable(j)).toEqual([{ team: "Napoli", played: 2, points: 4, goalsFor: 5, goalsAgainst: 1 }]);
    expect(parseEspnTable(null)).toEqual([]);
  });
  it("adds the cup and the domestic games of a club, discounting weaker leagues, and drops clubs found nowhere", () => {
    const cup = [row("Napoli", 2, 3, 2), row("Villarreal", 2, 4, 3)];
    const it1 = [row("Napoli", 6, 12, 6)], es = [row("Villarreal", 6, 10, 7)], other = [row("Qarabag", 4, 8, 2)];
    const m = mergeForm(["Napoli", "Villarreal", "Unknown FC", "Qarabag"], [{ rows: cup, tier: 1 }, { rows: it1, tier: 1 }, { rows: es, tier: 1 }, { rows: other, tier: 0.5 }]);
    expect(m.find((r) => r.team === "Napoli")).toMatchObject({ played: 8, goalsFor: 15, goalsAgainst: 8 });
    expect(m.find((r) => r.team === "Qarabag")).toMatchObject({ played: 4, goalsFor: 4, goalsAgainst: 4 });
    expect(m.find((r) => r.team === "Unknown FC")).toBeUndefined();
    expect(alignNames([row("Internazionale", 6, 18, 8), row("Roma", 6, 9, 9)], ["Inter Milan"]).map((r) => r.team)).toEqual(["Inter Milan", "Roma"]);
  });
  it("prices a Champions League night from cup + domestic form, and offers nothing for a club without form", () => {
    const now = 1_700_000_000, k = now + 3 * 3600;
    const fx = (id: string, home: string, away: string): Fixture => ({ eventId: id, league: "Champions League", home, away, kickoff: k, homeBadge: "h.png", awayBadge: "a.png" });
    const table = mergeForm(["Villarreal", "Napoli", "Kauno Zalgiris"], [{ rows: [row("Villarreal", 2, 4, 3), row("Napoli", 2, 3, 2)], tier: 1 }, { rows: [row("Villarreal", 6, 10, 7), row("Napoli", 6, 12, 6)], tier: 1 }]);
    const geo = new Map([["1", { lat: 40.85, lon: 14.27 }]]);
    const out = buildMatchMarkets([fx("1", "Villarreal", "Napoli"), fx("2", "Napoli", "Kauno Zalgiris")], table, now, false, geo, true, undefined, undefined, MIN_FORM_GAMES);
    expect(new Set(out.map((m) => m.params.eventId))).toEqual(new Set(["1"]));
    expect(out).toHaveLength(3);
    for (const m of out) { expect(m.odds_yes).toBeGreaterThanOrEqual(1.01); expect(m.odds_yes).toBeLessThanOrEqual(15); expect(m.lat).toBe(40.85); expect(m.params.local).toBe("true"); expect(m.params.awayBadge).toBe("a.png"); }
    const p = out[0]!.params.priors;
    expect(p.home_win + p.draw + p.away_win).toBeGreaterThan(0.97); expect(p.home_win + p.draw + p.away_win).toBeLessThan(1.03);
  });
  it("leaves a cup tie decided in extra time or on penalties pending (voided later), but settles a normal full time", () => {
    const ev: MatchEvent = { id: "m", cityId: "world", feedId: "sportsdb", kind: "match_bet", category: "sport", eventId: "1", bet: "home_win", league: "Champions League", closesAt: 0, targetAt: 100, deadlineAt: 1e6 };
    const run = (status: string) => resolveEvent({ event: ev, now: 5000, feed: { feedId: "sportsdb", lastOkAt: 4990 }, staleAfterSec: 180, delays: [], weather: [], match: { eventId: "1", homeGoals: 2, awayGoals: 1, status, fetchedAt: 4990 } } as Parameters<typeof resolveEvent>[0]);
    expect(run("FT")).toMatchObject({ status: "resolved", outcome: "yes" });
    expect(run("AET")).not.toMatchObject({ status: "resolved" });
    expect(run("PEN")).not.toMatchObject({ status: "resolved" });
  });
});
