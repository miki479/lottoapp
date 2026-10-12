/**
 * Odds are computed from history. While history is thin we fall back on fixed starting
 * probabilities, blended in as a Beta prior so the transition is smooth.
 */
export const HOUSE_MARGIN = 0.08;
export const PRIOR_STRENGTH = 10; // pseudo-observations behind the fixed starting probability
export const MIN_ODDS = 1.1;
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
export function liveYesProbability(pHist: number, delaySec: number, thresholdSec: number, stopsLeft: number, train: boolean): number {
  const n = Math.max(0, stopsLeft);
  const recover = train ? 20 : 10, sd = (train ? 60 : 45) + (train ? 30 : 25) * Math.sqrt(n);
  const mean = delaySec > 0 ? Math.max(0, delaySec - recover * n) : delaySec;
  const z = (thresholdSec + 0.5 - mean) / sd;
  const pLive = 1 - normalCdf(z);
  const w = 10 / (10 + n);
  return Math.min(0.97, Math.max(0.03, w * pLive + (1 - w) * pHist));
}

function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
