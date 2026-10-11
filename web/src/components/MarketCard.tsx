import { countdown, fmtOdds, minutesUntil, per10, question, type MarketRow } from "../lib/format.ts";
import { cityName, cityOf } from "../lib/cities.ts";
import type { Locale, Messages } from "../i18n/index.ts";
import type { LiveDelay, Pick } from "../lib/types.ts";
import { Flap } from "./Flap.tsx";

export const catIcon = { bus: "🚌", train: "🚆", weather: "🌧️", traffic: "🚗" } as const;

export function liveLabel(msg: Messages, l: LiveDelay) {
  const min = Math.round(l.delay_sec / 60);
  return `${l.is_forecast ? msg.card.forecast : msg.card.live} ${min > 0 ? "+" : ""}${min}'`;
}
export const liveTone = (l: LiveDelay, thresholdSec: number) => (l.delay_sec > thresholdSec ? "bad" : l.delay_sec > 60 ? "warn" : "good");

export function MarketCard(p: { m: MarketRow; msg: Messages; locale: Locale; now: number; live?: LiveDelay; index: number; showCity: boolean; bomb?: boolean; onPick: (m: MarketRow, pick: Pick) => void }) {
  const { m, msg, locale, now, live } = p;
  const city = cityOf(m.city_id);
  const left = Date.parse(m.closes_at) - now;
  const urgent = left < 5 * 60_000;
  const isRain = m.kind === "rain_at";
  const thr = Math.round(Number(m.params.thresholdSec ?? 180) / 60);
  const route = String(m.params.routeName ?? m.params.routeId ?? "");
  const bomb = !!p.bomb;
  const q = question(m, msg, locale, cityName(city, locale), city.timezone, new Date(now));
  return (
    <article class={`card mk ${m.category} ${urgent ? "urgent" : ""} ${bomb && !isRain ? "has-bomb" : ""}`} style={`--i:${Math.min(p.index, 12)}`}>
      {bomb && !isRain && <span class="bomb" aria-hidden="true"><b>{msg.card.bomb}</b></span>}
      <header>
        {isRain ? <span class="rainicon" aria-hidden="true">🌧️</span> : <Flap text={route} />}
        <span class="dest">{isRain ? cityName(city, locale) : `→ ${String(m.params.headsign ?? "")}`}</span>
        {p.showCity && <span class="citytag">{city.country}</span>}
        {live && <span class={`liveb ${liveTone(live, Number(m.params.thresholdSec ?? 180))}`}><i class="dot" />{liveLabel(msg, live)}</span>}
      </header>
      <p class="q">{q}</p>
      <div class="mid">
        <div class="thr" aria-hidden="true">{isRain ? <span class="drop">💧</span> : <><small>{msg.hero.threshold}</small>+{thr}<sup>'</sup></>}</div>
        <div class={`timer ${urgent ? "hot" : ""}`}><small>{msg.card.closes}</small><b>{countdown(left)}</b></div>
      </div>
      <div class="odds">
        <button class="ob yes" onClick={() => p.onPick(m, "yes")}>
          <span class="l">{isRain ? msg.pick.yes : msg.card.late}</span><b>{fmtOdds(Number(m.odds_yes), locale)}<i>×</i></b><span class="s">{msg.card.per10(per10(Number(m.odds_yes)))}</span>
        </button>
        <button class="ob no" onClick={() => p.onPick(m, "no")}>
          <span class="l">{isRain ? msg.pick.no : msg.card.onTime}</span><b>{fmtOdds(Number(m.odds_no), locale)}<i>×</i></b><span class="s">{msg.card.per10(per10(Number(m.odds_no)))}</span>
        </button>
      </div>
      <div class="bar" aria-hidden="true"><i style={`width:${Math.min(100, (left / 3_600_000) * 100)}%`} /></div>
    </article>
  );
}

export const closesSoon = (m: MarketRow, now = Date.now()) => minutesUntil(m.closes_at, now) < 5;
