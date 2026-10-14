import { CloudRain, Moon, Sun, Sunrise } from "lucide-preact";
import type { Locale } from "../i18n/index.ts";
import { INTL_TAG } from "../i18n/index.ts";
import { cityName, cityOf } from "../lib/cities.ts";
import type { MarketRow } from "../lib/format.ts";
import { fmtMult } from "../lib/num.ts";
import type { Pick } from "../lib/types.ts";

const T: Record<string, { title: (c: string) => string; hint: string; m: string; a: string; e: string }> = {
  it: { title: (c) => `Pioverà a ${c}?`, hint: "Scegli l'ora", m: "Mattina", a: "Pomeriggio", e: "Sera" },
  "en-US": { title: (c) => `Will it rain in ${c}?`, hint: "Pick the hour", m: "Morning", a: "Afternoon", e: "Evening" },
  "en-GB": { title: (c) => `Will it rain in ${c}?`, hint: "Pick the hour", m: "Morning", a: "Afternoon", e: "Evening" },
  ja: { title: (c) => `${c}で雨は降る?`, hint: "時間を選んでください", m: "朝", a: "午後", e: "夜" },
};
type Part = "m" | "a" | "e";
const ICON = { m: Sunrise, a: Sun, e: Moon } as const;

/**
 * All the "will it rain" questions of one city as one card: the hours in order, two to a row, each marked morning / afternoon / evening by its icon and colour,
 * with the day on top when the hours span more than one. Tapping an hour opens the same bet as the single card. The question and its odds come from the weather
 * forecast (Open-Meteo hourly precipitation) exactly as before: only the way the hours are laid out changes.
 */
export function RainGroup({ markets, locale, now, onPick }: { markets: MarketRow[]; locale: Locale; now: number; onPick: (m: MarketRow, pick: Pick) => void }) {
  const t = T[locale] ?? T["en-US"]!, c = cityOf(markets[0]!.city_id), tag = INTL_TAG[locale];
  const hf = new Intl.DateTimeFormat(tag, { hour: "2-digit", hourCycle: "h23", timeZone: c.timezone });
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: c.timezone }), dayName = new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "short", timeZone: c.timezone });
  const sorted = [...markets].filter((m) => Date.parse(m.closes_at) > now).sort((a, b) => Date.parse(a.target_at) - Date.parse(b.target_at));
  if (sorted.length === 0) return null;
  const start = (m: MarketRow) => Math.floor(Date.parse(m.target_at) / 3600_000) * 3600_000;
  const part = (m: MarketRow): Part => { const h = Number(hf.format(new Date(start(m)))); return h >= 5 && h < 12 ? "m" : h >= 12 && h < 18 ? "a" : "e"; };
  const days: { key: string; label: string; items: MarketRow[] }[] = [];
  for (const m of sorted) {
    const k = dayKey.format(new Date(start(m))), last = days[days.length - 1];
    if (last && last.key === k) last.items.push(m); else days.push({ key: k, label: dayName.format(new Date(start(m))), items: [m] });
  }
  return (
    <section class="card raingroup" style="grid-column:1/-1">
      <div class="rgtop"><CloudRain size={20} aria-hidden="true" /><h3>{t.title(cityName(c, locale))}</h3><span class="detail">{t.hint}</span></div>
      <div class="rgkey" aria-hidden="true"><span class="dp-m"><Sunrise size={14} />{t.m}</span><span class="dp-a"><Sun size={14} />{t.a}</span><span class="dp-e"><Moon size={14} />{t.e}</span></div>
      {days.map((d) => (
        <div key={d.key} class="stack" style="gap:var(--space-2)">
          {days.length > 1 && <span class="rgday">{d.label}</span>}
          <div class="rggrid">{d.items.map((m) => { const p = part(m), Icon = ICON[p], label = `${hf.format(new Date(start(m)))}–${hf.format(new Date(start(m) + 3600_000))}`;
            return <button key={m.id} class={`rgchip dp-${p}`} onClick={() => onPick(m, "yes")} aria-label={`${t[p]} ${label} ×${Number(m.odds_yes)}`}><Icon size={18} aria-hidden="true" /><span class="num">{label}</span><b class="num">{fmtMult(Number(m.odds_yes), locale)}</b></button>; })}</div>
        </div>
      ))}
    </section>
  );
}
