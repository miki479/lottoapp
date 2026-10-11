import { describe, expect, it } from "vitest";
import { activeServiceIds, buildDelayMarket, buildWeatherMarkets, localYmd, pickTargetStop, seededRandom, type StopTimeRow } from "../shared/generator.ts";

const cal = (id: string, days: string, start = "20260101", end = "20261231") => {
  const [m, t, w, th, f, s, su] = days.split("").map(String);
  return { service_id: id, monday: m!, tuesday: t!, wednesday: w!, thursday: th!, friday: f!, saturday: s!, sunday: su!, start_date: start, end_date: end };
};

describe("service calendar", () => {
  it("picks services by weekday and date range", () => {
    const c = [cal("wk", "1111100"), cal("we", "0000011"), cal("old", "1111111", "20250101", "20251231")];
    expect([...activeServiceIds("20261012", 1, c, [])]).toEqual(["wk"]);
    expect([...activeServiceIds("20261011", 0, c, [])]).toEqual(["we"]);
  });
  it("applies calendar_dates exceptions", () => {
    const c = [cal("wk", "1111100")];
    const dates = [{ service_id: "wk", date: "20261012", exception_type: "2" }, { service_id: "hol", date: "20261012", exception_type: "1" }];
    expect([...activeServiceIds("20261012", 1, c, dates)]).toEqual(["hol"]);
  });
  it("derives the local date, not the UTC one", () => {
    const e = Date.UTC(2026, 9, 11, 16, 0) / 1000; // 01:00 on the 12th in Tokyo
    expect(localYmd(e, "Asia/Tokyo")).toEqual({ ymd: "20261012", weekday: 1 });
  });
});

describe("market building", () => {
  const stops: StopTimeRow[] = Array.from({ length: 12 }, (_, i) => ({ seq: i + 1, stopId: `s${i + 1}`, time: `08:${String(i * 4).padStart(2, "0")}:00`, timepoint: i % 3 === 0 }));
  it("is deterministic for a given seed and picks from the middle of the trip", () => {
    const a = pickTargetStop(stops, seededRandom("tokyo-20261012"));
    const b = pickTargetStop(stops, seededRandom("tokyo-20261012"));
    expect(a).toEqual(b);
    expect(a!.seq).toBeGreaterThan(3);
    expect(a!.seq).toBeLessThan(10);
    expect(a!.timepoint).toBe(true);
  });
  it("refuses trips that are too short", () => {
    expect(pickTargetStop(stops.slice(0, 3), Math.random)).toBeNull();
  });
  it("builds a delay market with timing, params and odds", () => {
    const day = Date.UTC(2026, 9, 11, 3, 0) / 1000;
    const m = buildDelayMarket({
      cityId: "tokyo", tz: "Asia/Tokyo", feedId: "toei", category: "bus", routeId: "018", routeName: "都01", headsign: "Shibuya",
      tripId: "t1", stop: { seq: 7, stopId: "s7", time: "08:30:00", timepoint: true }, stopName: "Ginza", serviceDayEpoch: day, thresholdSec: 180, history: null,
    });
    expect(m.target_at).toBe("2026-10-10T23:30:00.000Z"); // 08:30 JST
    expect(Date.parse(m.target_at) - Date.parse(m.closes_at)).toBe(600_000);
    expect(m.kind).toBe("bus_delay_gt");
    expect(m.odds_yes).toBeGreaterThan(1);
    expect(m.params).toMatchObject({ tripId: "t1", stopId: "s7", thresholdSec: 180 });
  });
  it("prices from history once it exists", () => {
    const base = { cityId: "x", tz: "UTC", feedId: "f", category: "train" as const, routeId: "r", routeName: "R", headsign: "H", tripId: "t", stop: { seq: 5, stopId: "s", time: "10:00:00", timepoint: true }, stopName: "S", serviceDayEpoch: 1_800_000_000, thresholdSec: 300 };
    const fresh = buildDelayMarket({ ...base, history: null });
    const chaotic = buildDelayMarket({ ...base, history: { n: 400, yes: 300 } });
    expect(chaotic.odds_yes).toBeLessThan(fresh.odds_yes);
    expect(chaotic.odds_no).toBeGreaterThan(fresh.odds_no);
  });
  it("only creates weather markets that are still open", () => {
    const now = Date.UTC(2026, 9, 11, 3, 25) / 1000; // 12:25 JST: the 12:30 market closed at 12:20
    const ms = buildWeatherMarkets({ cityId: "tokyo", tz: "Asia/Tokyo", feedId: "om", nowEpoch: now, localHours: [8, 12, 15, 19] });
    expect(ms.map((m) => (m.params as { localHour: number }).localHour)).toEqual([15, 19]);
  });
});
