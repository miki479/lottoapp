import { Q } from "./Q.tsx";
import { Activity, Car, ChevronRight, Clapperboard, Trophy, TrendingUp, Megaphone, Clock, Star, Zap, Users, Scale } from "lucide-preact";
import { cityName, cityOf } from "../lib/cities.ts";
import { Countdown } from "./Countdown.tsx";
import { countdown, fmtOdds, isYesNo, potentialWin, superText, type MarketRow } from "../lib/format.ts";
import { fmtDec, fmtInt } from "../lib/num.ts";
import { oddsMove } from "../lib/oddsmove.ts";
import { WhyBlock } from "./WhyBlock.tsx";
import type { Locale, Messages } from "../i18n/index.ts";
import type { LiveDelay, LiveOcc, Pick } from "../lib/types.ts";
import { BusSide, CloudRainSide, IntercitySide, isIntercityLine, isMetroLine, MetroSide, TrainSide } from "./Vehicles.tsx";
import { Sky, useHint } from "./Sky.tsx";
import { OccScene } from "./OccScene.tsx";
import { TripScene } from "./TripScene.tsx";
import { DelayMeter } from "./DelayMeter.tsx";
import { Flag } from "./Flag.tsx";
import { MetricArt } from "./MetricArt.tsx";
import { TrafficScene } from "./TrafficScene.tsx";
import { TickScene } from "./TickScene.tsx";
import { SportScene } from "./SportScene.tsx";
import { fmtTimes } from "../lib/num.ts";
import { subjectOf } from "../lib/names.ts";

const KIND = { bus: BusSide, train: TrainSide, weather: CloudRainSide, nature: Activity, strike: Megaphone, traffic: Car, finance: TrendingUp, culture: Clapperboard, sport: Trophy, law: Scale } as const;

/** How full the bus is right now: five bars and a word. */
export function OccMeter(p: { level: number; msg: Messages }) {
  const lv = Math.max(0, Math.min(5, p.level));
  return <div class={`occ lv${lv}`} role="img" aria-label={`${p.msg.occ.title}: ${p.msg.occ.levels[lv]}`}><span class="occbars">{[0, 1, 2, 3, 4].map((i) => <i key={i} class={i < lv ? "on" : ""} />)}</span><span class="occt">{p.msg.occ.title}: <b>{p.msg.occ.levels[lv]}</b></span></div>;
}

