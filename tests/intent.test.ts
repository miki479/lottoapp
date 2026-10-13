import { describe, expect, it } from "vitest";
import { ANCHOR_RADIUS_M, classify, dwellMs, leisureTime, shouldAsk, updateAnchor, type Anchor, type Sample } from "../web/src/lib/intent.ts";
import { boundingBox, distanceM, inBox, roundCoord, validPoint } from "../shared/geo.ts";
import { createRateLimiter, parseNearbyRequest } from "../shared/nearby.ts";

const FORLI = { lat: 44.2227, lon: 12.0407 };
const at = (dLat: number, dLon: number, t: number, accuracy = 10): Sample => ({ lat: FORLI.lat + dLat, lon: FORLI.lon + dLon, accuracy, t });

describe("geography", () => {
  it("distance of about 111 m per 0.001 degree of latitude", () => { expect(Math.round(distanceM(0.5, 10, 0.501, 10))).toBe(111); });
  it("the box contains the circle", () => {
    const b = boundingBox(FORLI.lat, FORLI.lon, 250);
    expect(inBox(b, FORLI.lat + 0.002, FORLI.lon)).toBe(true);
    expect(inBox(b, FORLI.lat + 0.003, FORLI.lon)).toBe(false);
  });
  it("rounds to a ~100 m grid and rejects broken positions", () => {
    expect(roundCoord(44.222749)).toBe(44.223);
    expect(validPoint(0, 0)).toBe(false); expect(validPoint(NaN, 12)).toBe(false); expect(validPoint(91, 0)).toBe(false); expect(validPoint(44.2, 12)).toBe(true);
  });
  it("parses and rounds a request, clamping the radius", () => {
    expect(parseNearbyRequest({ lat: 44.222749, lon: 12.040712, radiusM: 9999 })).toEqual({ lat: 44.223, lon: 12.041, radiusM: 250 });
    expect(parseNearbyRequest({ lat: "x", lon: 1 })).toBeNull();
    expect(parseNearbyRequest(null)).toBeNull();
  });
});

describe("rate limiter", () => {
  it("allows N per window and then waits", () => {
    const l = createRateLimiter(2, 1000);
    expect(l.hit("u", 0)).toBe(true); expect(l.hit("u", 10)).toBe(true); expect(l.hit("u", 20)).toBe(false);
    expect(l.hit("v", 20)).toBe(true);
    expect(l.hit("u", 1100)).toBe(true);
  });
});

describe("intent", () => {
  it("walking past never becomes waiting", () => {
    let a: Anchor | null = null;
    for (let i = 0; i < 20; i++) a = updateAnchor(a, at(i * 0.0004, 0, i * 5000)); // ~45 m every 5 s
    expect(dwellMs(a, 100_000)).toBeLessThanOrEqual(5_000);
    expect(classify({ anchor: a, now: 100_000, nearestStopM: 20, home: null })).toBe("passing");
  });
  it("staying next to a stop turns into waiting, a bit slower when further from it", () => {
    let a: Anchor | null = null;
    for (let i = 0; i <= 13; i++) a = updateAnchor(a, at(0.00001 * (i % 3), 0, i * 5000));
    expect(classify({ anchor: a, now: 65_000, nearestStopM: 25, home: null })).toBe("waiting");
    expect(classify({ anchor: a, now: 15_000, nearestStopM: 25, home: null })).toBe("passing");
    expect(classify({ anchor: a, now: 65_000, nearestStopM: 70, home: null })).toBe("waiting");
    expect(classify({ anchor: a, now: 40_000, nearestStopM: 70, home: null })).toBe("passing");
    expect(classify({ anchor: a, now: 65_000, nearestStopM: 150, home: null })).toBe("passing");
  });
  it("vague readings are ignored and small jitter keeps the same stay", () => {
    let a = updateAnchor(null, at(0, 0, 0));
    a = updateAnchor(a, at(0.01, 0, 1000, 500));
    expect(a!.since).toBe(0);
    a = updateAnchor(a, at(0.0002, 0.0001, 2000));
    expect(a!.since).toBe(0);
    a = updateAnchor(a, at(0.002, 0, 3000));
    expect(a!.since).toBe(3000);
    expect(ANCHOR_RADIUS_M).toBeGreaterThan(0);
  });
  it("home: at the saved place, or staying put for a long time away from stops", () => {
    const a = updateAnchor(null, at(0, 0, 0))!;
    expect(classify({ anchor: a, now: 5_000, nearestStopM: null, home: FORLI })).toBe("home");
    expect(classify({ anchor: a, now: 5_000, nearestStopM: null, home: { lat: 45, lon: 9 } })).toBe("passing");
    expect(classify({ anchor: a, now: 16 * 60_000, nearestStopM: null, home: null })).toBe("home");
    expect(classify({ anchor: null, now: 0, nearestStopM: null, home: FORLI })).toBe("unknown");
  });
  it("asks the server after a short stay, then at most once a minute, sooner after moving", () => {
    const a = updateAnchor(null, at(0, 0, 0))!;
    expect(shouldAsk(a, 10_000, null)).toBe(false);
    expect(shouldAsk(a, 21_000, null)).toBe(true);
    expect(shouldAsk(a, 40_000, { ...FORLI, at: 21_000 })).toBe(false);
    expect(shouldAsk(a, 90_000, { ...FORLI, at: 21_000 })).toBe(true);
    const moved = { ...a, lat: a.lat + 0.01, since: 50_000 };
    expect(shouldAsk(moved, 80_000, { ...FORLI, at: 60_000 })).toBe(true);
  });
  it("evenings and weekends are leisure time", () => {
    expect(leisureTime(new Date(2026, 9, 14, 21, 0))).toBe(true);   // Wednesday evening
    expect(leisureTime(new Date(2026, 9, 14, 10, 0))).toBe(false);  // Wednesday morning
    expect(leisureTime(new Date(2026, 9, 17, 10, 0))).toBe(true);   // Saturday
  });
});
