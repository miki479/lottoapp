import { distanceM } from "../../../shared/geo.ts";

/** What the phone reports at one moment. */
export interface Sample { lat: number; lon: number; accuracy: number; t: number }
/** The place where the person has been staying: it moves only when they walk away from it. */
export interface Anchor { lat: number; lon: number; since: number; last: number }
/** passing = on the move or just arrived; waiting = staying next to a stop; home = at the saved home place or staying put for long; unknown = nothing to go on. */
export type Situation = "unknown" | "passing" | "waiting" | "home";

/** Closer than this to the anchor still counts as "staying" (walking on the spot, a bench, a shelter). */
export const ANCHOR_RADIUS_M = 25;
/** A reading that is this vague says nothing about where the person is. */
export const MAX_ACCURACY_M = 100;
export const ASK_AFTER_MS = 2_000;
export const WAIT_NEAR_M = 30, WAIT_NEAR_MS = 3_000;
export const WAIT_FAR_M = 80, WAIT_FAR_MS = 15_000;
export const HOME_RADIUS_M = 200, HOME_STAY_MS = 15 * 60_000;

/** Folds a reading into the anchor: inside the radius the person is still in the same place, outside it a new stay starts. Vague readings are ignored. */
export function updateAnchor(a: Anchor | null, s: Sample): Anchor | null {
  if (!(s.accuracy <= MAX_ACCURACY_M)) return a;
  if (!a) return { lat: s.lat, lon: s.lon, since: s.t, last: s.t };
  const slack = Math.min(20, s.accuracy / 3);
  if (distanceM(a.lat, a.lon, s.lat, s.lon) <= ANCHOR_RADIUS_M + slack) return { ...a, last: s.t };
  return { lat: s.lat, lon: s.lon, since: s.t, last: s.t };
}

export const dwellMs = (a: Anchor | null, now: number) => (a ? Math.max(0, now - a.since) : 0);

export interface SituationInput {
  anchor: Anchor | null;
  now: number;
  /** Distance to the nearest stop that has something to bet on, from the server's last answer for this anchor; null when none was found or not asked yet. */
  nearestStopM: number | null;
  home: { lat: number; lon: number } | null;
}

export function classify(i: SituationInput): Situation {
  const a = i.anchor;
  if (!a) return "unknown";
  const dwell = dwellMs(a, i.now), d = i.nearestStopM;
  if (d !== null && ((d <= WAIT_NEAR_M && dwell >= WAIT_NEAR_MS) || (d <= WAIT_FAR_M && dwell >= WAIT_FAR_MS))) return "waiting";
  if (i.home && distanceM(a.lat, a.lon, i.home.lat, i.home.lon) <= HOME_RADIUS_M) return "home";
  if ((d === null || d > WAIT_FAR_M) && dwell >= HOME_STAY_MS) return "home";
  return "passing";
}

/** True when it is time to ask the server what is near: the person has stayed a little, and this stay was not asked about yet (or a minute has passed). */
export function shouldAsk(a: Anchor | null, now: number, lastAsk: { lat: number; lon: number; at: number } | null): boolean {
  if (!a || dwellMs(a, now) < ASK_AFTER_MS) return false;
  if (!lastAsk) return true;
  const moved = distanceM(a.lat, a.lon, lastAsk.lat, lastAsk.lon) > ANCHOR_RADIUS_M;
  return moved ? now - lastAsk.at >= 15_000 : now - lastAsk.at >= 60_000;
}

/** Evening (from 18:00) or a weekend: the time of day when people look for something to do rather than a bus. */
export const leisureTime = (d: Date): boolean => d.getHours() >= 18 || d.getHours() < 2 || d.getDay() === 0 || d.getDay() === 6;
