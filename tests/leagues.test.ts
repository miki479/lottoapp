import { describe, expect, it } from "vitest";
import { closeSeason, promotionGap, resetBalance, leagueDaysLeft, type SeasonPlayer } from "../shared/leagues.ts";

const P = (id: string, league: number, credits: number, played = true): SeasonPlayer => ({ id, league, credits, played });
const get = (r: ReturnType<typeof closeSeason>, id: string) => r.find((x) => x.id === id)!;

describe("leagues", () => {
  it("reset grows with the league but stays small", () => {
    expect([0, 1, 2, 3, 4, 9].map(resetBalance)).toEqual([1000, 1150, 1300, 1450, 1600, 1600]);
  });
  it("the top quarter of each league (at most 10) moves up, the rest stay", () => {
    const ps = Array.from({ length: 48 }, (_, i) => P(`a${i}`, 0, 9000 - i * 100));
    ps.push(P("b0", 1, 10));
    const r = closeSeason(ps);
    expect(r.filter((x) => x.id.startsWith("a") && x.leagueAfter === 1).length).toBe(10);
    expect(get(r, "a10").leagueAfter).toBe(0);
    expect(get(r, "a0").rank).toBe(1);
    expect(get(r, "a0").newCredits).toBe(1150);
    expect(get(r, "a11").newCredits).toBe(1000);
    const small = closeSeason(Array.from({ length: 12 }, (_, i) => P(`m${i}`, 0, 5000 - i * 100)));
    expect(small.filter((x) => x.leagueAfter === 1).length).toBe(3);
    const three = closeSeason([P("u1", 0, 900), P("u2", 0, 800), P("u3", 0, 700)]);
    expect(three.map((x) => x.leagueAfter)).toEqual([1, 0, 0]); // a small league still promotes one (quarter rounded up)
    expect(closeSeason([P("solo", 0, 900)])[0]!.leagueAfter).toBe(0); // alone: nobody to rank against
    expect(get(r, "b0").leagueAfter).toBe(1); // alone in its league: too few players to promote by rank
  });
  it("1,000,000 credits promotes even outside the top 10, and ties share the rank", () => {
    const ps = [...Array.from({ length: 40 }, (_, i) => P(`t${i}`, 0, 2_000_000 - i)), P("rich", 0, 1_000_000), P("x", 0, 999_999)];
    const r = closeSeason(ps);
    expect(get(r, "rich").leagueAfter).toBe(1);
    expect(get(r, "x").leagueAfter).toBe(0);
    const tie = closeSeason(Array.from({ length: 12 }, (_, i) => P(`k${i}`, 0, i < 2 ? 50 : 9000)));
    expect(get(tie, "k0").rank).toBe(11);
    expect(get(tie, "k0").leagueAfter).toBe(0);
  });
  it("nobody is demoted and the top league is the cap", () => {
    const r = closeSeason([P("d", 4, 5_000_000), P("s", 3, 1)]);
    expect(get(r, "d").leagueAfter).toBe(4);
    expect(get(r, "d").newCredits).toBe(1600);
    expect(get(r, "s").leagueAfter).toBe(3);
  });
  it("inactive players drop one league (bronze stays) and are never reduced below their credits", () => {
    const r = closeSeason([P("i1", 2, 400, false), P("i2", 2, 90_000, false), P("p", 2, 10)]);
    expect(get(r, "i1")).toMatchObject({ leagueAfter: 1, newCredits: 1150, rank: null });
    expect(get(r, "i2").newCredits).toBe(90_000);
    expect(closeSeason([P("b", 0, 300, false)])[0]).toMatchObject({ leagueAfter: 0, newCredits: 1000 });
    expect(get(r, "p").rank).toBe(1); // inactive players do not count in the ranking
  });
  it("promotion gap", () => {
    expect(promotionGap(0, 500, 800)).toBe(300);
    expect(promotionGap(0, 900, 800)).toBe(0);
    expect(promotionGap(0, 500, null)).toBe(999_500);
    expect(promotionGap(4, 500, 800)).toBeNull();
  });
  it("days left", () => {
    expect(leagueDaysLeft(new Date("2026-10-30T12:00:00Z"))).toBe(2);
    expect(leagueDaysLeft(new Date("2026-10-31T23:59:00Z"))).toBe(1);
  });
});
