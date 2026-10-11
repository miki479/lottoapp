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
