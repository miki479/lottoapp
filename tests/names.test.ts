import { describe, expect, it } from "vitest";
import { MESSAGES } from "../web/src/i18n/index.ts";
import { alertLabel, alertLabelOf, leagueName, matchName, placeName, teamName } from "../web/src/lib/names.ts";
import { question, type MarketRow } from "../web/src/lib/format.ts";

describe("names in the language of the interface", () => {
  it("writes clubs the way each language does and leaves the rest as the data has them", () => {
    expect(teamName("KK Crvena zvezda", "it")).toBe("Stella Rossa");
    expect(teamName("KK Crvena zvezda", "en-GB")).toBe("Red Star Belgrade");
    expect(teamName("KK Crvena zvezda", "ja")).toBe("Red Star Belgrade");
    expect(teamName("Bayern Munich", "it")).toBe("Bayern Monaco");
    expect(teamName("Bayern Munich", "en-US")).toBe("Bayern Munich");
    expect(teamName("Juventus", "it")).toBe("Juventus");
    expect(matchName("Lyon-Villeurbanne – KK Crvena zvezda", "it")).toBe("ASVEL – Stella Rossa");
    expect(matchName("Lyon-Villeurbanne – KK Crvena zvezda", "en-US")).toBe("ASVEL – Red Star Belgrade");
  });
  it("writes leagues in the language of the interface", () => {
    expect(leagueName("Scottish Premiership", "it")).toBe("Premiership scozzese");
    expect(leagueName("EuroLeague", "it")).toBe("Eurolega");
    expect(leagueName("Serie C - A", "en-GB")).toBe("Serie C · Group A");
    expect(leagueName("Champions League", "ja")).toBe("チャンピオンズリーグ");
    expect(leagueName("NBA", "it")).toBe("NBA");
  });
  it("writes towns the way each language does, and splits a name that carries its Japanese form", () => {
    expect(placeName("London", "it")).toBe("Londra");
    expect(placeName("Milano", "en-US")).toBe("Milan");
    expect(placeName("München", "it")).toBe("Monaco di Baviera");
    expect(placeName("Yokohama 横浜", "it")).toBe("Yokohama");
    expect(placeName("Yokohama 横浜", "en-US")).toBe("Yokohama");
    expect(placeName("Yokohama 横浜", "ja")).toBe("横浜");
    expect(placeName("Bologna", "it")).toBe("Bologna");
  });
  it("writes the civil-protection alerts in every language, from the series or from the Italian label", () => {
    expect(alertLabel("alert:romagna:idraulica", MESSAGES.it)).toBe("Allerta idraulica (piene dei fiumi) · Romagna");
    expect(alertLabel("alert:bologna:temporali", MESSAGES["en-US"])).toBe("Thunderstorm alert · Bologna and Ferrara");
    expect(alertLabelOf("Allerta idrogeologica (frane) · Romagna", MESSAGES["en-GB"])).toBe("Hydrogeological alert (landslides) · Romagna");
    expect(alertLabelOf("something else", MESSAGES.it)).toBe("something else");
  });
  it("puts those names into the question of a match and of an alert", () => {
    const match = { id: "m1", kind: "match_bet", category: "sport", city_id: "world", target_at: "2026-10-20T19:00:00Z", closes_at: "2026-10-20T18:55:00Z", params: { bet: "home_win", home: "Bayern Munich", away: "Sevilla", kickoff: 1792004400 } } as unknown as MarketRow;
    expect(question(match, MESSAGES.it, "it", "", "UTC")).toContain("Bayern Monaco batte Siviglia");
    const alert = { id: "a1", kind: "tick_gt", category: "nature", city_id: "world", target_at: "2026-10-16T22:00:00Z", closes_at: "2026-10-16T20:00:00Z", params: { series: "alert:romagna:idraulica", label: "Allerta idraulica (piene dei fiumi) · Romagna", threshold: 1, note: "yellow" } } as unknown as MarketRow;
    expect(question(alert, MESSAGES["en-US"], "en-US", "", "UTC")).toContain("Hydraulic alert (river floods) · Romagna");
  });
});
