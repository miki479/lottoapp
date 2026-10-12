import { Q } from "./Q.tsx";
import { Activity, Car, Clapperboard, TrendingUp, Megaphone, Clock, Star, Zap } from "lucide-preact";
import { cityName, cityOf } from "../lib/cities.ts";
import { countdown, fmtOdds, isYesNo, money, per10, question, quip, type MarketRow } from "../lib/format.ts";
import type { Locale, Messages } from "../i18n/index.ts";
import type { LiveDelay, Pick } from "../lib/types.ts";
import { BusSide, CloudRainSide, isMetroLine, MetroSide, TrainSide } from "./Vehicles.tsx";
import { Sky, useHint } from "./Sky.tsx";
import { TripScene } from "./TripScene.tsx";
import { DelayMeter } from "./DelayMeter.tsx";
import { Flag } from "./Flag.tsx";
import { MetricArt } from "./MetricArt.tsx";
import { TrafficScene } from "./TrafficScene.tsx";
import { TickScene } from "./TickScene.tsx";

const KIND = { bus: BusSide, train: TrainSide, weather: CloudRainSide, nature: Activity, strike: Megaphone, traffic: Car, finance: TrendingUp, culture: Clapperboard } as const;

export function liveLabel(msg: Messages, l: LiveDelay) {
  const sec = Math.abs(l.delay_sec), min = Math.round(l.delay_sec / 60);
  const val = sec < 60 ? `${l.delay_sec} s` : `${min > 0 ? "+" : ""}${min} min`;
  return `${l.is_forecast ? msg.card.forecast : msg.card.live} · ${val}`;
}

/** One event: what it is (detail row), the question (title), then two big, equal choices. */
export function EventCard(p: { m: MarketRow; msg: Messages; locale: Locale; now: number; live?: LiveDelay; index: number; top?: boolean; hasLadder?: boolean; mm?: number; showCity: boolean; onPick: (m: MarketRow, pick: Pick) => void }) {
  const { m, msg, locale, now, live } = p;
  const city = cityOf(m.city_id), Kind = m.category === "train" && isMetroLine(m.params.routeName) ? MetroSide : KIND[m.category];
  const { hint, show, clear } = useHint();
  const left = Date.parse(m.closes_at) - now;
  const isRain = isYesNo(m.kind);
  const who = m.kind === "tick_gt" ? String(m.params.label ?? "") : isRain ? cityName(city, locale) : `${String(m.params.routeName ?? "")} · ${cityName(city, locale)}`;
  const flashOn = (m.flash_multiplier ?? 1) > 1 && !!m.flash_until && Date.parse(m.flash_until) > now;
  return (
    <article class={`card event ${m.category} ${p.top ? "is-top" : ""} ${flashOn ? "is-flash" : ""}`} style={`--i:${Math.min(p.index, 10)}`}>
      {(p.top || flashOn || p.hasLadder || left < 300_000) && <div class="badges">{p.hasLadder && <span class="badge-sorry"><Megaphone size={13} />{msg.ladder.chip}</span>}{flashOn && <span class="badge-flash"><Zap size={13} fill="currentColor" />FLASH ×{m.flash_multiplier} · {countdown(Date.parse(m.flash_until!) - now)}</span>}{p.top && <span class="badge-top"><Star size={13} fill="currentColor" />{msg.card.topOdds}</span>}{left < 300_000 && <span class="badge-hot"><Zap size={13} fill="currentColor" />{msg.card.hot}</span>}</div>}
      {m.kind === "rain_at" ? <Sky mm={p.mm} hint={hint} msg={msg} /> : m.kind === "traffic_speed_lt" ? <TrafficScene m={m} hint={hint} msg={msg} /> : m.kind === "tick_gt" ? <TickScene m={m} hint={hint} msg={msg} /> : m.kind === "metric_gt" || m.kind === "quake_m" || m.kind === "strike_on" ? <MetricArt m={m} msg={msg} hint={hint} /> : <TripScene m={m} now={now} hint={hint} />}
      <div class="meta">
        <span class="kind"><Kind size={m.category === "train" ? 10 : m.category === "bus" ? 12 : 14} /></span>
        <span class="detail">{who}</span>
        {p.showCity && <Flag cc={city.country} size={13} />}
        <span class={`timer ${left < 300_000 ? "hot" : ""}`}><Clock size={12} style="vertical-align:-1px;margin-right:4px" />{countdown(left)}</span>
      </div>
      <p class="q"><Q m={m} msg={msg} locale={locale} city={cityName(city, locale)} tz={city.timezone} now={new Date(now)} /></p>
      <p class="quip">{quip(m, msg)}</p>
      {live && <DelayMeter sec={live.delay_sec} prev={live.prev_delay_sec} limitSec={Number(m.params.thresholdSec ?? 180)} forecast={live.is_forecast} msg={msg} />}
      <div class="actions2">
        {(["yes", "no"] as const).map((k) => {
          const o = Number(k === "yes" ? m.odds_yes : m.odds_no), boosted = k === "yes" && flashOn;
          return (
            <button key={k} class={`opt ${k} ${boosted ? "boosted" : ""}`} onClick={() => p.onPick(m, k)} onPointerEnter={(e) => { if (e.pointerType === "mouse") show(k); }} onPointerLeave={(e) => { if (e.pointerType === "mouse") clear(); }} onPointerDown={(e) => { if (e.pointerType !== "mouse") show(k, 1600); }} onFocus={() => show(k)} onBlur={clear}>
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
