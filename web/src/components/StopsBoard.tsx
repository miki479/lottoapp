import { ChevronDown, ListOrdered, MapPin, Minus, TrendingDown, TrendingUp } from "lucide-preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { delayContextAt } from "../../../shared/odds.ts";
import { buildBoard, toneOf, type BoardStop, type StopRow, type Trend } from "../../../shared/tripstops.ts";
import { INTL_TAG, type Locale } from "../i18n/index.ts";
import { cityOf } from "../lib/cities.ts";
import type { MarketRow } from "../lib/format.ts";
import type { LiveDelay } from "../lib/types.ts";
import { useTripStops } from "../lib/tripStops.ts";
import "./StopsBoard.css";

type Key = "it" | "en-US" | "en-GB" | "ja";
const key = (l: Locale): Key => (l === "it" || l === "ja" || l === "en-GB" ? l : "en-US");

// Own strings (the other agents edit the shared language files): one small map per language.
interface Text {
  show: (n: number, train: boolean) => string; hide: (n: number, train: boolean) => string; title: (train: boolean) => string;
  note: string; now: string; nowForecast: string; min: string; trend: Record<Trend, string>; trendHint: string; updated: (min: number) => string;
  head: { stop: string; sched: string; real: string }; cancelled: string; market: string; here: string; hereGuess: string; noData: string;
  kinds: { actual: string; forecast: string; predicted: string };
}
const T: Record<Key, Text> = {
  it: {
    show: (n) => `Mostra le fermate (${n})`, hide: (n) => `Nascondi le fermate (${n})`, title: () => "Fermate della corsa",
    note: "Orario programmato a sinistra; a destra quello reale o previsto (~) con il ritardo di adesso.",
    now: "Ritardo adesso", nowForecast: "Ritardo previsto", min: "min", trend: { better: "migliora", worse: "peggiora", steady: "stabile" }, trendHint: "rispetto a 10-15 minuti fa",
    updated: (m) => (m < 1 ? "aggiornato ora" : `aggiornato ${m} min fa`), head: { stop: "Fermata", sched: "Prog.", real: "Reale / ~" },
    cancelled: "soppressa", market: "Fermata della domanda", here: "Ultima fermata", hereGuess: "Posizione stimata", noData: "Ancora nessuna lettura: i tempi reali compaiono quando la corsa parte.",
    kinds: { actual: "Reale", forecast: "Previsto dal gestore", predicted: "Previsto" },
  },
  "en-US": {
    show: (n) => `Show stops (${n})`, hide: (n) => `Hide stops (${n})`, title: () => "Stops of this trip",
    note: "Scheduled time on the left; on the right the actual or predicted (~) time, with the delay right now.",
    now: "Delay right now", nowForecast: "Forecast delay", min: "min", trend: { better: "improving", worse: "worsening", steady: "steady" }, trendHint: "compared with 10-15 minutes ago",
    updated: (m) => (m < 1 ? "updated just now" : `updated ${m} min ago`), head: { stop: "Stop", sched: "Sched.", real: "Actual / ~" },
    cancelled: "cancelled", market: "The question's stop", here: "Last stop", hereGuess: "Estimated", noData: "No readings yet: the actual times appear once the trip is under way.",
    kinds: { actual: "Actual", forecast: "Forecast by the operator", predicted: "Predicted" },
  },
  "en-GB": {
    show: (n) => `Show stops (${n})`, hide: (n) => `Hide stops (${n})`, title: () => "Stops of this journey",
    note: "Scheduled time on the left; on the right the actual or predicted (~) time, with the delay right now.",
    now: "Delay right now", nowForecast: "Forecast delay", min: "min", trend: { better: "improving", worse: "worsening", steady: "steady" }, trendHint: "compared with 10-15 minutes ago",
    updated: (m) => (m < 1 ? "updated just now" : `updated ${m} min ago`), head: { stop: "Stop", sched: "Sched.", real: "Actual / ~" },
    cancelled: "cancelled", market: "The question's stop", here: "Last stop", hereGuess: "Estimated", noData: "No readings yet: the actual times appear once the journey is under way.",
    kinds: { actual: "Actual", forecast: "Forecast by the operator", predicted: "Predicted" },
  },
  ja: {
    show: (n, train) => `${train ? "停車駅" : "停留所"}を表示（${n}）`, hide: (n, train) => `${train ? "停車駅" : "停留所"}を隠す（${n}）`, title: (train) => (train ? "この列車の停車駅" : "この便の停留所"),
    note: "左が時刻表の時刻、右が実際の時刻または予測（~）と、いまの遅れです。",
    now: "いまの遅れ", nowForecast: "予測される遅れ", min: "分", trend: { better: "改善中", worse: "悪化中", steady: "安定" }, trendHint: "10〜15分前との比較",
    updated: (m) => (m < 1 ? "たったいま更新" : `${m}分前に更新`), head: { stop: "停車駅", sched: "定刻", real: "実際 / ~" },
    cancelled: "運休", market: "この予想の停車駅", here: "最後の通過駅", hereGuess: "推定位置", noData: "まだ情報がありません。運行が始まると実際の時刻が表示されます。",
    kinds: { actual: "実際", forecast: "運行会社の予測", predicted: "予測" },
  },
};

