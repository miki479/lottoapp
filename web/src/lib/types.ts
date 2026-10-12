import type { MarketRow } from "./format.ts";

export type Pick = "yes" | "no";
export interface LiveOcc { market_id: string; level: number; at: string }
export interface LiveDelay { market_id: string; delay_sec: number; observed_at: string; is_forecast: boolean; prev_delay_sec: number | null }
export interface SlipLeg { m: import("./format.ts").MarketRow; pick: Pick }
export interface ParlayRow { id: string; boosted?: boolean; stake: number; odds: number; status: "open" | "won" | "lost" | "void"; payout: number; placed_at: string; settled_at: string | null; parlay_legs: { market_id: string; pick: Pick; odds: number; status: string; markets: { city_id: string; kind: string; params: Record<string, unknown> } }[] }
export interface QuestRow { id: string; kind: "daily" | "once"; reward: number; done: boolean; claimed: boolean }
export interface ActivityRow { kind: "placed" | "won" | "lost"; who: string | null; amount: number; market_kind: string; label: string; city_id: string; at: string }
export interface ResultRow { target_at?: string; id: string; city_id: string; kind: MarketRow["kind"]; status: string; outcome: string | null; void_reason: string | null; params: Record<string, unknown>; evidence: { delaySec?: number } | null }
export interface Profile {
  id: string; credits: number; city_id: string; locale: string; timezone: string; country: string | null;
  streak: number; best_streak: number; freezes: number; boosts: number; push_flash?: boolean; push_streak?: boolean; push_friends?: boolean; display_name: string | null; last_play_date: string | null;
}
export interface Progress { day: string; bus: number; train: number; weather: number; traffic: number; bonus_claimed: boolean }
export interface MyBet {
  id: string; pick: Pick; stake: number; odds: number; status: "open" | "won" | "lost" | "void"; payout: number; boosted?: boolean; vice_pct?: number; bonus?: "free" | "few" | "standing" | null; bonus_hit?: boolean | null;
  markets: MarketRow & { void_reason: string | null; outcome: string | null; evidence: { occ?: number; level?: number; delaySec?: number; precipitationMm?: number; value?: number; count?: number; maxMag?: number; present?: number; avgKmh?: number; home?: number; away?: number } | null };
}
export interface LbRow { rank: number; user_id: string; display_name: string; score: number; bets: number; streak: number; is_me: boolean }
export interface GroupRow { code: string; name: string }
export interface MyStats { total: number; won: number; lost: number; voided: number; best_win: number; net: number; staked: number }
export interface PopularRow { market_id: string; bets: number; staked: number }

export interface DailyMissionsData { day: string; missions: { id: string; tier: number; target: number; reward: number; progress: number; claimed: boolean }[]; chest: { reward: number; boosts: number; ready: boolean; claimed: boolean } }
export interface FlashData { id: string; target: number; reward: number; boosts: number; start: string; end: string; progress: number; claimed: boolean }
