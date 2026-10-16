/** The Bank (savings vault). Mirrors `bank_*` in supabase/migrations/0097_bank.sql, fake credits only. */
export const BANK_RATE_PCT = 3;            // share of the profit of a winning payout that is set aside
export const BANK_CAP = 3000;              // most principal a player can hold in the vault
export const BANK_LOCK_DAYS = 3;           // no withdrawal before this
export const BANK_FULL_DAYS = 14;          // the multiplier stops growing here
export const BANK_MAX_MULT_BPS = 15000;    // 1.50x
const DAY_SEC = 86400;

/** Credits set aside from a winning payout: 3% of the profit, rounded down, never above the room left in the vault. */
export function bankWithhold(payout: number, stake: number, vaultPrincipal: number): number {
  const profit = payout - stake;
  if (!(profit > 0)) return 0;
  const room = Math.max(0, BANK_CAP - vaultPrincipal);
  return Math.min(Math.floor((profit * BANK_RATE_PCT) / 100), room);
}

/** A deposit can be claimed once the lock is over. */
export function bankMatured(ageSec: number): boolean {
  return ageSec >= BANK_LOCK_DAYS * DAY_SEC;
}

/** Multiplier in basis points: 10000 at day 3, growing linearly to 15000 at day 14, flat after. */
export function bankMultBps(ageSec: number): number {
  if (!Number.isFinite(ageSec)) return 10000;
  const span = (BANK_FULL_DAYS - BANK_LOCK_DAYS) * DAY_SEC;
  const into = Math.min(span, Math.max(0, ageSec - BANK_LOCK_DAYS * DAY_SEC));
  return 10000 + Math.floor(((BANK_MAX_MULT_BPS - 10000) * into) / span);
}

/** What claiming one deposit pays: principal times the multiplier, rounded down. 0 while still locked. */
export function bankClaimValue(amount: number, ageSec: number): number {
  return bankMatured(ageSec) ? Math.floor((amount * bankMultBps(ageSec)) / 10000) : 0;
}

export interface BankDeposit { amount: number; ageSec: number }
/** Totals shown to the player. */
export function bankSummary(deps: BankDeposit[]): { locked: number; matured: number; claimable: number } {
  let locked = 0, matured = 0, claimable = 0;
  for (const d of deps) {
    if (bankMatured(d.ageSec)) { matured += d.amount; claimable += bankClaimValue(d.amount, d.ageSec); } else locked += d.amount;
  }
  return { locked, matured, claimable };
}
