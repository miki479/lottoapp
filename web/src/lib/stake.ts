/**
 * The figures around a stake in the bet sheet, pure. What the sheet shows next to the amount (the balance once it is paid, what is lost and what is won
 * on the two outcomes) and when a stake is large enough to be asked about twice. The server keeps the real limits (shared/wallet.ts); nothing here
 * changes a rule, it only reads the numbers.
 */

/** A stake above this share of the balance has to be confirmed a second time. */
export const BIG_STAKE_SHARE = 0.3;

/** The share of the balance a stake is, in whole percent, when it is above the limit; null otherwise (or when there is no balance to compare with). */
export function bigStakePct(amount: number, balance: number): number | null {
  if (!(balance > 0) || !(amount > 0)) return null;
  const share = amount / balance;
  return share > BIG_STAKE_SHARE ? Math.round(share * 100) : null;
}

/** The balance once the stake is paid, never below zero. */
export const balanceAfter = (balance: number, stake: number): number => Math.max(0, Math.floor(balance) - Math.floor(stake));

/** The two sides of a bet in credits: `lose` the stake (negative), `win` what is gained on top of it, `back` what comes back in all when it is won. */
export function outcomes(stake: number, payout: number): { lose: number; win: number; back: number } {
  return { lose: -stake, win: Math.max(0, payout - stake), back: payout };
}
