import { CloudRain } from "lucide-preact";
import type { Locale } from "../i18n/index.ts";
import { INTL_TAG } from "../i18n/index.ts";
import { cityName, cityOf } from "../lib/cities.ts";
import type { MarketRow } from "../lib/format.ts";
import { fmtMult } from "../lib/num.ts";
import type { Pick } from "../lib/types.ts";

const T: Record<string, { title: (c: string) => string; hint: string }> = {
  it: { title: (c) => `Pioverà a ${c}?`, hint: "Scegli l'ora" },
  "en-US": { title: (c) => `Will it rain in ${c}?`, hint: "Pick the hour" },
  "en-GB": { title: (c) => `Will it rain in ${c}?`, hint: "Pick the hour" },
  ja: { title: (c) => `${c}で雨は降る?`, hint: "時間を選んでください" },
};

/** All the "will it rain" questions of one city as one card: a row of hours with their odds, instead of a card for each hour. Tapping an hour opens the same bet as the single card. */
export function RainGroup({ markets, locale, now, onPick }: { markets: MarketRow[]; locale: Locale; now: number; onPick: (m: MarketRow, pick: Pick) => void }) {
  const t = T[locale] ?? T["en-US"]!, c = cityOf(markets[0]!.city_id);
  const hour = (m: MarketRow) => {
    const f = new Intl.DateTimeFormat(INTL_TAG[locale], { hour: "2-digit", hourCycle: "h23", timeZone: c.timezone });
    const start = Math.floor(Date.parse(m.target_at) / 3600_000) * 3600_000;
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: c.timezone }), d = day.format(new Date(start)), isToday = d === day.format(new Date(now));
    const wd = isToday ? "" : `${new Intl.DateTimeFormat(INTL_TAG[locale], { weekday: "short", timeZone: c.timezone }).format(new Date(start))} `;
    return `${wd}${f.format(new Date(start))}–${f.format(new Date(start + 3600_000))}`;  // whole hours: "08–09"
  };
  const sorted = [...markets].sort((a, b) => Date.parse(a.target_at) - Date.parse(b.target_at)).filter((m) => Date.parse(m.closes_at) > now);
  if (sorted.length === 0) return null;
  return (
    <section class="card raingroup" style="grid-column:1/-1">
      <div class="rgtop"><CloudRain size={20} aria-hidden="true" /><h3>{t.title(cityName(c, locale))}</h3><span class="detail">{t.hint}</span></div>
      <div class="rgrow">{sorted.map((m) => <button key={m.id} class="rgchip" onClick={() => onPick(m, "yes")}><span class="num">{hour(m)}</span><b class="num">{fmtMult(Number(m.odds_yes), locale)}</b></button>)}</div>
    </section>
  );
}
