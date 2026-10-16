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

import { extractArrivals, offerWindowOk, buildStopMarket, hms, delayDedupeKey } from "../shared/nearby.ts";

const NOW = 1_800_000_000;
const feed = (stu: Record<string, unknown>[], tripId = "T1") => ({ header: { timestamp: NOW }, entity: [{ id: "1", tripUpdate: { trip: { tripId, routeId: "R9" }, stopTimeUpdate: stu } }] }) as never;

describe("arrivals from a live feed", () => {
  it("lists the trips the feed expects at the wanted stop, soonest first, with the schedule from time minus delay", () => {
    const f = { header: { timestamp: NOW }, entity: [
      { id: "1", tripUpdate: { trip: { tripId: "A", routeId: "R1" }, stopTimeUpdate: [{ stopId: "S1", stopSequence: 3, arrival: { time: NOW + 600, delay: 120 } }, { stopId: "S2", arrival: { time: NOW + 900 } }] } },
      { id: "2", tripUpdate: { trip: { tripId: "B", routeId: "R2" }, stopTimeUpdate: [{ stopId: "S1", arrival: { time: NOW + 300, delay: 0 } }] } },
      { id: "3", tripUpdate: { trip: { tripId: "C", routeId: "R3", scheduleRelationship: "CANCELED" }, stopTimeUpdate: [{ stopId: "S1", arrival: { time: NOW + 400 } }] } },
      { id: "4", tripUpdate: { trip: { tripId: "D", routeId: "R4" }, stopTimeUpdate: [{ stopId: "S1", arrival: { time: NOW + 5000 } }] } },
    ] } as never;
    const out = extractArrivals(f, { kind: "trip_updates", stopIds: new Set(["S1"]), now: NOW });
    expect(out.map((a) => a.tripId)).toEqual(["B", "A"]);
    expect(out[1]!.scheduledAt).toBe(NOW + 480);
    expect(out[1]!.delaySec).toBe(120);
  });
  it("skips skipped stops and stops without a time", () => {
    const out = extractArrivals(feed([{ stopId: "S1", scheduleRelationship: "SKIPPED", arrival: { time: NOW + 100 } }, { stopId: "S1", arrival: { delay: 30 } }]), { kind: "trip_updates", stopIds: new Set(["S1"]), now: NOW });
    expect(out).toEqual([]);
  });
  it("an offer needs the schedule time 5 to 60 minutes away", () => {
    expect(offerWindowOk(NOW + 4 * 60, NOW)).toBe(false);
    expect(offerWindowOk(NOW + 10 * 60, NOW)).toBe(true);
    expect(offerWindowOk(NOW + 61 * 60, NOW)).toBe(false);
    expect(offerWindowOk(null, NOW)).toBe(false);
  });
  it("builds a market that closes before the scheduled time and matches the generator's key", () => {
    const m = buildStopMarket({ cityId: "romagna", tz: "Europe/Rome", feedId: "start-trip-updates", category: "bus", routeId: "R1", routeName: "11", headsign: "Centro", tripId: "A", stopId: "S1", stopName: "Via Seganti", stopLat: 44.22, stopLon: 12.04, stopSequence: 3, scheduledAt: NOW + 900, delaySec: null, history: null, priorYes: 0.3, now: NOW });
    expect(Date.parse(m.target_at) / 1000).toBe(NOW + 900);
    expect(Date.parse(m.closes_at)).toBeLessThan(Date.parse(m.target_at));
    expect(m.params.nearby).toBe(true);
    expect(m.dedupe_key).toBe(delayDedupeKey(m));
    expect(hms(3661)).toBe("01:01:01");
  });
});

import { matchGame, parseEspn, sameTeam } from "../shared/live.ts";
describe("live scores", () => {
  it("recognises the same team under different spellings", () => {
    expect(sameTeam("AS Roma", "Roma")).toBe(true); expect(sameTeam("Inter", "Inter Milan")).toBe(true); expect(sameTeam("Hellas Verona", "Verona")).toBe(true);
    expect(sameTeam("Lazio", "Juventus")).toBe(false);
  });
  it("parses a scoreboard and finds our match by teams and start time", () => {
    const j = { events: [{ date: "2026-10-12T18:45Z", status: { type: { state: "in" }, period: 2, displayClock: "63'" }, competitions: [{ competitors: [{ homeAway: "home", score: "1", team: { displayName: "Juventus" } }, { homeAway: "away", score: "0", team: { displayName: "Cagliari" } }] }] }] };
    const g = parseEspn(j);
    expect(g).toHaveLength(1);
    const f = matchGame(g, { home: "Juventus", away: "Cagliari", kickoff: Date.parse("2026-10-12T18:45Z") / 1000 });
    expect(f?.hs).toBe(1); expect(f?.state).toBe("in");
    expect(matchGame(g, { home: "Juventus", away: "Cagliari", kickoff: Date.parse("2026-10-13T18:45Z") / 1000 })).toBeNull();
  });
});
