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
  train_delay_gt: 0.12,
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
