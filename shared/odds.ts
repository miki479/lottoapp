/**
 * Odds are computed from history. While history is thin we fall back on fixed starting
 * probabilities, blended in as a Beta prior so the transition is smooth.
 */
export const HOUSE_MARGIN = 0.08;
export const PRIOR_STRENGTH = 10; // pseudo-observations behind the fixed starting probability
export const MIN_ODDS = 1.01;
export const MAX_ODDS = 15;
export const FLASH_MAX_MULTIPLIER = 3;

/** Fixed starting probabilities of the "yes" outcome, used until history exists. */
export const DEFAULT_YES_PROBABILITY = {
  bus_delay_gt: 0.3,
  train_delay_gt: 0.05,
  rain_at: 0.25,
} as const;

export interface History {
  /** Number of past comparable observations. */
  n: number;
  /** How many of them resolved "yes". */
  yes: number;
}

export function yesProbability(history: History | null, prior: number): number {
  const n = history?.n ?? 0;
  const yes = Math.min(history?.yes ?? 0, n);
  const p = (yes + prior * PRIOR_STRENGTH) / (n + PRIOR_STRENGTH);
  return Math.min(0.97, Math.max(0.03, p));
}

/** A starting probability corrected by what actually happened: `yes` of `n` comparable questions, with the fixed guess worth `strength` questions. */
export function learnedPrior(yes: number, n: number, base: number, strength = 10): number {
  const p = (Math.min(Math.max(0, yes), Math.max(0, n)) + base * strength) / (Math.max(0, n) + strength);
  return Math.min(0.9, Math.max(0.03, p));
}

export interface Odds {
  yes: number;
  no: number;
  pYes: number;
}

export function computeOdds(pYes: number, flashMultiplier = 1): Odds {
  const mult = Math.min(FLASH_MAX_MULTIPLIER, Math.max(1, flashMultiplier));
  const price = (p: number) => {
    const raw = ((1 - HOUSE_MARGIN) / p) * mult;
    const clamped = Math.min(MAX_ODDS * mult, Math.max(MIN_ODDS, raw));
    return Math.round(clamped * 100) / 100;
  };
  return { yes: price(pYes), no: price(1 - pYes), pYes };
}

/**
 * A delay market is priced from history when it opens, but a bus or train already running late is far more
 * likely to still be late at the question's stop. From a live reading of the delay a few stops earlier,
 * estimate the chance that the delay at the target stop exceeds the threshold: the delay recovers a little per stop
 * and the uncertainty grows with the stops left. Close to the stop the live reading dominates; far away history still counts.
 */
export interface DelayContext {
  /** Local hour of the day (0-23.99) at the stop, and whether it is a weekday: rush hours pile delays up, empty nights let services recover. */
  hour?: number | null;
  weekday?: boolean;
}
/** +1 in the commuter rush (weekdays 7-9:30 and 16:30-19:30), -1 at night (22-5), 0 otherwise. */
export function crowding(ctx?: DelayContext): -1 | 0 | 1 {
  const h = ctx?.hour;
  if (h === null || h === undefined || !Number.isFinite(h)) return 0;
  if (ctx?.weekday !== false && ((h >= 7 && h < 9.5) || (h >= 16.5 && h < 19.5))) return 1;
  return h >= 22 || h < 5 ? -1 : 0;
}

/** Local hour and weekday in a time zone at an instant, for the rush-hour effect on delays (unknown zone: no effect). */
export function delayContextAt(tz: string | undefined, nowSec: number): DelayContext {
  if (!tz) return { hour: null, weekday: true };
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(new Date(nowSec * 1000));
    const g = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
    return { hour: Number(g("hour")) + Number(g("minute")) / 60, weekday: !["Sat", "Sun"].includes(g("weekday")) };
  } catch { return { hour: null, weekday: true }; }
}

/** The question each service asks by default (seconds late): a train is late past 5 minutes, a bus past 3. */
export const DELAY_BASE_THRESHOLD = { train: 300, bus: 180 } as const;

/**
 * `pHist` is the chance of being later than the standard threshold (5 min for a train, 3 for a bus). A higher line (the "Ci scusiamo per il disagio" rungs)
 * is far less likely on history alone: the tail thins out by a factor e every 10 minutes (train) or 6 (bus).
 */
