import { describe, expect, it } from "vitest";
import { delayFromPosition, delayFromTripUpdate } from "../shared/delay.ts";
import { tripUpdatesAdapter, vehiclePositionsAdapter } from "../shared/adapters/gtfsrt.ts";
import { openMeteoAdapter } from "../shared/adapters/openmeteo.ts";
import { localDayStart, parseGtfsTime } from "../shared/time.ts";

const tz = "Asia/Tokyo";
const jst = (h: number, m = 0, s = 0) => Date.UTC(2026, 9, 11, h - 9, m, s) / 1000;

describe("time helpers", () => {
  it("parses GTFS times beyond 24h", () => {
    expect(parseGtfsTime("25:10:00")).toBe(25 * 3600 + 600);
    expect(() => parseGtfsTime("nope")).toThrow();
  });
  it("finds local midnight", () => {
    expect(localDayStart(jst(15), tz)).toBe(jst(0));
  });
});

describe("delayFromPosition", () => {
  it("computes seconds late", () => {
    expect(delayFromPosition(jst(8, 33, 20), "08:30:00", tz)).toBe(200);
  });
  it("allows early buses", () => {
    expect(delayFromPosition(jst(8, 29), "08:30:00", tz)).toBe(-60);
  });
  it("handles after-midnight trips scheduled as 24:xx", () => {
    expect(delayFromPosition(jst(0, 12), "24:10:00", tz)).toBe(120);
  });
  it("discards implausible readings", () => {
    expect(delayFromPosition(jst(12), "08:30:00", tz)).toBeNull();
  });
});

describe("delayFromTripUpdate", () => {
  it("prefers arrival, falls back to departure, rejects garbage", () => {
    expect(delayFromTripUpdate({ arrival: { delay: 180 }, departure: { delay: 10 } })).toBe(180);
    expect(delayFromTripUpdate({ departure: { delay: 60 } })).toBe(60);
    expect(delayFromTripUpdate({})).toBeNull();
    expect(delayFromTripUpdate({ arrival: { delay: 999999 } })).toBeNull();
  });
});

describe("gtfs-rt adapters", () => {
  const schedule = (trip: string, seq: number) => (trip === "T1" && seq === 5 ? { stopId: "S5", time: "08:30:00" } : null);
  const ctx = { feedId: "toei", timezone: tz, fetchedAt: jst(8, 34), schedule };
  it("turns a vehicle position into a delay observation", () => {
    const obs = vehiclePositionsAdapter(
      { entity: [{ vehicle: { trip: { tripId: "T1", routeId: "R" }, currentStopSequence: 5, stopId: "S5", timestamp: jst(8, 33) } }] },
      ctx,
    );
    expect(obs).toEqual([{ feedId: "toei", tripId: "T1", stopId: "S5", routeId: "R", observedAt: jst(8, 33), delaySec: 180 }]);
  });
  it("skips trips unknown to the timetable or with a mismatching stop", () => {
    const feed = {
      entity: [
        { vehicle: { trip: { tripId: "T9" }, currentStopSequence: 1, timestamp: jst(8, 33) } },
        { vehicle: { trip: { tripId: "T1" }, currentStopSequence: 5, stopId: "OTHER", timestamp: jst(8, 33) } },
      ],
    };
    expect(vehiclePositionsAdapter(feed, ctx)).toEqual([]);
  });
  it("does nothing without a timetable", () => {
    expect(vehiclePositionsAdapter({ entity: [] }, { ...ctx, schedule: undefined })).toEqual([]);
  });
  it("reads explicit delays from trip updates", () => {
    const obs = tripUpdatesAdapter(
      { header: { timestamp: jst(8, 30) }, entity: [{ tripUpdate: { trip: { tripId: "K1", routeId: "R" }, stopTimeUpdate: [{ stopId: "A", arrival: { delay: 180, time: jst(8, 33) } }, { stopId: "B", arrival: { delay: 60 } }] } }] },
      ctx,
    );
    expect(obs).toEqual([{ feedId: "toei", tripId: "K1", stopId: "A", routeId: "R", observedAt: jst(8, 30), delaySec: 180, predictedAt: jst(8, 33) }]);
  });
});

describe("open-meteo adapter", () => {
  it("converts local hourly times to UTC hour starts", () => {
    const obs = openMeteoAdapter(
      { utc_offset_seconds: 32400, hourly: { time: ["2026-10-11T08:00", "2026-10-11T09:00"], precipitation: [0, 1.2] } },
      "om",
    );
    expect(obs).toEqual([
      { feedId: "om", hourStart: jst(8), precipitationMm: 0 },
      { feedId: "om", hourStart: jst(9), precipitationMm: 1.2 },
    ]);
  });
  it("skips null values and malformed payloads", () => {
    expect(openMeteoAdapter({ utc_offset_seconds: 0, hourly: { time: ["2026-10-11T08:00"], precipitation: [null] } }, "om")).toEqual([]);
    expect(openMeteoAdapter({}, "om")).toEqual([]);
  });
});
