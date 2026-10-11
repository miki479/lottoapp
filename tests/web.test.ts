import { nextMilestone } from "../shared/rewards.ts";
import { currencySymbol, money, resultAmount } from "../web/src/lib/format.ts";
import { describe, expect, it } from "vitest";
import { MESSAGES } from "../web/src/i18n/index.ts";
import { pickCity, pickLocale, type CityInfo } from "../web/src/lib/detect.ts";
import { formatWhen, minutesUntil, question, type MarketRow } from "../web/src/lib/format.ts";

describe("locale detection", () => {
  it("maps browser languages to our locales", () => {
    expect(pickLocale(["it-IT", "en-US"])).toBe("it");
    expect(pickLocale(["en-GB"])).toBe("en-GB");
    expect(pickLocale(["en-AU"])).toBe("en-GB");
    expect(pickLocale(["en-US"])).toBe("en-US");
    expect(pickLocale(["en"])).toBe("en-US");
    expect(pickLocale(["ja-JP", "en-US"])).toBe("ja");
  });
  it("skips languages we have no copy for and falls back to en-US", () => {
    expect(pickLocale(["fr-FR", "it"])).toBe("it");
    expect(pickLocale(["fr-FR"])).toBe("en-US");
    expect(pickLocale([])).toBe("en-US");
  });
});

describe("city detection", () => {
  const cities: CityInfo[] = [
    { id: "amsterdam", country: "NL", timezone: "Europe/Amsterdam", enabled: true },
    { id: "rome", country: "IT", timezone: "Europe/Rome", enabled: true },
    { id: "tokyo", country: "JP", timezone: "Asia/Tokyo", enabled: true },
  ];
  it("prefers the IP country, then the browser timezone, then the language", () => {
    expect(pickCity(cities, { country: "NL", timezone: "Asia/Tokyo", locale: "it" })).toBe("amsterdam");
    expect(pickCity(cities, { country: null, timezone: "Europe/Rome", locale: "en-US" })).toBe("rome");
    expect(pickCity(cities, { country: null, timezone: "America/New_York", locale: "it" })).toBe("rome");
  });
  it("falls back to Tokyo for everyone else", () => {
    expect(pickCity(cities, { country: "US", timezone: "America/New_York", locale: "en-US" })).toBe("tokyo");
  });
  it("never picks a city with no active category", () => {
    const off = cities.map((c) => (c.id === "rome" ? { ...c, enabled: false } : c));
    expect(pickCity(off, { country: "IT", timezone: "Europe/Rome", locale: "it" })).toBe("tokyo");
  });
});

describe("i18n", () => {
  const ref = MESSAGES["en-US"];
  const keysOf = (o: object, p = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? keysOf(v, `${p}${k}.`) : [`${p}${k}`]));
  for (const [id, m] of Object.entries(MESSAGES)) {
    it(`${id} has every key of en-US, with no empty text`, () => {
      expect(keysOf(m).sort()).toEqual(keysOf(ref).sort());
      for (const k of keysOf(m)) {
        const v = k.split(".").reduce<unknown>((o, part) => (o as Record<string, unknown>)[part], m);
        if (typeof v === "string") expect(v.trim().length, `${id}:${k}`).toBeGreaterThan(0);
      }
    });
  }
  it("every language states clearly that credits are fake", () => {
    expect(MESSAGES.it.disclaimerFull).toMatch(/fittizi|finti/i);
    expect(MESSAGES["en-US"].disclaimerFull).toMatch(/no real money/i);
    expect(MESSAGES["en-GB"].disclaimerFull).toMatch(/no real money/i);
  });
  it("copy is written per audience, not just translated", () => {
    expect(MESSAGES["en-US"].tabs.bus).not.toBe(MESSAGES["en-GB"].tabs.bus);
    expect(MESSAGES["en-US"].bets.empty.body).not.toBe(MESSAGES["en-GB"].bets.empty.body);
  });
});

describe("market text", () => {
  const m: MarketRow = {
    id: "1", city_id: "tokyo", category: "bus", kind: "bus_delay_gt", status: "open", odds_yes: 3, odds_no: 1.3,
    params: { routeName: "都07", headsign: "門前仲町", stopName: "五ノ橋", thresholdSec: 180 },
    closes_at: "2026-10-11T13:39:00Z", target_at: "2026-10-11T13:49:00Z",
  };
  const now = new Date("2026-10-11T13:00:00Z");
  it("shows the time in the city's timezone", () => {
    expect(formatWhen(m.target_at, "en-US", "Asia/Tokyo", now)).toBe("22:49");
    expect(formatWhen(m.target_at, "it", "Europe/Rome", now)).toBe("15:49");
  });
  it("adds the weekday when it is not today", () => {
    expect(formatWhen("2026-10-12T21:00:00Z", "en-GB", "Asia/Tokyo", now)).toMatch(/Tue 06:00/);
  });
  it("builds the question in each language", () => {
    expect(question(m, MESSAGES.it, "it", "Tokyo", "Asia/Tokyo", now)).toBe("La linea 都07 per 門前仲町 avrà più di 3 min di ritardo a 五ノ橋 alle 22:49?");
    expect(question(m, MESSAGES["en-US"], "en-US", "Tokyo", "Asia/Tokyo", now)).toContain("run more than 3 min late");
    expect(question(m, MESSAGES["en-GB"], "en-GB", "Tokyo", "Asia/Tokyo", now)).toContain("be more than 3 minutes late");
  });
  it("asks about rain with the city and time", () => {
    const rain: MarketRow = { ...m, kind: "rain_at", category: "weather", params: {} };
    expect(question(rain, MESSAGES.it, "it", "Roma", "Europe/Rome", now)).toBe("Pioverà a Roma alle 15:49?");
  });
  it("counts minutes to closing without going negative", () => {
    expect(minutesUntil("2026-10-11T13:39:00Z", Date.parse("2026-10-11T13:00:00Z"))).toBe(39);
    expect(minutesUntil("2026-10-11T13:39:00Z", Date.parse("2026-10-11T14:00:00Z"))).toBe(0);
  });
});

describe("play money and rewards", () => {
  it("shows the currency of the audience", () => {
    expect(money(1000, "en-US")).toBe("$1,000");
    expect(money(1000, "en-GB")).toBe("£1,000");
    expect(money(1000, "it").replace(/\s/g, " ")).toMatch(/^1\.?000\s?€$/);
    expect(currencySymbol("it")).toBe("€");
  });
  it("formats outcomes with sign", () => {
    expect(resultAmount("won", 50, 200, "en-US")).toBe("+$150");
    expect(resultAmount("lost", 50, 0, "en-US")).toBe("−$50");
  });
  it("finds the next streak reward", () => {
    expect(nextMilestone(0)).toEqual({ day: 3, bonus: 50 });
    expect(nextMilestone(3)).toEqual({ day: 7, bonus: 150 });
    expect(nextMilestone(30)).toBeNull();
  });
});
