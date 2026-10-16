import { describe, expect, it } from "vitest";
import { historyKey, marketToEvent, type MarketRow } from "../shared/market.ts";

const row: MarketRow = {
  id: "m1", city_id: "rome", category: "bus", kind: "bus_delay_gt", feed_id: "f",
  params: { routeId: "64", tripId: "t", stopId: "s", thresholdSec: 180 },
  closes_at: "2026-10-11T07:00:00Z", target_at: "2026-10-11T07:10:00Z", deadline_at: "2026-10-11T07:40:00Z",
};
describe("market rows", () => {
  it("maps a delay row to an event with epoch seconds", () => {
    const ev = marketToEvent(row);
    expect(ev).toMatchObject({ kind: "bus_delay_gt", routeId: "64", thresholdSec: 180, targetAt: Date.parse(row.target_at) / 1000 });
  });
  it("maps train and rain rows", () => {
    expect(marketToEvent({ ...row, kind: "train_delay_gt", category: "train" })).toMatchObject({ category: "train" });
    expect(marketToEvent({ ...row, kind: "rain_at", category: "weather", params: {} })).toMatchObject({ kind: "rain_at", minMm: 0.1 });
  });
  it("rejects unknown kinds", () => {
    expect(() => marketToEvent({ ...row, kind: "nope" })).toThrow();
  });
  it("buckets history by the city's local hour", () => {
    // 07:10 UTC is 09:10 in Rome (CEST) and 16:10 in Tokyo
    expect(historyKey(marketToEvent(row), "Europe/Rome").hourOfDay).toBe(9);
    expect(historyKey(marketToEvent(row), "Asia/Tokyo").hourOfDay).toBe(16);
  });
});

describe("regional earthquake markets", () => {
  it("reads the bounding box and keeps worldwide questions box-free", () => {
    const base = { id: "q", city_id: "world", category: "nature" as const, kind: "quake_m", feed_id: "usgs", closes_at: "2026-10-12T09:00:00Z", target_at: "2026-10-12T12:00:00Z", deadline_at: "2026-10-12T22:00:00Z" };
    const jp = marketToEvent({ ...base, params: { minMag: 5, region: "jp", bbox: [24, 46, 122, 146] } });
    expect(jp).toMatchObject({ kind: "quake_m", minMag: 5, bbox: [24, 46, 122, 146] });
    expect((marketToEvent({ ...base, params: { minMag: 5 } }) as { bbox?: unknown }).bbox).toBeUndefined();
  });
});
