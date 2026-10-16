import type { MyBet } from "./types.ts";

/** A result is announced only while it is news. On a new device (or after the browser's storage is cleared) the list of bets already seen is empty:
 *  without this, every old settled bet would come back as a fresh win or loss, looking like bets that were never made. */
export const RESULT_FRESH_MS = 72 * 3600_000;

export function unseenResults(bets: readonly MyBet[], seen: ReadonlySet<string>, now: number): MyBet[] {
  return bets.filter((b) => b.status !== "open" && !seen.has(b.id) && (!b.settled_at || now - Date.parse(b.settled_at) < RESULT_FRESH_MS));
}