export function historyAtThreshold(pHist: number, thresholdSec: number, train: boolean): number {
  const base = train ? DELAY_BASE_THRESHOLD.train : DELAY_BASE_THRESHOLD.bus;
  return pHist * Math.exp(-Math.max(0, thresholdSec - base) / (train ? 600 : 360));
}

/**
 * The delay expected `stopsLeft` stops after a reading of `delaySec` (negative = early): a late service recovers a little per stop, an early or
 * punctual one stays as it is. The one recovery assumption of the app: it prices the live questions (`liveYesProbability`) and fills in the stops
 * still ahead on the "stops" board.
 */
export function expectedDelay(delaySec: number, stopsLeft: number, train: boolean, ctx?: DelayContext): number {
  const n = Math.max(0, stopsLeft);
  const crowd = crowding(ctx);
  // in the rush a late service keeps losing time (crowded platforms), at night it recovers faster
  // a train that is late stays late: a few seconds recovered per stop at most (Italian regional/long-distance delays barely shrink over a run)
  const recover = (train ? 6 : 10) * (crowd > 0 ? 0.3 : crowd < 0 ? 1.5 : 1);
  // the rush-hour drift builds up with the delay already there (none at all on time), so it never jumps at 0
  const drift = crowd > 0 && delaySec > 0 ? (train ? 12 : 8) * n * Math.min(1, delaySec / 120) : 0;
  return delaySec > 0 ? Math.max(0, delaySec - recover * n + drift) : delaySec;
}

/**
 * Chance that the delay at the question's stop is above `thresholdSec`, given the delay read `stopsLeft` stops earlier.
 * Non-increasing in the threshold, non-decreasing in the delay.
 */
export function liveYesProbability(pHist: number, delaySec: number, thresholdSec: number, stopsLeft: number, train: boolean, ctx?: DelayContext): number {
  const n = Math.max(0, stopsLeft);
  const sd = (train ? 45 : 45) + (train ? 22 : 25) * Math.sqrt(n);
  const growth = (train ? 0.12 : 0.08) * Math.max(0, delaySec); // a delay already large can still grow in proportion (only upwards: it recovers little)
  const mean = expectedDelay(delaySec, n, train, ctx);
  const z =(thresholdSec + 0.5 - mean) / (thresholdSec + 0.5 > mean ? sd + growth : sd);
  const pLive = 1 - normalCdf(z);
  const h = historyAtThreshold(pHist, thresholdSec, train);
  const w = 10 / (10 + n);
  let p = w * pLive + (1 - w) * h;
  // A delay already past the line is persistent: a service 20 minutes late does not make it all up in a few stops. Whatever the history says,
  // the chance is the live one less a small allowance for the unexpected (a short-turn, a skipped stop), which grows with the stops left.
  // Taking the larger of the two keeps the quote monotone in the threshold (a line below the delay can only ever get the higher figure).
  if (delaySec >= thresholdSec) p = Math.max(p, pLive * (1 - Math.min(train ? 0.15 : 0.3, (train ? 0.02 : 0.05) + (train ? 0.006 : 0.015) * n)));
  return Math.min(0.97, Math.max(0.03, p));
}

function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/**
 * A rain question priced from the hourly precipitation forecast for its hour (Open-Meteo): the forecast depth against the line
 * decides, the history of past answers counts for more the further away the hour is. A dry forecast never goes under about 17%,
 * so "No" stays a modest, playable price instead of a sure thing.
 */
export function rainYesProbability(forecastMm: number | null, minMm: number, hoursAhead: number, pHist: number): number {
  if (forecastMm === null || !Number.isFinite(forecastMm)) return pHist;
  const r = Math.max(0, forecastMm) / Math.max(0.05, minMm);
  const pf = r < 1 ? 0.17 + 0.27 * r : r < 3 ? 0.44 + 0.22 * (r - 1) : Math.min(0.9, 0.88 + 0.01 * (r - 3));
  const h = Math.max(0, hoursAhead);
  const w = h <= 3 ? 0.9 : h >= 24 ? 0.55 : 0.9 - (0.35 * (h - 3)) / 21;
  return Math.min(0.93, Math.max(0.1, w * pf + (1 - w) * pHist));
}