type M = Pick<MarketRow, "id" | "kind" | "city_id" | "params">;
const isDelay = (m: M) => (m.kind === "bus_delay_gt" || m.kind === "train_delay_gt") && typeof m.params.tripId === "string" && m.params.tripId !== "";

/** `+3’` / `−2’`; nothing when the figure rounds to a punctual stop. */
const mins = (sec: number) => { const r = Math.round(sec / 60); return r === 0 ? "" : `${r > 0 ? "+" : "−"}${Math.abs(r)}’`; };

function Row({ s, fmt, limitSec, t, now, guess: estimated }: { s: BoardStop; fmt: Intl.DateTimeFormat; limitSec: number; t: Text; now: number; guess: boolean }) {
  const tone = s.cell === "none" ? null : toneOf(s.delaySec, limitSec);
  const guess = s.cell === "forecast" || s.cell === "predicted";
  const here = s.phase === "current";
  const time = s.atMs === null ? "" : fmt.format(s.atMs);
  const d = s.delaySec === null ? "" : mins(s.delaySec);
  const done = s.phase === "done" || (s.atMs !== null && s.atMs < now - 60_000 && guess);
  return (
    <li class={`stop ${s.phase} ${s.market ? "market" : ""} ${s.cancelled ? "cancelled" : ""} ${done ? "past" : ""}`} aria-current={here ? "step" : undefined}>
      <i class="stopdot" aria-hidden="true" />
      <span class="stopname" title={s.name}>
        <span class="stopnm">{s.name || "—"}</span>
        {s.market && <span class="stopmark" role="img" aria-label={t.market} title={t.market}><MapPin size={11} /></span>}
        {here && <small class="stophere">{estimated ? t.hereGuess : t.here}</small>}
      </span>
      <span class="stopsched num">{fmt.format(s.schedMs)}</span>
      {s.cancelled
        ? <span class="stopreal cancel">{t.cancelled}</span>
        : s.cell === "none"
          ? <span class="stopreal none" aria-hidden="true">·</span>
          : <span class={`stopreal ${tone ?? ""} ${s.cell}`} aria-label={`${t.kinds[s.cell]} ${time}${d ? ` ${d}` : ""}`} title={t.kinds[s.cell]}>
              <b class="num">{guess ? "~" : ""}{time}</b>{d && <small class="num">{d}</small>}
            </span>}
    </li>
  );
}

/**
 * "Show stops": the stops of the trip behind a bus / train delay question, drawn like a departures board. Scheduled time on the left; on the right
 * the actual time (green when punctual, orange when late, red-orange past the question's line) or, for the stops still ahead, the predicted one marked ~;
 * the stop the vehicle is at is lit up. Folded away until the player opens it; hidden altogether when the database knows nothing about this trip's stops.
 */
