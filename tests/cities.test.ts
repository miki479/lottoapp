import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateCity } from "../shared/cities.ts";

describe("city configs", () => {
  const files = readdirSync(new URL("../cities/", import.meta.url)).filter((f) => f.endsWith(".json"));
  it("has at least one city", () => expect(files.length).toBeGreaterThan(0));
  for (const f of files) {
    it(`${f} is valid and carries attribution for every feed`, () => {
      const city = validateCity(JSON.parse(readFileSync(new URL(`../cities/${f}`, import.meta.url), "utf8")));
      expect(f).toBe(`${city.id}.json`);
      for (const feed of city.feeds) expect(feed.attribution.license).toBeTruthy();
    });
  }
  it("rejects a city whose enabled category has no feed", () => {
    expect(() =>
      validateCity({
        id: "x", country: "JP", name: { en: "X" }, timezone: "Asia/Tokyo", defaultLocale: "en-US",
        location: { lat: 1, lon: 1 }, categories: { bus: { enabled: true }, weather: { enabled: false }, traffic: { enabled: false } }, feeds: [],
      }),
    ).toThrow(/no feed/);
  });
  it("rejects http feeds and unknown timezones", () => {
    const ok = JSON.parse(readFileSync(new URL("../cities/tokyo.json", import.meta.url), "utf8"));
    expect(() => validateCity({ ...ok, timezone: "Mars/Base" })).toThrow(/timezone/);
    expect(() => validateCity({ ...ok, feeds: [{ ...ok.feeds[0], url: "http://x" }] })).toThrow(/https/);
  });
});

import { usableFeeds } from "../shared/cities.ts";
describe("feed licence gate", () => {
  const load = (n: string) => validateCity(JSON.parse(readFileSync(new URL(`../cities/${n}.json`, import.meta.url), "utf8")));
  it("skips feeds whose licence is unverified unless opted in", () => {
    const rome = load("rome");
    expect(usableFeeds(rome, false).map((f) => f.id)).toEqual(["open-meteo-rome"]);
    expect(usableFeeds(rome, true).map((f) => f.id)).toContain("rome-trip-update");
  });
  it("does not use feeds of disabled categories", () => {
    expect(usableFeeds(load("tokyo"), true).every((f) => f.category !== "traffic" && f.category !== "train")).toBe(true);
  });
  it("covers Italy and a train city", () => {
    expect(load("rome").country).toBe("IT");
    expect(load("amsterdam").categories.train.enabled).toBe(true);
  });
});
