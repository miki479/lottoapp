import { countdown, question, type MarketRow } from "../lib/format.ts";
import { cityName, cityOf } from "../lib/cities.ts";
import type { Locale, Messages } from "../i18n/index.ts";
import type { LiveDelay, Pick } from "../lib/types.ts";
import { Flap } from "./Flap.tsx";
import { liveLabel } from "./MarketCard.tsx";

/** The big number on top: the most delayed vehicle right now, or the next event about to close. */
export function Hero(p: { m: MarketRow; live?: LiveDelay; msg: Messages; locale: Locale; now: number; onPick: (m: MarketRow, pick: Pick) => void }) {
  const { m, live, msg } = p;
  const city = cityOf(m.city_id);
  const isRain = m.kind === "rain_at";
  const lateNow = !!live && live.delay_sec >= 60;
  const min = lateNow ? Math.round(live!.delay_sec / 60) : Math.round(Number(m.params.thresholdSec ?? 180) / 60);
  const left = Date.parse(m.closes_at) - p.now;
  const tone = lateNow ? (live!.delay_sec > Number(m.params.thresholdSec ?? 180) ? "bad" : "warn") : "plain";
  return (
    <section class={`hero ${tone}`}>
      <div class="kick"><i class="dot" />{lateNow ? msg.hero.lateNow : msg.hero.kicker}</div>
      {isRain ? <div class="big rainbig" key="rain">🌧️</div> : <div class="big" key={`${m.id}${min}`}>{lateNow ? "" : "+"}{min}<sup>'</sup></div>}
      <div class="who">
        {isRain ? <b class="dest">{cityName(city, p.locale)}</b> : <><Flap text={String(m.params.routeName ?? "")} /><b class="dest">→ {String(m.params.headsign ?? "")}</b></>}
      </div>
      <p class="q">{question(m, msg, p.locale, cityName(city, p.locale), city.timezone, new Date(p.now))}</p>
      {live && <p class="livel">{liveLabel(msg, live)}</p>}
      <button class="cta" onClick={() => p.onPick(m, lateNow ? "yes" : "no")}>{msg.hero.cta} <span>{msg.hero.closingSoon} {countdown(left)}</span></button>
      <div class="led" aria-hidden="true"><span>{String(m.params.stopName ?? cityName(city, p.locale)).toUpperCase()}  ·  {String(m.params.headsign ?? "").toUpperCase()}  ·  {String(m.params.stopName ?? cityName(city, p.locale)).toUpperCase()}  ·  {String(m.params.headsign ?? "").toUpperCase()}  ·  </span></div>
    </section>
  );
}