export function StopsBoard({ m, locale, now, live, variant = "sheet" }: { m: M; locale: Locale; now: number; live?: LiveDelay; variant?: "sheet" | "bet" }) {
  const t = T[key(locale)], train = m.kind === "train_delay_gt", enabled = isDelay(m);
  const [open, setOpen] = useState(false);
  const rows = useTripStops(m.id, enabled, open);
  const city = cityOf(m.city_id), tz = city.timezone;
  const fmt = useMemo(() => new Intl.DateTimeFormat(INTL_TAG[locale], { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }), [locale, tz]);
  const limitSec = Number(m.params.thresholdSec ?? (train ? 300 : 180));
  const minute = Math.floor(now / 60_000);
  // the rush hour is looked up per quarter of an hour, not per stop
  const board = useMemo(() => {
    if (!rows || rows.length < 2) return null;
    const memo = new Map<number, ReturnType<typeof delayContextAt>>();
    const ctxAt = (ms: number) => { const q = Math.floor(ms / 900_000); let c = memo.get(q); if (!c) { c = delayContextAt(tz, ms / 1000); memo.set(q, c); } return c; };
    return buildBoard(rows as StopRow[], { nowMs: now, train, ctxAt, fallbackPrevSec: live?.prev_delay_sec ?? null });
  }, [rows, minute, train, tz, live?.prev_delay_sec]);
  const list = useRef<HTMLOListElement>(null);
  // opening scrolls the list so that the vehicle's stop is near the top
  useEffect(() => {
    const ol = list.current; if (!open || !ol) return;
    const at = ol.querySelector<HTMLElement>("li.current") ?? ol.querySelector<HTMLElement>("li.ahead");
    ol.scrollTop = at ? Math.max(0, at.offsetTop - 2 * at.offsetHeight) : 0;
  }, [open, board?.stops.length]);
  if (!enabled || !board) return null;
  const n = board.stops.length, live_ = board.live;
  const shown = live_ ? Math.round(live_.delaySec / 60) : 0;
  const ago = live_ ? Math.max(0, Math.round((now - live_.atMs) / 60_000)) : 0;
  const Trend = live_?.trend === "worse" ? TrendingUp : live_?.trend === "better" ? TrendingDown : Minus;
  const tone = live_ ? toneOf(live_.delaySec, limitSec) : null;
  return (
    <div class={`stopsbox ${variant === "bet" ? "inbet" : "insheet"}`}>
      <button class="insbtn" type="button" aria-expanded={open} aria-controls={`stops-${m.id}`} onClick={() => setOpen(!open)}>
        <ListOrdered size={15} />{open ? t.hide(n, train) : t.show(n, train)}<ChevronDown size={16} class={open ? "up" : ""} />
      </button>
      {open && (
        <section class="ledbezel stopsled" id={`stops-${m.id}`} aria-label={t.title(train)}>
          <header class="stopstop">
            {live_
              ? <>
                  <span class={`stopsnow ${tone ?? ""}`}>
                    <small>{live_.forecast ? t.nowForecast : t.now}</small>
                    <b class="num">{live_.forecast ? "~" : ""}{shown > 0 ? "+" : shown < 0 ? "−" : ""}{Math.abs(shown)}<em> {t.min}</em></b>
                  </span>
                  {live_.trend && <span class={`stopstrend ${live_.trend}`} title={t.trendHint}><Trend size={14} aria-hidden="true" />{t.trend[live_.trend]}</span>}
                  <span class="stopsupd">{t.updated(ago)}</span>
                </>
              : !board.stops.some((s) => s.cell === "actual" || s.cell === "forecast") && <span class="stopsnone">{t.noData}</span>}
          </header>
          <div class="stopscols" aria-hidden="true"><span /><span>{t.head.stop}</span><span>{t.head.sched}</span><span>{t.head.real}</span></div>
          <ol class="stopslist" ref={list} tabIndex={0} aria-label={t.title(train)}>
            {board.stops.map((s) => <Row key={s.seq} s={s} fmt={fmt} limitSec={limitSec} t={t} now={now} guess={board.currentEstimated} />)}
          </ol>
          <p class="stopsnote">{t.note}</p>
        </section>
      )}
    </div>
  );
}
