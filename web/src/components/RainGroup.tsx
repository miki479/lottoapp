import { CloudRain, Moon, Star, Sun, Sunrise, Timer } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { INTL_TAG } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { cityName, cityOf } from "../lib/cities.ts";
import { countdown, fmtOdds, type MarketRow } from "../lib/format.ts";
import { fmtDec } from "../lib/num.ts";
import { buildRainRecord, partOfHour, type Part, type RainClosed } from "../lib/rainRecord.ts";
import type { Pick } from "../lib/types.ts";

interface Strings { title: (c: string) => string; all: string; m: string; a: string; e: string; threshold: (mm: string) => string; best: string; closes: string; hist: (rainy: number, hours: number, avg: string, max: string) => string; none: string; pick: string }
const T: Record<string, Strings> = {
  it: { title: (c) => `Pioverà a ${c}?`, all: "Tutte", m: "Mattina", a: "Pomeriggio", e: "Sera e notte", threshold: (mm) => `Pioggia almeno ${mm} mm`, best: "Quota migliore", closes: "Chiude tra", pick: "Scegli un'ora e il tuo Sì o No",
    hist: (r, h, avg, max) => `Negli ultimi 7 giorni in questa fascia ha piovuto in ${r} ore su ${h}${r ? ` · media ${avg} mm, massimo ${max} mm` : ""}`, none: "Per questa fascia non ci sono ancora abbastanza ore concluse." },
  "en-US": { title: (c) => `Will it rain in ${c}?`, all: "All", m: "Morning", a: "Afternoon", e: "Evening & night", threshold: (mm) => `Rain of at least ${mm} mm`, best: "Best odds", closes: "Closes in", pick: "Pick an hour and your Yes or No",
    hist: (r, h, avg, max) => `Over the last 7 days in this part of the day it rained in ${r} of ${h} hours${r ? ` · average ${avg} mm, highest ${max} mm` : ""}`, none: "Not enough finished hours for this part of the day yet." },
  "en-GB": { title: (c) => `Will it rain in ${c}?`, all: "All", m: "Morning", a: "Afternoon", e: "Evening & night", threshold: (mm) => `Rain of at least ${mm} mm`, best: "Best odds", closes: "Closes in", pick: "Pick an hour and your Yes or No",
    hist: (r, h, avg, max) => `Over the last 7 days in this part of the day it rained in ${r} of ${h} hours${r ? ` · average ${avg} mm, highest ${max} mm` : ""}`, none: "Not enough finished hours for this part of the day yet." },
  ja: { title: (c) => `${c}で雨は降る?`, all: "すべて", m: "朝", a: "午後", e: "夜", threshold: (mm) => `${mm}mm以上の雨`, best: "最高オッズ", closes: "締切まで", pick: "時間と「はい」か「いいえ」を選んでください",
    hist: (r, h, avg, max) => `過去7日間のこの時間帯は${h}時間中${r}時間で雨${r ? ` · 平均${avg}mm、最大${max}mm` : ""}`, none: "この時間帯はまだ十分なデータがありません。" },
};
const ICON = { m: Sunrise, a: Sun, e: Moon } as const;

/** What fell in the rain hours of one city that have already closed, over the last 7 days (null while loading or when there is nothing). */
function useRainClosed(cityId: string): RainClosed[] | null {
  const [rows, setRows] = useState<RainClosed[] | null>(null);
  useEffect(() => {
    let live = true;
    void sb.from("markets").select("target_at,outcome,evidence").eq("city_id", cityId).eq("kind", "rain_at").eq("status", "resolved").gte("target_at", new Date(Date.now() - 7 * 86400_000).toISOString()).order("target_at", { ascending: false }).limit(400)
      .then(({ data }) => { if (live) setRows((data ?? []) as RainClosed[]); }, () => { if (live) setRows([]); });
    return () => { live = false; };
  }, [cityId]);
  return rows;
}

/** Seven small bars, one per day: the most rain of the day in the chosen part of the day. */
function Bars({ days, label }: { days: { day: string; mm: number | null }[]; label: string }) {
  const top = Math.max(1, ...days.map((d) => d.mm ?? 0)), h = 22, step = 14;
  return (
    <svg class="rgbars" viewBox={`0 0 ${7 * step - 3} ${h}`} width={7 * step - 3} height={h} role="img" aria-label={label}>
      {days.map((d, i) => d.mm === null
        ? <rect key={d.day} class="bar none" x={i * step} y={h - 2} width="11" height="2" rx="1" />
        : <rect key={d.day} class={`bar ${d.mm > 0 ? "wet" : "dry"}`} x={i * step} y={h - Math.max(2, Math.round((d.mm / top) * (h - 2)))} width="11" height={Math.max(2, Math.round((d.mm / top) * (h - 2)))} rx="2" />)}
    </svg>
  );
}

/**
 * All the "will it rain" questions of one city as one panel: pick the part of the day, then the hours in order, two to a row, grouped by day. Each hour says what
 * is bet (the rain it asks for) and carries its own Yes and No with their odds; the part of the day shows how it went over the last seven days. The questions and
 * the odds come from the weather forecast (Open-Meteo hourly precipitation) exactly as on the single cards.
 */
