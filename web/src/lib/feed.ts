import type { ComponentChildren } from "preact";

/** One line of a live strip: what a player did, or what a line or a market is doing. */
export interface FeedItem {
  id: string;
  node: ComponentChildren;
  /** The sentence as plain text, to spot lines that say the same thing. */
  text: string;
  /** The player behind the line, when it is something a player did. */
  who?: string | null;
  /** Always in the strip (a rare event worth showing at once, like a legendary purchase). */
  pin?: boolean;
}

export interface FeedRules {
  /** Lines in the strip at most. */
  max: number;
  /** Lines of one player at most. */
  perUser: number;
  /** Share of the strip that may be players' doings; the rest is what the lines and the markets are doing. */
  userShare: number;
}
export const TICKER_RULES: FeedRules = { max: 10, perUser: 2, userShare: 0.4 };

const key = (s: string) => s.trim().toLowerCase();

/**
 * The lines of a strip, both lists newest first: identical lines are dropped, one player gets at most `perUser` lines and the players are at most `userShare`
 * of the strip (two system lines for every player's line), never two lines in a row from the same player, not even where the strip starts over.
 */
export function pickFeed(users: readonly FeedItem[], system: readonly FeedItem[], rules: FeedRules = TICKER_RULES): FeedItem[] {
  const seen = new Set<string>();
  const fresh = (list: readonly FeedItem[]) => list.filter((it) => { const k = key(it.text); if (!k || seen.has(k)) return false; seen.add(k); return true; });
  const sys = fresh(system), per = new Map<string, number>();
  const usr = fresh(users).filter((it) => { const k = key(it.who ?? ""), n = per.get(k) ?? 0; if (n >= rules.perUser) return false; per.set(k, n + 1); return true; }).slice(0, Math.max(1, Math.floor(rules.max * rules.userShare)));
  const out: FeedItem[] = [];
  let u = 0, s = 0, turn = 0;
  while (out.length < rules.max && (u < usr.length || s < sys.length)) {
    // system, player, system, system, player, system …: a player's line never comes first and never twice in a row
    const next = turn++ % 3 === 1 && u < usr.length ? usr[u++] : s < sys.length ? sys[s++] : usr[u++];
    const prev = out[out.length - 1];
    if (next && prev?.who && next.who && key(prev.who) === key(next.who)) continue;
    if (next) out.push(next);
  }
  const first = out[0], last = out[out.length - 1];
  if (out.length > 1 && first?.who && last?.who && key(first.who) === key(last.who)) out.pop();
  return out;
}

/**
 * "Friends are betting": the open questions friends have put credits on, the busiest first, at most `max`. They are distinct questions with the number of
 * friends in each, never a list of what one player did, so the block cannot read as a single person's log.
 */
export function friendRows<T extends { id: string; closes_at: string; params?: Record<string, unknown> }>(markets: readonly T[] | null, bets: Record<string, number>, nowMs: number, max = 3): { m: T; n: number }[] {
  const byId = new Map((markets ?? []).filter((m) => !m.params?.testOnly && !m.params?.ladderOf).map((m) => [m.id, m] as const));
  return Object.entries(bets)
    .filter(([id, n]) => n > 0 && byId.has(id) && Date.parse(byId.get(id)!.closes_at) > nowMs)
    .sort((a, b) => b[1] - a[1] || Date.parse(byId.get(a[0])!.closes_at) - Date.parse(byId.get(b[0])!.closes_at))
    .slice(0, max)
    .map(([id, n]) => ({ m: byId.get(id)!, n }));
}
