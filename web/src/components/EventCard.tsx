import { Hourglass, MapPin, Megaphone, Clock, Star, Zap } from "lucide-preact";
import { cityName, cityOf } from "../lib/cities.ts";
import { countdown, fmtOdds, money, per10, question, type MarketRow } from "../lib/format.ts";
import type { Locale, Messages } from "../i18n/index.ts";
import type { LiveDelay, Pick } from "../lib/types.ts";
import { BusSide, CloudRainSide, TrainSide } from "./Vehicles.tsx";
import { Sky, useHint } from "./Sky.tsx";
import { DelayMeter } from "./DelayMeter.tsx";
import { Flag } from "./Flag.tsx";

const KIND = { bus: BusSide, train: TrainSide, weather: CloudRainSide, traffic: BusSide } as const;

export function liveLabel(msg: Messages, l: LiveDelay) {
  const sec = Math.abs(l.delay_sec), min = Math.round(l.delay_sec / 60);
  const val = sec < 60 ? `${l.delay_sec} s` : `${min > 0 ? "+" : ""}${min} min`;
  return `${l.is_forecast ? msg.card.forecast : msg.card.live} · ${val}`;
}

/** One event: what it is (detail row), the question (title), then two big, equal choices. */
export function EventCard(p: { m: MarketRow; msg: Messages; locale: Locale; now: number; live?: LiveDelay; index: number; top?: boolean; hasLadder?: boolean; mm?: number; showCity: boolean; onPick: (m: MarketRow, pick: Pick) => void }) {
  const { m, msg, locale, now, live } = p;
  const city = cityOf(m.city_id), Kind = KIND[m.category];
  const { hint, show, clear } = useHint();
  const left = Date.parse(m.closes_at) - now;
  // The vehicle covers its trip in the last 3 hours before the arrival time: it reaches the end exactly at the target time.
  // More wind puffs behind it the closer the arrival is (a faster run); parked and puff-free while it is still far off.
  const toArrival = Date.parse(m.target_at) - now;
  const progress = Math.max(0, Math.min(1, 1 - toArrival / (3 * 3600_000)));
  const mins = toArrival / 60_000;
  // Each card runs on its own clock so a long list never moves in sync: 18-33 s per cycle, shifted by an id-based offset.
  const h = [...m.id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const cyc = 18 + (h % 16), off = h % 33;
  const iconH = m.category === "train" ? 20 : m.category === "bus" ? 20 : 18;
  const w = m.category === "train" ? 60 : m.category === "bus" ? 48 : 31;
  const puffs = toArrival <= 0 || mins > 180 ? 0 : mins > 120 ? 1 : mins > 60 ? 2 : mins > 30 ? 3 : mins > 10 ? 4 : 6;
  const isRain = m.kind === "rain_at";
  const who = isRain ? cityName(city, locale) : `${String(m.params.routeName ?? "")} · ${cityName(city, locale)}`;
  const flashOn = (m.flash_multiplier ?? 1) > 1 && !!m.flash_until && Date.parse(m.flash_until) > now;
  return (
    <article class={`card event ${m.category} ${p.top ? "is-top" : ""} ${flashOn ? "is-flash" : ""}`} style={`--i:${Math.min(p.index, 10)}`}>
      {(p.top || flashOn || p.hasLadder || left < 300_000) && <div class="badges">{p.hasLadder && <span class="badge-sorry"><Megaphone size={13} />{msg.ladder.chip}</span>}{flashOn && <span class="badge-flash"><Zap size={13} fill="currentColor" />FLASH ×{m.flash_multiplier} · {countdown(Date.parse(m.flash_until!) - now)}</span>}{p.top && <span class="badge-top"><Star size={13} fill="currentColor" />{msg.card.topOdds}</span>}{left < 300_000 && <span class="badge-hot"><Zap size={13} fill="currentColor" />{msg.card.hot}</span>}</div>}
      {m.category === "weather" ? <Sky mm={p.mm} hint={hint} msg={msg} /> : (
      <div class={`scene ${m.category}`} aria-hidden="true" data-hint={hint ?? ""} style={`--p:${progress.toFixed(4)};--w:${w}px;--cyc:${cyc}s;--off:-${off}s`}>
        <span class="road" /><span class="done" /><span class="streaks"><i /><i /><i /><i /><i /><i /></span><span class="dest"><MapPin size={16} /><i class="ping" /></span>
        <span class="rider">
          {Array.from({ length: puffs }, (_, i) => <i key={i} class="puff" style={`--t:${(2.6 - puffs * 0.2).toFixed(2)}s;animation-delay:${-(i * (2.6 - puffs * 0.2)) / puffs}s;top:${3 + (i % 3) * 5}px`} />)}
          <Hourglass size={14} class="wait" /><i class="flame" />
          <Kind size={iconH} />
          
        </span>
      </div>
      )}
      <div class="meta">
        <span class="kind"><Kind size={m.category === "train" ? 10 : m.category === "bus" ? 12 : 14} /></span>
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
