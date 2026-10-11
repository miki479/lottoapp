import { Megaphone, Cloud, CloudRain, Clock, Star, Zap } from "lucide-preact";
import { cityName, cityOf } from "../lib/cities.ts";
import { countdown, fmtOdds, money, per10, question, type MarketRow } from "../lib/format.ts";
import type { Locale, Messages } from "../i18n/index.ts";
import type { LiveDelay, Pick } from "../lib/types.ts";
import { BusSide, TrainSide } from "./Vehicles.tsx";
import { DelayMeter } from "./DelayMeter.tsx";
import { Flag } from "./Flag.tsx";

const KIND = { bus: BusSide, train: TrainSide, weather: CloudRain, traffic: BusSide } as const;

export function liveLabel(msg: Messages, l: LiveDelay) {
  const sec = Math.abs(l.delay_sec), min = Math.round(l.delay_sec / 60);
  const val = sec < 60 ? `${l.delay_sec} s` : `${min > 0 ? "+" : ""}${min} min`;
  return `${l.is_forecast ? msg.card.forecast : msg.card.live} · ${val}`;
}

/** One event: what it is (detail row), the question (title), then two big, equal choices. */
export function EventCard(p: { m: MarketRow; msg: Messages; locale: Locale; now: number; live?: LiveDelay; index: number; top?: boolean; hasLadder?: boolean; showCity: boolean; onPick: (m: MarketRow, pick: Pick) => void }) {
  const { m, msg, locale, now, live } = p;
  const city = cityOf(m.city_id), Kind = KIND[m.category];
  const left = Date.parse(m.closes_at) - now;
  const isRain = m.kind === "rain_at";
  const who = isRain ? cityName(city, locale) : `${String(m.params.routeName ?? "")} · ${cityName(city, locale)}`;
  const flashOn = (m.flash_multiplier ?? 1) > 1 && !!m.flash_until && Date.parse(m.flash_until) > now;
  return (
    <article class={`card event ${m.category} ${p.top ? "is-top" : ""} ${flashOn ? "is-flash" : ""}`} style={`--i:${Math.min(p.index, 10)}`}>
      {(p.top || flashOn || p.hasLadder || left < 300_000) && <div class="badges">{p.hasLadder && <span class="badge-sorry"><Megaphone size={13} />{msg.ladder.chip}</span>}{flashOn && <span class="badge-flash"><Zap size={13} fill="currentColor" />FLASH ×{m.flash_multiplier} · {countdown(Date.parse(m.flash_until!) - now)}</span>}{p.top && <span class="badge-top"><Star size={13} fill="currentColor" />{msg.card.topOdds}</span>}{left < 300_000 && <span class="badge-hot"><Zap size={13} fill="currentColor" />{msg.card.hot}</span>}</div>}
      <div class={`scene ${m.category}`} aria-hidden="true">
        {m.category === "weather" ? <><Cloud size={20} class="cloud" />{[0, 1, 2, 3, 4, 5].map((i) => <i key={i} class="drop" style={`left:${14 + i * 15}%;animation-delay:${-i * 170}ms`} />)}</> : <><span class="road" /><span class="rider"><Kind size={20} /></span></>}
      </div>
      <div class="meta">
        <span class="kind"><Kind size={16} /></span>
        <span class="detail">{who}</span>
        {p.showCity && <Flag cc={city.country} size={13} />}
        <span class={`timer ${left < 300_000 ? "hot" : ""}`}><Clock size={12} style="vertical-align:-1px;margin-right:4px" />{countdown(left)}</span>
      </div>
      <p class="q">{question(m, msg, locale, cityName(city, locale), city.timezone, new Date(now))}</p>
      {live && <DelayMeter sec={live.delay_sec} prev={live.prev_delay_sec} limitSec={Number(m.params.thresholdSec ?? 180)} forecast={live.is_forecast} msg={msg} />}
      <div class="actions2">
        {(["yes", "no"] as const).map((k) => {
          const o = Number(k === "yes" ? m.odds_yes : m.odds_no), boosted = k === "yes" && flashOn;
          return (
            <button key={k} class={`opt ${k} ${boosted ? "boosted" : ""}`} onClick={() => p.onPick(m, k)}>
              <span class="l">{k === "yes" ? (isRain ? msg.card.yes : msg.card.late) : (isRain ? msg.card.no : msg.card.onTime)}</span>
              <b class="num">{fmtOdds(o, locale)}</b>
              <span class="s num">{money(10, locale)} → {money(per10(o), locale)}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}
