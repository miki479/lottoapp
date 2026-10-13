// Personal super-odds: pure rules, mirrored by public.make_personal_offers() and public.place_bet() (migration 0096).
export type OfferReason = "absent" | "losses" | "random";
export const OFFER_MULTIPLIERS = [5, 10] as const;
export const OFFER_MAX_STAKE = 20;
export const OFFER_MAX_ODDS = 100;
export const OFFER_GAP_DAYS = 10;
export const OFFER_MAX_PER_RUN = 50;
export const OFFER_ABSENT_DAYS = 5;
export const OFFER_ABSENT_MAX_DAYS = 90;
export const OFFER_LOSSES = { of: 8, atLeast: 6 } as const;
export const OFFER_RANDOM_RATE = 0.02;
export const OFFER_ACTIVE_DAYS = 14;
/** The question closes between these hours from now; both sides must sit in the odds range (a genuinely open question). */
export const OFFER_WINDOW_H = { min: 6, max: 48 } as const;
export const OFFER_ODDS_RANGE = { min: 1.5, max: 4 } as const;
/** At bet time the quote may have drifted, but an all-but-certain pick is never multiplied. */
export const OFFER_MIN_BASE_ODDS = 1.3;

export interface OfferPlayer {
  credits: number;
  absentDays: number | null;            // whole days since last_play_date (null: never played)
  lastSettled: ("won" | "lost")[];      // newest first
  daysSinceLastSettled: number | null;
  daysSinceLastOffer: number | null;    // null: never
  localHour: number;
  roll: number;                         // uniform [0,1)
}
/** Why this player gets an offer (priority: absent, losses, random), or null. */
export function offerReason(p: OfferPlayer): OfferReason | null {
  if (p.credits < 10) return null;
  if (p.daysSinceLastOffer !== null && p.daysSinceLastOffer < OFFER_GAP_DAYS) return null;
  if (p.absentDays !== null && p.absentDays >= OFFER_ABSENT_DAYS && p.absentDays <= OFFER_ABSENT_MAX_DAYS) return "absent";
  const last = p.lastSettled.slice(0, OFFER_LOSSES.of);
  if (last.filter((s) => s === "lost").length >= OFFER_LOSSES.atLeast && p.daysSinceLastSettled !== null && p.daysSinceLastSettled <= 30) return "losses";
  if (p.absentDays !== null && p.absentDays <= OFFER_ACTIVE_DAYS && p.localHour === 10 && p.roll < OFFER_RANDOM_RATE) return "random";
  return null;
}
export const offerMultiplier = (r: OfferReason): 5 | 10 => (r === "random" ? 5 : 10);

export interface OfferMarket { odds_yes: number; odds_no: number; closesInH: number; flash: boolean; delayKind: boolean }
export function marketEligible(m: OfferMarket): boolean {
  const ok = (o: number) => o >= OFFER_ODDS_RANGE.min && o <= OFFER_ODDS_RANGE.max;
  return !m.flash && !m.delayKind && ok(m.odds_yes) && ok(m.odds_no) && m.closesInH >= OFFER_WINDOW_H.min && m.closesInH <= OFFER_WINDOW_H.max;
}

/** The odds locked on the bet: base times multiplier, rounded to cents, never above 100. */
export const offerOdds = (base: number, multiplier: number) => Math.min(OFFER_MAX_ODDS, Math.round(base * multiplier * 100) / 100);
/** What the stake pays if it wins (as the settlement computes it). */
export const offerPayout = (stake: number, base: number, multiplier: number) => Math.floor(stake * offerOdds(base, multiplier));

export type OfferError = "bad_offer" | "offer_used" | "offer_expired" | "stake_too_high" | "odds_too_low";
export interface OfferRow { user_id: string; market_id: string; used_at: string | null; expires_at: string; max_stake: number }
/** Mirrors the checks place_bet makes when an offer is given; null when the bet may go ahead. */
export function offerCheck(o: OfferRow | null, ctx: { userId: string; marketId: string; stake: number; baseOdds: number; now: number; extras?: boolean }): OfferError | null {
  if (!o || o.user_id !== ctx.userId || o.market_id !== ctx.marketId) return "bad_offer";
  if (o.used_at) return "offer_used";
  if (Date.parse(o.expires_at) <= ctx.now) return "offer_expired";
  if (ctx.extras) return "bad_offer";
  if (ctx.stake > o.max_stake) return "stake_too_high";
  if (ctx.baseOdds < OFFER_MIN_BASE_ODDS) return "odds_too_low";
  return null;
}
