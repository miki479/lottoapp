import { payout } from "./wallet.ts";
import type { BetStatus, Outcome } from "./types.ts";

export interface OpenBet {
  pick: Outcome;
  stake: number;
  /** Odds locked when the bet was placed. */
  odds: number;
}

export type SettleResult = Outcome | "void";

/** What a bet becomes once its market is settled. A void market always refunds the stake. */
export function settleBet(bet: OpenBet, result: SettleResult): { status: Exclude<BetStatus, "open">; payout: number } {
  if (result === "void") return { status: "void", payout: bet.stake };
  if (bet.pick === result) return { status: "won", payout: payout(bet.stake, bet.odds) };
  return { status: "lost", payout: 0 };
}