/** One event: what it is (detail row), the question (title), then two big, equal choices. */
export function EventCard(p: { m: MarketRow; msg: Messages; locale: Locale; now: number; live?: LiveDelay; occ?: LiveOcc; index: number; top?: boolean; hasLadder?: boolean; mm?: number; friends?: number; showCity: boolean; onPick: (m: MarketRow, pick: Pick) => void }) {
  const { m, msg, locale, now, live } = p;
  const city = cityOf(m.city_id), Kind = m.category === "train" && isMetroLine(m.params.routeName) ? MetroSide : m.category === "train" && isIntercityLine(m.params.routeName) ? IntercitySide : KIND[m.category];
  const { hint, show, clear } = useHint();
  const left = Date.parse(m.closes_at) - now;
  const isRain = isYesNo(m.kind);
  const who = subjectOf(m, msg, locale, cityName(city, locale));
  const flashOn = (m.flash_multiplier ?? 1) > 1 && !!m.flash_until && Date.parse(m.flash_until) > now;
  /** Short outcome words ("Sì" / "No") sit beside the odds; longer ones ("In ritardo") sit above them. One layout per card, so the two buttons line up. */
  const inlineWords = [isRain ? msg.card.yes : msg.card.late, isRain ? msg.card.no : msg.card.onTime].every((w) => w.length <= 5);
  return (
    <article class={`card event ${(p.friends ?? 0) > 0 ? "has-friends" : ""} ${m.category} ${p.top ? "is-top" : ""} ${flashOn ? "is-flash" : ""}`} style={`--i:${Math.min(p.index, 10)}`} onClick={(e) => { if (!(e.target as HTMLElement).closest("button, a, input, select, label, .why")) p.onPick(m, "yes"); }}>
      {(p.friends ?? 0) > 0 && <span class="frbadge" role="img" title={msg.frd.friendsOn(p.friends!)} aria-label={msg.frd.friendsOn(p.friends!)}><Users size={13} />{p.friends}</span>}
      {(p.top || flashOn || p.hasLadder || left < 300_000) && <div class="badges">{p.hasLadder && <span class="badge-sorry"><Megaphone size={13} />{msg.ladder.chip}</span>}{flashOn && <span class={`badge-flash ${superText(m, msg) ? "super" : ""}`}><Zap size={13} fill="currentColor" />{superText(m, msg) ? msg.sup.badge : msg.streak.flash.toUpperCase()} {fmtTimes(Number(m.flash_multiplier), locale)} · {countdown(Date.parse(m.flash_until!) - now)}</span>}{p.top && <span class="badge-top"><Star size={13} fill="currentColor" />{msg.card.topOdds}</span>}{left < 300_000 && <span class="badge-hot"><Zap size={13} fill="currentColor" />{msg.card.hot}</span>}</div>}
      {flashOn && superText(m, msg) && <p class="supernote">{superText(m, msg)}</p>}
      {m.kind === "rain_at" ? <Sky mm={p.mm} hint={hint} msg={msg} /> : m.kind === "traffic_speed_lt" ? <TrafficScene m={m} hint={hint} msg={msg} /> : m.kind === "match_bet" ? <SportScene m={m} hint={hint} msg={msg} /> : m.kind === "tick_gt" ? <TickScene m={m} hint={hint} msg={msg} /> : m.kind === "metric_gt" || m.kind === "quake_m" || m.kind === "strike_on" ? <MetricArt m={m} msg={msg} hint={hint} /> : m.kind === "bus_full" ? <OccScene m={m} hint={hint} level={p.occ?.level} msg={msg} /> : <TripScene m={m} now={now} hint={hint} />}
      <div class="meta">
        <span class="kind"><Kind size={m.category === "train" ? 10 : m.category === "bus" ? 12 : 14} /></span>
        <span class="detail">{who}</span>
        {p.showCity && m.city_id !== "world" && <Flag cc={city.country} size={13} />}
        <span class={`timer ${left < 300_000 ? "hot" : ""}`}><Clock size={12} style="vertical-align:-1px;margin-right:4px" /><Countdown to={Date.parse(m.closes_at)} /></span>
      </div>
      <p class="q"><Q m={m} msg={msg} locale={locale} city={cityName(city, locale)} tz={city.timezone} now={new Date(now)} /><ChevronRight class="qgo" size={16} aria-hidden="true" /></p>
      {typeof m.params.by === "string" && m.params.by && <p class="byline">{msg.maker.by(m.params.by)}</p>}
      {p.occ && <OccMeter level={p.occ.level} msg={msg} />}
      {m.kind !== "bus_full" && !live && (m.category === "train" || m.category === "bus") && <p class="nolive">{msg.card.noLive}</p>}
      {m.kind !== "bus_full" && live && <DelayMeter sec={live.delay_sec} prev={live.prev_delay_sec} limitSec={Number(m.params.thresholdSec ?? 180)} forecast={live.is_forecast} observedAt={live.observed_at} now={now} msg={msg} />}
      <div class="actions2">
        {(["yes", "no"] as const).map((k) => {
          const o = Number(k === "yes" ? m.odds_yes : m.odds_no), boosted = k === "yes" && flashOn, mv = oddsMove(m.id, k, Number(m.odds_yes), Number(m.odds_no));
          const word = k === "yes" ? (isRain ? msg.card.yes : msg.card.late) : (isRain ? msg.card.no : msg.card.onTime);
          return (
            <button key={k} class={`opt row ${inlineWords ? "short" : ""} ${k} ${boosted ? "boosted" : ""}`} onClick={() => p.onPick(m, k)} onPointerEnter={(e) => { if (e.pointerType === "mouse") show(k); }} onPointerLeave={(e) => { if (e.pointerType === "mouse") clear(); }} onPointerDown={(e) => { if (e.pointerType !== "mouse") show(k, 1600); }} onFocus={() => show(k)} onBlur={clear}>
              <span class="l">{word}</span>
              <span class="ob"><b class="num">{fmtOdds(o, locale)}</b></span>
              {mv && <i class={`mv ${mv.dir}`}>{mv.dir === "up" ? "\u2191" : "\u2193"} {fmtDec(mv.delta, 2, locale)}</i>}
              <span class="s num">{msg.card.stakeTo(fmtInt(100, locale), fmtInt(potentialWin(100, o), locale))}</span>
            </button>
          );
        })}
      </div>
      <WhyBlock m={m} msg={msg} locale={locale} />
    </article>
  );
}
