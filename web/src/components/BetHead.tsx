import type { Locale, Messages } from "../i18n/index.ts";
import { cityName, cityOf } from "../lib/cities.ts";
import { formatWhen, type MarketRow } from "../lib/format.ts";
import { subjectOf } from "../lib/names.ts";
import { fmtMin } from "../lib/num.ts";
import type { LiveDelay } from "../lib/types.ts";
import { Countdown } from "./Countdown.tsx";
import { Flag } from "./Flag.tsx";
import { Q } from "./Q.tsx";

/** Where a delay question stands right now, in words: the delay measured, a forecast, "on time", or that nothing is known yet. Null for kinds that have no such state. */
export function stateOf(m: Pick<MarketRow, "kind">, live: LiveDelay | undefined, occ: { level: number } | undefined, msg: Messages, locale: Locale): { text: string; late: boolean } | null {
  if (m.kind === "bus_delay_gt" || m.kind === "train_delay_gt") {
    if (!live) return { text: msg.sheet.noLive, late: false };
    const min = Math.round(live.delay_sec / 60), word = min > 0 ? fmtMin(min, locale, true) : msg.card.onTime;
    return { text: live.is_forecast ? msg.sheet.forecast(word) : word, late: min > 0 };
  }
  if (m.kind === "bus_full" && occ) return { text: msg.occ.levels[Math.max(0, Math.min(msg.occ.levels.length - 1, occ.level))] ?? "", late: false };
  return null;
}

/**
 * The top of the bet sheet: what the question is about (the route, the match, the place), the question itself and three facts under it, each with its
 * label: how it stands now, when it is decided, and a live countdown to the close.
 */
export function BetHead(p: { m: MarketRow; msg: Messages; locale: Locale; now: number; live?: LiveDelay; occ?: { level: number } }) {
  const { m, msg, locale } = p, city = cityOf(m.city_id), place = cityName(city, locale);
  const subject = subjectOf(m, msg, locale, place), state = stateOf(m, p.live, p.occ, msg, locale);
  return (
    <section class="bethead" aria-label={msg.sheet.title}>
      <p class="bhsub">{m.city_id !== "world" && <Flag cc={city.country} size={13} />}<span>{subject}</span></p>
      <p class="q"><Q m={m} msg={msg} locale={locale} city={place} tz={city.timezone} now={new Date(p.now)} /></p>
      <dl class="bhfacts">
        {state && <div class={state.late ? "late" : ""}><dt>{msg.sheet.now}</dt><dd>{state.text}</dd></div>}
        <div><dt>{msg.sheet.decides}</dt><dd class="num">{formatWhen(m.target_at, locale, city.timezone, new Date(p.now))}</dd></div>
        <div><dt>{msg.sheet.closesIn}</dt><dd class="num"><Countdown to={Date.parse(m.closes_at)} /></dd></div>
      </dl>
    </section>
  );
}
