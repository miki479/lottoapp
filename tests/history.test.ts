import { describe, expect, it } from "vitest";
import { buildRecord, lineKey, type Closed } from "../web/src/lib/history.ts";
import { moveOf } from "../web/src/lib/oddsmove.ts";

const NOW = Date.parse("2026-10-14T12:00:00Z");
const day = (back: number, hour = 8) => new Date(NOW - back * 86_400_000 + (hour - 12) * 3_600_000).toISOString();
const closed = (back: number, delaySec: number, outcome: "yes" | "no", threshold = 300): Closed => ({ target_at: day(back), outcome, delay: delaySec, threshold });

describe("the record of a line", () => {
  it("counts the days with something measured, the late ones, the mean and the worst", () => {
    const rec = buildRecord([closed(0, 840, "yes"), closed(1, 120, "no"), closed(2, 600, "yes"), closed(3, 0, "no")], "Europe/Rome", NOW)!;
    expect(rec.days).toBe(4);
    expect(rec.lateDays).toBe(2);
    expect(rec.avgMin).toBe(6.5);
    expect(rec.worstMin).toBe(14);
    expect(rec.thresholdMin).toBe(5);
    expect(rec.points.length).toBe(7);
    expect(rec.points.map((p) => p.delaySec)).toEqual([null, null, null, 0, 600, 120, 840]);
  });
  it("takes the worst delay of a day when several questions closed that day", () => {
    const rec = buildRecord([closed(0, 120, "no"), closed(0, 900, "yes"), closed(1, 60, "no")], "Europe/Rome", NOW)!;
    expect(rec.points[6]).toMatchObject({ delaySec: 900, late: true });
    expect(rec.lateDays).toBe(1);
  });
  it("has no record under two days of data, and ignores what is older than a week or unmeasured", () => {
    expect(buildRecord([closed(0, 300, "yes")], "Europe/Rome", NOW)).toBeNull();
    expect(buildRecord([closed(0, 300, "yes"), closed(9, 400, "yes"), { target_at: day(1), outcome: "no", delay: null, threshold: 300 }], "Europe/Rome", NOW)).toBeNull();
    expect(buildRecord([], "Europe/Rome", NOW)).toBeNull();
  });
  it("only delay questions of a named line have a record", () => {
    expect(lineKey({ kind: "train_delay_gt", city_id: "italia", params: { routeName: "REG 12552" } })).toBe("train_delay_gt|italia|REG 12552");
    expect(lineKey({ kind: "rain_at", city_id: "rome", params: {} })).toBeNull();
    expect(lineKey({ kind: "bus_delay_gt", city_id: "rome", params: {} })).toBeNull();
  });
});

describe("the movement of a quote", () => {
  it("shows an arrow from three hundredths on, and the size of the move", () => {
    expect(moveOf(1.6, 1.56)).toEqual({ dir: "down", delta: 0.04 });
    expect(moveOf(2.1, 2.5)).toEqual({ dir: "up", delta: 0.4 });
    expect(moveOf(1.56, 1.57)).toBeNull();
    expect(moveOf(3, 3)).toBeNull();
  });
});
