import { describe, expect, it } from "vitest";
import { delayFromPosition, delayFromTripUpdate } from "../shared/delay.ts";
import { tripUpdatesAdapter, tripUpdatesTimesAdapter, vehiclePositionsAdapter } from "../shared/adapters/gtfsrt.ts";
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
    expect(obs).toEqual([{ feedId: "toei", tripId: "T1", stopId: "S5", stopSequence: 5, routeId: "R", observedAt: jst(8, 33), delaySec: 180 }]);
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

describe("trip updates with times only", () => {
  const sched = (trip: string, seq: number) => (trip === "T1" && seq === 3 ? { stopId: "S3", time: "08:30:00" } : null);
  const base = { feedId: "gtt", timezone: tz, fetchedAt: jst(8, 20), schedule: sched };
  it("computes the delay against the timetable of the same stop sequence", () => {
    const obs = tripUpdatesTimesAdapter(
      { header: { timestamp: jst(8, 20) }, entity: [{ tripUpdate: { trip: { tripId: "T1", routeId: "R" }, stopTimeUpdate: [{ stopSequence: 3, stopId: "S3", arrival: { time: jst(8, 34) } }] } }] },
      base,
    );
    expect(obs).toEqual([{ feedId: "gtt", tripId: "T1", stopId: "S3", stopSequence: 3, routeId: "R", observedAt: jst(8, 20), delaySec: 240, predictedAt: jst(8, 34) }]);
  });
  it("skips unknown stops, re-routed stops and missing times", () => {
    const upd = (stu: object) => ({ entity: [{ tripUpdate: { trip: { tripId: "T1" }, stopTimeUpdate: [stu] } }] });
    expect(tripUpdatesTimesAdapter(upd({ stopSequence: 9, arrival: { time: jst(8, 34) } }), base)).toEqual([]);
    expect(tripUpdatesTimesAdapter(upd({ stopSequence: 3, stopId: "OTHER", arrival: { time: jst(8, 34) } }), base)).toEqual([]);
    expect(tripUpdatesTimesAdapter(upd({ stopSequence: 3, arrival: { delay: 120 } }), base)).toEqual([]);
    expect(tripUpdatesTimesAdapter(upd({ stopSequence: 3, arrival: { time: jst(8, 34) } }), { ...base, schedule: undefined })).toEqual([]);
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

describe("feeds without tripId (Helsinki)", () => {
  const sched = { "1007|1|20261012|09:53:00|1113435": { seq: 12, stopId: "1113435", time: "10:05:00" } };
  const ctx = {
    feedId: "hsl", timezone: "Europe/Helsinki", fetchedAt: 0, tripKey: "route_dir_start" as const,
    schedule: () => null,
    scheduleByStop: (trip: string, stop: string) => (sched as Record<string, { seq: number; stopId: string; time: string }>)[`${trip}|${stop}`] ?? null,
  };
  const at = (h: number, m: number) => Date.UTC(2026, 9, 12, h - 3, m) / 1000; // Helsinki is UTC+3 in October
  const feed = (stopId: string, time: number) => ({
    header: { timestamp: at(10, 0) },
    entity: [{ tripUpdate: { trip: { routeId: "1007", directionId: 1, startDate: "20261012", startTime: "09:53:00" }, stopTimeUpdate: [{ stopId, arrival: { time } }] } }],
  });
  it("names the trip by route, direction, day and start time and finds the stop by its id", () => {
    const obs = tripUpdatesTimesAdapter(feed("1113435", at(10, 8)), ctx);
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatchObject({ tripId: "1007|1|20261012|09:53:00", stopId: "1113435", stopSequence: 12, delaySec: 180 });
  });
  it("ignores stops it cannot place and trips without a start time", () => {
    expect(tripUpdatesTimesAdapter(feed("999", at(10, 8)), ctx)).toEqual([]);
    const noStart = { entity: [{ tripUpdate: { trip: { routeId: "1007", directionId: 1, startDate: "20261012" }, stopTimeUpdate: [{ stopId: "1113435", arrival: { time: at(10, 8) } }] } }] };
    expect(tripUpdatesTimesAdapter(noStart, ctx)).toEqual([]);
  });
});

import { parseTrainTripId, trainTripId, viaggiatrenoAdapter } from "../shared/adapters/viaggiatreno.ts";

describe("viaggiatreno adapter", () => {
  const day = Date.UTC(2026, 9, 11, 22); // service-day epoch ms (arbitrary but fixed)
  const ctx = { feedId: "it-train-viaggiatreno", fetchedAt: 1_800_000_000, tripId: trainTripId("S01700", 9600, day) };
  const train = {
    categoria: "FR", oraUltimoRilevamento: 1_799_999_000_000,
    fermate: [
      { id: "S01700", progressivo: 1, arrivoReale: null, partenzaReale: 1_799_990_000_000, ritardoArrivo: 0, ritardoPartenza: 3 },
      { id: "S01600", progressivo: 2, arrivoReale: 1_799_995_000_000, partenzaReale: null, ritardoArrivo: 7, ritardoPartenza: 0 },
      { id: "S01500", progressivo: 3, arrivoReale: null, partenzaReale: null, ritardoArrivo: 0, ritardoPartenza: 0 },
    ],
  };
  it("emits one observation per stop already reached, in seconds", () => {
    const obs = viaggiatrenoAdapter(train, ctx);
    expect(obs.map((o) => [o.stopId, o.delaySec])).toEqual([["S01700", 180], ["S01600", 420]]);
    expect(obs[0]!.tripId).toBe(trainTripId("S01700", 9600, day));
    expect(obs[1]!.stopSequence).toBe(2);
  });
  it("never reports future stops as on time", () => {
    expect(viaggiatrenoAdapter(train, ctx).some((o) => o.stopId === "S01500")).toBe(false);
  });
  it("discards implausible delays and malformed responses", () => {
    const bad = { ...train, fermate: [{ id: "X", progressivo: 1, arrivoReale: 1, ritardoArrivo: 5000 }] };
    expect(viaggiatrenoAdapter(bad, ctx)).toEqual([]);
    expect(viaggiatrenoAdapter(null, ctx)).toEqual([]);
    expect(viaggiatrenoAdapter({}, ctx)).toEqual([]);
  });
  it("round-trips the trip id", () => {
    expect(parseTrainTripId(trainTripId("S01700", 9600, day))).toEqual({ codOrigine: "S01700", numero: "9600", serviceDayMs: String(day) });
    expect(parseTrainTripId("garbage")).toBeNull();
  });
});

import { tripUpdatesSeqAdapter } from "../shared/adapters/gtfsrt.ts";
describe("trip updates by stop sequence (START Romagna)", () => {
  const sched = (t: string, s: number) => (t === "fc:T1" ? { stopId: `fc:S${s}`, time: `10:${String(s * 5).padStart(2, "0")}:00` } : null);
  // 2026-10-12 10:00 local = 08:00 UTC; header at 10:12 local
  const header = Date.UTC(2026, 9, 12, 8, 12) / 1000;
  const feed = { header: { timestamp: header }, entity: [{ id: "1", tripUpdate: { trip: { tripId: "fc:T1", startDate: "20261012", routeId: "fc:R" }, stopTimeUpdate: [
    { stopSequence: 1, arrival: { delay: 240 } }, { stopSequence: 4, arrival: { delay: 300 } }] } }] };
  const out = tripUpdatesSeqAdapter(feed, { feedId: "f", timezone: "Europe/Rome", fetchedAt: header, schedule: sched });
  it("passed stop is a fact, stop ahead is a forecast with the predicted time", () => {
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ stopId: "fc:S1", delaySec: 240 });
    expect(out[0]!.predictedAt).toBeUndefined();
    expect(out[1]).toMatchObject({ stopId: "fc:S4", delaySec: 300, predictedAt: Date.UTC(2026, 9, 12, 8, 25) / 1000 });
  });
  it("skips trips and stops the timetable does not know", () => {
    const f2 = { entity: [{ tripUpdate: { trip: { tripId: "fc:X" }, stopTimeUpdate: [{ stopSequence: 1, arrival: { delay: 10 } }] } }] };
    expect(tripUpdatesSeqAdapter(f2, { feedId: "f", timezone: "Europe/Rome", fetchedAt: header, schedule: sched })).toEqual([]);
  });
});

import { parseOccupancy, parseVehiclePositions } from "../shared/adapters/gtfsrt.ts";
describe("vehicle feed readers", () => {
  const feed = { entity: [
    { vehicle: { trip: { tripId: "t1" }, timestamp: 1000, position: { latitude: 44.1, longitude: 12.2, bearing: 90 }, occupancyStatus: 2 } },
    { vehicle: { trip: { tripId: "t2" }, position: { latitude: 0, longitude: 0 }, occupancyStatus: "MANY_SEATS_AVAILABLE" } },
    { vehicle: { position: { latitude: 44, longitude: 12 } } },
  ] };
  it("keeps real positions only", () => { expect(parseVehiclePositions(feed, 5)).toEqual([{ tripId: "t1", at: 1000, lat: 44.1, lon: 12.2, bearing: 90 }]); });
  it("reads occupancy as a number or a name", () => { expect(parseOccupancy(feed, 5).map((o) => o.level)).toEqual([2, 1]); });
});
