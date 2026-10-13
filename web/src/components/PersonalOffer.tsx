import { Gift } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { cityName, cityOf } from "../lib/cities.ts";
import { countdown, type MarketRow } from "../lib/format.ts";
import { offerOdds } from "../../../shared/offers.ts";
import { Q } from "./Q.tsx";
import "./PersonalOffer.css";

/** A personal super-odds offer as returned by public.my_offers(). */
export interface Offer { id: string; market_id: string; multiplier: number; max_stake: number; expires_at: string; market: MarketRow }
/** What the bet sheet needs to apply an offer. */
export interface OfferUse { id: string; mult: number; maxStake: number; expiresAt: string }
export const OFFER_EVENT = "ll-offers";
export const offerUse = (o: Offer): OfferUse => ({ id: o.id, mult: o.multiplier, maxStake: o.max_stake, expiresAt: o.expires_at });
/** The odds the bet will be locked at (also shown in the sheet). */
export const offerBetOdds = (base: number, mult: number) => offerOdds(base, mult);

type Key = "it" | "en-US" | "en-GB" | "ja";
const key = (l: Locale): Key => (l === "it" || l === "ja" || l === "en-GB" ? l : "en-US");
const T = {
  it: { label: "Solo per te", sub: (s: number) => `Quota moltiplicata su questa domanda, puntata massima ${s} crediti finti. Un regalo: nessun obbligo.`, left: "Scade tra", go: "Usa la quota", banner: (x: number, s: number) => `Quota speciale ×${x} · puntata massima ${s}`,
    errors: { bad_offer: "Questa offerta non è valida per questa puntata.", offer_used: "Hai già usato questa offerta.", offer_expired: "Questa offerta è scaduta.", odds_too_low: "La quota della domanda è cambiata: l'offerta non si applica più." } },
  "en-US": { label: "Just for you", sub: (s: number) => `Boosted odds on this question, max stake ${s} pretend credits. A gift: no strings.`, left: "Ends in", go: "Use the odds", banner: (x: number, s: number) => `Special odds ×${x} · max stake ${s}`,
    errors: { bad_offer: "This offer does not apply to this bet.", offer_used: "You have already used this offer.", offer_expired: "This offer has expired.", odds_too_low: "The odds on this question changed: the offer no longer applies." } },
  "en-GB": { label: "Just for you", sub: (s: number) => `Boosted odds on this question, max stake ${s} pretend credits. A gift: no strings.`, left: "Ends in", go: "Use the odds", banner: (x: number, s: number) => `Special odds ×${x} · max stake ${s}`,
    errors: { bad_offer: "This offer does not apply to this bet.", offer_used: "You have already used this offer.", offer_expired: "This offer has expired.", odds_too_low: "The odds on this question changed: the offer no longer applies." } },
  ja: { label: "あなただけに", sub: (s: number) => `この予想のオッズが特別にアップ。上限は${s}ニセクレジット。ただの贈り物なので、気軽にどうぞ。`, left: "終了まで", go: "このオッズを使う", banner: (x: number, s: number) => `特別オッズ ×${x} · 上限 ${s}`,
    errors: { bad_offer: "このオファーはこの予想には使えません。", offer_used: "このオファーはすでに使用済みです。", offer_expired: "このオファーは終了しました。", odds_too_low: "予想のオッズが変わったため、オファーは使えなくなりました。" } },
} as const;

export const offerText = (l: Locale) => T[key(l)];
/** Localised text for the offer-specific server errors, or null for any other error. */
export function offerErrorText(message: string, l: Locale): string | null {
  const e = T[key(l)].errors;
  const k = (Object.keys(e) as (keyof typeof e)[]).find((x) => message.includes(x));
  return k ? e[k] : null;
}

/** "Just for you": the card on top of Home with the player's personal super-odds (if any), a countdown, and a button that opens the normal bet sheet with the offer applied. */
export function PersonalOffer(p: { msg: Messages; locale: Locale; now: number; registered: boolean; onUse: (m: MarketRow, o: OfferUse) => void }) {
  const [list, setList] = useState<Offer[]>([]);
  useEffect(() => {
    if (!p.registered) { setList([]); return; }
    const load = () => { void sb.rpc("my_offers").then(({ data }) => setList((data ?? []) as Offer[]), () => setList([])); };
    load();
    addEventListener(OFFER_EVENT, load);
    return () => removeEventListener(OFFER_EVENT, load);
  }, [p.registered]);
  const o = list.find((x) => Date.parse(x.expires_at) > p.now);
  if (!o) return null;
  const t = offerText(p.locale), city = cityOf(o.market.city_id), left = Date.parse(o.expires_at) - p.now;
  return (
    <section class="card stack pofer" aria-label={t.label}>
      <div class="pohead"><Gift size={20} /><small>{t.label}</small></div>
      <p class="poq"><Q m={o.market} msg={p.msg} locale={p.locale} city={cityName(city, p.locale)} tz={city.timezone} now={new Date(p.now)} /></p>
      <div class="pomult"><span class="poshine" aria-label={`×${o.multiplier}`}>×{o.multiplier}</span><span class="pometa">{t.left} <span class="pocount">{countdown(left)}</span></span></div>
      <p class="hint">{t.sub(o.max_stake)}</p>
      <button class="btn primary wide" onClick={() => p.onUse(o.market, offerUse(o))}>{t.go}</button>
    </section>
  );
}
