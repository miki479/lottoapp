import { Bus, CloudRain, Clock, Star, TrainFront, Zap } from "lucide-preact";
import { cityName, cityOf } from "../lib/cities.ts";
import { countdown, fmtOdds, per10, question, type MarketRow } from "../lib/format.ts";
import type { Locale, Messages } from "../i18n/index.ts";
import type { LiveDelay, Pick } from "../lib/types.ts";
import { Flag } from "./Flag.tsx";

const KIND = { bus: Bus, train: TrainFront, weather: CloudRain, traffic: Bus } as const;

export function liveLabel(msg: Messages, l: LiveDelay) {
  const sec = Math.abs(l.delay_sec), min = Math.round(l.delay_sec / 60);
  const val = sec < 60 ? `${l.delay_sec} s` : `${min > 0 ? "+" : ""}${min} min`;
  return `${l.is_forecast ? msg.card.forecast : msg.card.live} · ${val}`;
}

/** One event: what it is (detail row), the question (title), then two big, equal choices. */
export function EventCard(p: { m: MarketRow; msg: Messages; locale: Locale; now: number; live?: LiveDelay; index: number; top?: boolean; showCity: boolean; onPick: (m: MarketRow, pick: Pick) => void }) {
  const { m, msg, locale, now, live } = p;
  const city = cityOf(m.city_id), Kind = KIND[m.category];
  const left = Date.parse(m.closes_at) - now;
  const isRain = m.kind === "rain_at";
  const who = isRain ? cityName(city, locale) : `${String(m.params.routeName ?? "")} · ${cityName(city, locale)}`;
  const warn = live && live.delay_sec > Number(m.params.thresholdSec ?? 180) / 2;
  return (
    <article class={`card event ${m.category} ${p.top ? "is-top" : ""}`} style={`--i:${Math.min(p.index, 10)}`}>
      {(p.top || left < 300_000) && <div class="badges">{p.top && <span class="badge-top"><Star size={13} fill="currentColor" />{msg.card.topOdds}</span>}{left < 300_000 && <span class="badge-hot"><Zap size={13} fill="currentColor" />{msg.card.hot}</span>}</div>}
      <div class="meta">
        <span class="kind"><Kind size={16} /></span>
        <span class="detail">{who}</span>
        {p.showCity && <Flag cc={city.country} size={13} />}
        <span class={`timer ${left < 300_000 ? "hot" : ""}`}><Clock size={12} style="vertical-align:-1px;margin-right:4px" />{countdown(left)}</span>
      </div>
      <p class="q">{question(m, msg, locale, cityName(city, locale), city.timezone, new Date(now))}</p>
      {live && <span class={`live ${warn ? "warn" : ""}`}><i class="dot" />{liveLabel(msg, live)}</span>}
      <div class="actions2">
        <button class="opt" onClick={() => p.onPick(m, "yes")}><span class="l">{isRain ? msg.card.yes : msg.card.late}</span><b>{fmtOdds(Number(m.odds_yes), locale)}</b><span class="s">{msg.card.per10(per10(Number(m.odds_yes)))}</span></button>
        <button class="opt" onClick={() => p.onPick(m, "no")}><span class="l">{isRain ? msg.card.no : msg.card.onTime}</span><b>{fmtOdds(Number(m.odds_no), locale)}</b><span class="s">{msg.card.per10(per10(Number(m.odds_no)))}</span></button>
      </div>
    </article>
  );
}
