import { useEffect, useState } from "preact/hooks";
import { sb } from "./api.ts";
import { every } from "./poll.ts";

export interface LiveScore { home: number; away: number; state: "in" | "post"; clock: string }
let scores = new Map<string, LiveScore>();
const subs = new Set<() => void>();
let stop: (() => void) | null = null;

/** One small query for every match being played right now (not one per card): shared by all the cards on screen, refreshed every minute while any is visible. */
async function load(): Promise<void> {
  const { data } = await sb.from("live_scores").select("event_id,home_score,away_score,state,clock").eq("state", "in").limit(200);
  scores = new Map(((data ?? []) as { event_id: string; home_score: number; away_score: number; state: "in" | "post"; clock: string | null }[]).map((r) => [String(r.event_id), { home: r.home_score, away: r.away_score, state: r.state, clock: r.clock ?? "" }]));
  subs.forEach((f) => f());
}

/** The live score of one match (null when it is not being played). */
export function useLiveScore(eventId: unknown): LiveScore | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    subs.add(f);
    if (subs.size === 1) { void load().catch(() => {}); stop = every(() => { void load().catch(() => {}); }, 60_000); }
    return () => { subs.delete(f); if (subs.size === 0) { stop?.(); stop = null; } };
  }, []);
  return eventId === undefined || eventId === null ? null : scores.get(String(eventId)) ?? null;
}
