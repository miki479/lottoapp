import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MESSAGES } from "../web/src/i18n/index.ts";
import { seasonSpan } from "../web/src/lib/format.ts";
import { resolvingToday, summarize } from "../web/src/lib/summary.ts";

const src = (f: string) => readFileSync(`web/src/${f}`, "utf8");
const css = readFileSync("web/src/app.css", "utf8");

describe("the figures at the top of My bets", () => {
  const day = (d: string, net: number, bets = 1) => ({ day: d, net, bets });
  it("finds the worst day and how far the running result is under its peak", () => {
    const s = summarize([day("2026-10-01", 100), day("2026-10-02", -50), day("2026-10-03", -200), day("2026-10-04", 30)]);
    expect(s.worstDay).toEqual({ day: "2026-10-03", net: -200 });
    expect(s.drawdown).toBe(220);
    expect(s.days).toBe(4);
  });
  it("has no worst day when no day lost, and no drawdown at the top", () => {
    const s = summarize([day("2026-10-01", 40), day("2026-10-02", 60)]);
    expect(s.worstDay).toBeNull();
    expect(s.drawdown).toBe(0);
    expect(summarize([])).toEqual({ worstDay: null, drawdown: 0, days: 0 });
  });
  it("counts a peak that came first and a result that never went above zero", () => {
    expect(summarize([day("a", -100), day("b", -20)]).drawdown).toBe(120);
    expect(summarize([day("a", 500), day("b", -100), day("c", 300)]).drawdown).toBe(0);
  });
});

describe("the number on the My bets tab", () => {
  const NOW = Date.parse("2026-10-14T10:00:00Z");
  const bet = (status: string, at: string) => ({ status, markets: { target_at: at } });
  it("counts the open bets that are settled today or are late for the result, not the raw total", () => {
    const bets = [bet("open", "2026-10-14T16:00:00Z"), bet("open", "2026-10-14T09:00:00Z"), bet("open", "2026-10-15T08:00:00Z"), bet("won", "2026-10-14T08:00:00Z"), bet("open", "2026-10-20T08:00:00Z")];
    expect(resolvingToday(bets, [], NOW, "UTC")).toBe(2);
  });
  it("counts a multiple by its last leg", () => {
    const leg = (at: string) => ({ markets: { target_at: at } });
    const parlays = [{ status: "open", parlay_legs: [leg("2026-10-14T11:00:00Z"), leg("2026-10-14T18:00:00Z")] }, { status: "open", parlay_legs: [leg("2026-10-14T11:00:00Z"), leg("2026-10-16T18:00:00Z")] }, { status: "won", parlay_legs: [leg("2026-10-14T11:00:00Z")] }];
    expect(resolvingToday([], parlays, NOW, "UTC")).toBe(1);
  });
  it("goes by the player's day, not the server's", () => {
    const b = [bet("open", "2026-10-14T23:30:00Z")];
    expect(resolvingToday(b, [], NOW, "UTC")).toBe(1);
    expect(resolvingToday(b, [], Date.parse("2026-10-14T03:00:00Z"), "Pacific/Auckland")).toBe(0);
    expect(resolvingToday(b, [], Date.parse("2026-10-14T20:00:00Z"), "Pacific/Auckland")).toBe(1);
  });
  it("is what the tab is given", () => {
    expect(src("App.tsx")).toContain("const openBets = resolvingToday(bets, parlays, now);");
  });
});

describe("the season", () => {
  it("is the UTC month: its length, the days left and how much has gone", () => {
    const s = seasonSpan(new Date("2026-10-14T12:00:00Z"));
    expect(s.total).toBe(31);
    expect(s.left).toBe(18);
    expect(s.elapsed).toBeCloseTo(13.5 / 31, 3);
    expect(seasonSpan(new Date("2026-02-28T23:00:00Z")).total).toBe(28);
    expect(seasonSpan(new Date("2026-10-31T23:59:00Z")).left).toBe(1);
  });
});

describe("the screens of the player", () => {
  it("draw every progress with the one bar: experience, streak, the bank, the league, the season", () => {
    for (const f of ["views/Profile.tsx", "components/StreakCard.tsx", "components/BankCard.tsx", "components/League.tsx", "components/Season.tsx", "components/LookSheet.tsx"]) expect(src(f), f).toContain("<Meter");
    expect(css).not.toMatch(/\.xpbar|\.streakcard \.bar|\.bankcard \.bar/);
  });
  it("keeps the chosen pill of a segmented control clear of its edge, in the selected state of the app", () => {
    expect(css).toMatch(/\.seg \{[^}]*padding: 6px/);
    expect(css).toMatch(/\.seg button\.on \{[^}]*var\(--action\)/);
  });
  it("shows the level next to the nick in the tables, and the season as an element", () => {
    expect(src("views/Ranking.tsx")).toContain("<LevelBadge");
    expect(src("views/Ranking.tsx")).toContain("<SeasonBanner");
    expect(src("components/League.tsx")).toContain("<LevelBadge");
  });
  it("puts the position in the league as a bar with the gap to the next one up, the way to promotion, and what each league gives", () => {
    const lg = src("components/League.tsx");
    for (const w of ["gapTo", "leadOver", "<Rewards", "promo"]) expect(lg).toContain(w);
    for (const l of ["it", "en-US", "en-GB", "ja"]) expect(lg).toContain(l === "it" ? "  it: {" : `"${l}": {`.replace('"ja": {', "ja: {"));
    expect(css).toMatch(/\.pbtrack \{[^}]*height: 12px/);
  });
  it("shows the bank as two tiles, available and locked, the locked one visibly unusable, with the move between them", () => {
    const b = src("components/BankCard.tsx");
    for (const w of ["bt avail", "bt locked", "aria-disabled", "coinfly", "LockOpen", "Lock "]) expect(b, w).toContain(w);
    expect(css).toMatch(/\.bt\.locked \{[^}]*repeating-linear-gradient/);
    expect(css).toMatch(/@keyframes coinfly/);
  });
  it("puts a summary at the top of My bets and the time left on every open bet", () => {
    const v = src("views/Bets.tsx");
    for (const w of ["summarize(", "<Due", "betsum"]) expect(v, w).toContain(w);
    for (const l of ["it", "en-US", "en-GB", "ja"] as const) { const t = MESSAGES[l].bets.summary; expect(t.streak.length).toBeGreaterThan(1); expect(t.window(30)).toContain("30"); }
  });
  it("lines the identity card up on one axis", () => {
    expect(src("views/Profile.tsx")).toContain("idcard");
    expect(css).toMatch(/\.idcard \.idtop \{[^}]*grid-template-columns/);
  });
});
