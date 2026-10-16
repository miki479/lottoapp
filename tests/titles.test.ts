import { describe, expect, it } from "vitest";
import { pickStyle, pickSubject, STYLES, SUBJECTS, titleId, titleText, subjectOfMarket, TITLE_RULES, type TitleStats } from "../shared/titles.ts";
import { TITLE_TEXT, type TitleLocale } from "../shared/titles-text.ts";

const LOCALES: TitleLocale[] = ["it", "en-US", "en-GB", "ja"];
const S = (o: Partial<TitleStats> = {}): TitleStats => ({ total: 30, byCategory: { train: 30 }, wins: 12, avgStake: 50, avgOdds: 2.2, balance: 1000, ...o });

describe("title style", () => {
  it("newbie under 5 settled bets, whatever else", () => {
    expect(pickStyle(S({ total: 4, avgStake: 5000 }))).toBe("newbie");
    expect(titleId(S({ total: 4 }))).toBe("mix:newbie");
    expect(pickStyle(S({ total: 5, byCategory: { train: 5 }, wins: 0 }))).toBe("regular");
  });
  it("highroller beats everything: 20% of the balance or 1000", () => {
    expect(pickStyle(S({ avgStake: 200, balance: 1000, wins: 30 }))).toBe("highroller");
    expect(pickStyle(S({ avgStake: 199, balance: 1000 }))).toBe("regular");
    expect(pickStyle(S({ avgStake: 1000, balance: 100000 }))).toBe("highroller");
    expect(pickStyle(S({ avgStake: 50, balance: 0 }))).toBe("regular");
  });
  it("lucky needs 58% over 15 bets, then risk, then cautious", () => {
    expect(pickStyle(S({ wins: 18 }))).toBe("lucky"); // 18/30 = 60%
    expect(pickStyle(S({ byCategory: { train: 14 }, wins: 14 }))).toBe("regular");
    expect(pickStyle(S({ wins: 17 }))).toBe("regular"); // 56.7%
    expect(pickStyle(S({ avgOdds: 3 }))).toBe("risk");
    expect(pickStyle(S({ avgOdds: 1.6 }))).toBe("cautious");
    expect(pickStyle(S({ wins: 20, avgOdds: 3.5 }))).toBe("lucky");
  });
});

describe("title subject", () => {
  it("most-bet category at >= 50%, strike counts as train, else mix", () => {
    expect(pickSubject({ weather: 6, bus: 4 })).toBe("weather");
    expect(pickSubject({ train: 3, strike: 3, bus: 4 })).toBe("train");
    expect(pickSubject({ weather: 4, bus: 4, finance: 4 })).toBe("mix");
    expect(pickSubject({ weather: 5, bus: 5 })).toBe("bus"); // a tie goes to the first subject in SUBJECTS order;
    expect(pickSubject({})).toBe("mix");
  });
  it("composes the id", () => {
    expect(titleId(S({ byCategory: { finance: 20, bus: 10 }, avgOdds: 4 }))).toBe("finance:risk");
  });
});

describe("title subject of a market", () => {
  it("splits culture by series", () => {
    expect(subjectOfMarket("culture", "steam:730")).toBe("games");
    expect(subjectOfMarket("culture", "lastfm:x")).toBe("music");
    expect(subjectOfMarket("culture", "tv:123")).toBe("culture");
    expect(subjectOfMarket("culture", null)).toBe("culture");
    expect(subjectOfMarket("strike")).toBe("train");
    expect(subjectOfMarket("zzz")).toBeNull();
  });
});

describe("title text", () => {
  it("every subject x style has a title in all locales, no duplicates, short", () => {
    for (const l of LOCALES) {
      const seen = new Set<string>();
      for (const sub of SUBJECTS) for (const st of STYLES) {
        const t = titleText(`${sub}:${st}`, l);
        expect(t, `${l} ${sub}:${st}`).toBeTruthy();
        expect(t!.length).toBeLessThanOrEqual(TITLE_RULES.maxLength);
        expect(seen.has(t!), `${l} duplicate ${t}`).toBe(false);
        seen.add(t!);
      }
      const nb = titleText("mix:newbie", l)!;
      expect(nb.length).toBeLessThanOrEqual(TITLE_RULES.maxLength);
      expect(seen.has(nb)).toBe(false);
      expect(Object.keys(TITLE_TEXT[l].subjects).sort()).toEqual([...SUBJECTS].sort());
    }
  });
  it("unknown or empty ids give null", () => {
    expect(titleText(null, "it")).toBeNull();
    expect(titleText("pizza:risk", "it")).toBeNull();
    expect(titleText("train:weird", "it")).toBeNull();
  });
});
