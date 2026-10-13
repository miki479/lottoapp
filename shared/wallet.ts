import { localDateString } from "./time.ts";

export const START_CREDITS = 1000;
export const REFILL_THRESHOLD = 100;
export const REFILL_TO = 250;
export const MIN_STAKE = 10;
export const MAX_STAKE = 100_000;
/** Mirrors `stake_cap` in the database: a token stake below 1.10 (the result is all but known), then more as the odds grow. */
/** On an all-but-decided outcome only a token stake is allowed: the pick can still be made for fun, it just cannot be milked. */
export const FUN_STAKE = 20;
/** A big balance cannot go all on one question: up to 5000, or a quarter of the balance if that is more. Mirrors place_bet. */
export const balanceStakeCap = (balance: number): number => Math.max(5000, Math.floor(Math.max(0, balance) * 0.25));
export function stakeCap(odds: number): number {
  return odds < 1.1 ? FUN_STAKE : odds < 1.3 ? 200 : odds < 1.6 ? 2000 : odds < 2.2 ? 10000 : MAX_STAKE;
}

export function validateStake(stake: number, balance: number): "ok" | "not_integer" | "too_low" | "too_high" | "insufficient" {
  if (!Number.isInteger(stake)) return "not_integer";
  if (stake < MIN_STAKE) return "too_low";
  if (stake > MAX_STAKE) return "too_high";
  if (stake > balance) return "insufficient";
  return "ok";
}

/** Gross return for a winning bet (stake included). Always an integer number of credits. */
export function payout(stake: number, odds: number): number {
  return Math.floor(stake * odds);
}

/**
 * Daily top-up: once per local day, and only when the balance is under the threshold.
 * Returns the new balance and the date to store, or null when nothing is due.
 */
export function dailyRefill(
  balance: number,
  lastRefillDate: string | null,
  nowEpochSec: number,
  tz: string,
): { balance: number; refillDate: string } | null {
  const today = localDateString(nowEpochSec, tz);
  if (lastRefillDate === today) return null;
  if (balance >= REFILL_THRESHOLD) return null;
  return { balance: REFILL_TO, refillDate: today };
}

export const BOOST_MAX_EXTRA = 1000;
/** A boost doubles the NET win of one bet (stake x odds - stake), the extra being capped at BOOST_MAX_EXTRA. Mirrors the SQL in migration 0015. */
export function boostedPayout(stake: number, odds: number): number {
  const base = payout(stake, odds);
  return base + Math.min(BOOST_MAX_EXTRA, base - stake);
}
