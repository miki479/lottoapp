import { describe, expect, it } from "vitest";
import { addDays, gtfsDayStart, zonedEpoch } from "../shared/time.ts";

const utc = (s: string) => Date.parse(s) / 1000;

describe("days when the clocks change", () => {
  it("a GTFS service day starts at noon minus 12 hours, not at local midnight", () => {
    // Rome, 25 October 2026: 25 hours long, midnight is 22:00 UTC, but 'noon minus 12h' is 23:00 UTC
    expect(gtfsDayStart(utc("2026-10-25T10:00:00Z"), "Europe/Rome")).toBe(utc("2026-10-24T23:00:00Z"));
    // an ordinary day: the same as midnight
    expect(gtfsDayStart(utc("2026-10-20T10:00:00Z"), "Europe/Rome")).toBe(utc("2026-10-19T22:00:00Z"));
    // 29 March 2026: 23 hours long
    expect(gtfsDayStart(utc("2026-03-29T10:00:00Z"), "Europe/Rome")).toBe(utc("2026-03-28T23:00:00Z") - 3600);
  });
  it("finds the instant a wall clock reads on a 25 or 23 hour day", () => {
    expect(zonedEpoch("2026-10-25", 3 * 3600 + 1800, "Europe/Rome")).toBe(utc("2026-10-25T02:30:00Z"));
    expect(zonedEpoch("2026-10-25", 15 * 3600 + 1800, "Europe/Rome")).toBe(utc("2026-10-25T14:30:00Z"));
    expect(zonedEpoch("2026-03-29", 15 * 3600 + 1800, "Europe/Rome")).toBe(utc("2026-03-29T13:30:00Z"));
    expect(zonedEpoch("2026-10-20", 8 * 3600, "Europe/Rome")).toBe(utc("2026-10-20T06:00:00Z"));
  });
  it("adds days on the calendar", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

import { localDayStart } from "../shared/time.ts";
describe("local midnight on days when the clocks change", () => {
  it("is the real local midnight, whatever the hour asked", () => {
    expect(localDayStart(utc("2026-10-25T10:00:00Z"), "Europe/Rome")).toBe(utc("2026-10-24T22:00:00Z"));
    expect(localDayStart(utc("2026-10-25T00:30:00Z"), "Europe/Rome")).toBe(utc("2026-10-24T22:00:00Z"));
    expect(localDayStart(utc("2026-03-29T10:00:00Z"), "Europe/Rome")).toBe(utc("2026-03-28T23:00:00Z"));
    expect(localDayStart(utc("2026-10-20T10:00:00Z"), "Europe/Rome")).toBe(utc("2026-10-19T22:00:00Z"));
    expect(localDayStart(utc("2026-10-20T10:00:00Z"), "Asia/Tokyo")).toBe(utc("2026-10-19T15:00:00Z"));
  });
});