export function RainGroup({ markets, locale, msg, now, onPick }: { markets: MarketRow[]; locale: Locale; msg: Messages; now: number; onPick: (m: MarketRow, pick: Pick) => void }) {
  const t = T[locale] ?? T["en-US"]!, c = cityOf(markets[0]!.city_id), tag = INTL_TAG[locale];
  const [part, setPart] = useState<Part | "all">("all");
  const closed = useRainClosed(c.id);
  const hf = new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: c.timezone });
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: c.timezone }), dayName = new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long", timeZone: c.timezone });
  const start = (m: MarketRow) => Math.floor(Date.parse(m.target_at) / 3600_000) * 3600_000;
  const partOf = (m: MarketRow): Part => partOfHour(Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: c.timezone }).format(new Date(start(m)))));
  const open = [...markets].filter((m) => Date.parse(m.closes_at) > now).sort((a, b) => Date.parse(a.target_at) - Date.parse(b.target_at));
  if (open.length === 0) return null;
  const shown = part === "all" ? open : open.filter((m) => partOf(m) === part);
  const best = shown.reduce<MarketRow | null>((b, m) => (!b || Number(m.odds_yes) > Number(b.odds_yes) ? m : b), null);
  const soonest = shown.reduce<MarketRow | null>((b, m) => (!b || Date.parse(m.closes_at) < Date.parse(b.closes_at) ? m : b), null);
  const days: { key: string; label: string; items: MarketRow[] }[] = [];
  for (const m of shown) { const k = dayKey.format(new Date(start(m))), last = days[days.length - 1]; if (last && last.key === k) last.items.push(m); else days.push({ key: k, label: dayName.format(new Date(start(m))), items: [m] }); }
  const rec = closed ? buildRainRecord(closed, c.timezone, part, now) : null;
  const mmOf = (m: MarketRow) => fmtDec(Number(m.params.minMm ?? 0.1), Number(m.params.minMm ?? 0.1) % 1 ? 1 : 0, locale);
  const PartIcon = part === "all" ? CloudRain : ICON[part];
  return (
    <section class="card raingroup" style="grid-column:1/-1">
      <div class="rgtop"><CloudRain size={20} aria-hidden="true" /><h3>{t.title(cityName(c, locale))}</h3></div>
      <div class="seg rgsel" role="tablist" aria-label={t.pick}>
        {(["all", "m", "a", "e"] as const).map((k) => { const Icon = k === "all" ? CloudRain : ICON[k]; return <button key={k} role="tab" class={part === k ? "on" : ""} aria-selected={part === k} onClick={() => setPart(k)}><Icon size={16} aria-hidden="true" />{t[k]}</button>; })}
      </div>
      {closed !== null && <div class="rghist">{rec ? <><Bars days={rec.days} label={t.hist(rec.rainy, rec.hours, fmtDec(rec.avgMm, 1, locale), fmtDec(rec.maxMm, 1, locale))} /><span>{t.hist(rec.rainy, rec.hours, fmtDec(rec.avgMm, 1, locale), fmtDec(rec.maxMm, 1, locale))}</span></> : <><PartIcon size={16} aria-hidden="true" /><span>{t.none}</span></>}</div>}
      {days.map((d) => (
        <div key={d.key} class="stack" style="gap:var(--space-2)">
          <h4 class="rgday">{d.label}</h4>
          <div class="rggrid">{d.items.map((m) => { const p = partOf(m), Icon = ICON[p], label = `${hf.format(new Date(start(m)))}–${hf.format(new Date(start(m) + 3600_000))}`, isBest = m === best && shown.length > 2, isSoon = m === soonest && shown.length > 2 && Date.parse(m.closes_at) - now < 3 * 3600_000;
            return (
              <div key={m.id} class={`rgchip ${isBest ? "best" : ""}`}>
                <div class="rghead"><Icon size={16} aria-hidden="true" /><b class="num">{label}</b></div>
                <span class="rgwhat">{t.threshold(mmOf(m))}</span>
                {(isBest || isSoon) && <span class="rgtag">{isBest ? <><Star size={12} aria-hidden="true" />{t.best}</> : <><Timer size={12} aria-hidden="true" />{t.closes} <span class="num">{countdown(Date.parse(m.closes_at) - now)}</span></>}</span>}
                <div class="rgbtns">
                  <button class="rgbtn yes" onClick={() => onPick(m, "yes")} aria-label={`${label}: ${msg.card.yes} ${fmtOdds(Number(m.odds_yes), locale)}`}>{msg.card.yes}<b class="num">{fmtOdds(Number(m.odds_yes), locale)}</b></button>
                  <button class="rgbtn no" onClick={() => onPick(m, "no")} aria-label={`${label}: ${msg.card.no} ${fmtOdds(Number(m.odds_no), locale)}`}>{msg.card.no}<b class="num">{fmtOdds(Number(m.odds_no), locale)}</b></button>
                </div>
              </div>
            ); })}</div>
        </div>
      ))}
    </section>
  );
}
