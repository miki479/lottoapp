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

/** What a settled bet changed in the balance, counted from before the bet was placed: the profit when won, minus the stake when lost, nothing when it was refunded. */
export const netOf = (b: { status: string; stake: number; payout: number }): number => (b.status === "won" ? b.payout - b.stake : b.status === "lost" ? -b.stake : 0);

/**
 * The balance before and after one result, for the outcome screen. The balance now already holds every result that has not been looked at yet, so the
 * results are laid out one after the other, the last one ending at the balance now: the one on screen ends where the ones still to be seen begin. The
 * "before" is the balance without that result (derived: the Bank's small withholding on a win is not something the client can see). Null for a refund.
 */
export function balanceMove(unseen: readonly { id: string; status: string; stake: number; payout: number }[], current: { id: string; status: string; stake: number; payout: number }, credits: number): { before: number; after: number } | null {
  if (current.status === "void") return null;
  const order = unseen.some((b) => b.id === current.id) ? unseen : [current, ...unseen], at = order.findIndex((b) => b.id === current.id);
  const after = credits - order.slice(at + 1).reduce((a, b) => a + netOf(b), 0);
  return { before: after - netOf(current), after };
}
