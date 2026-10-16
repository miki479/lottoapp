import { ChevronDown } from "lucide-preact";
import { useState } from "preact/hooks";
import { INTL_TAG, type Locale, type Messages } from "../i18n/index.ts";
import type { MarketRow } from "../lib/format.ts";
import type { LineRecord } from "../lib/history.ts";
import { useLineRecord } from "../lib/lineRecord.ts";
import { fmtMin, fmtPct } from "../lib/num.ts";
import { dtf } from "../lib/intl.ts";

/** Seven bars, one per day, tall in proportion to the delay of the day; the days over the line are drawn apart and the line itself is dashed. */
function Bars({ rec, h, label }: { rec: LineRecord; h: number; label: string }) {
  const step = 16, w = 7 * step - 4, top = Math.max(rec.thresholdMin * 60 * 1.5, rec.worstMin * 60, 180);
  const y = (sec: number) => Math.max(2, Math.round((Math.min(sec, top) / top) * (h - 2)));
  return (
    <svg class="whybars" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={label}>
      {rec.thresholdMin > 0 && <line class="thr" x1="0" x2={w} y1={h - y(rec.thresholdMin * 60)} y2={h - y(rec.thresholdMin * 60)} />}
      {rec.points.map((p, i) => p.delaySec === null
        ? <rect key={p.day} class="bar none" x={i * step} y={h - 2} width="12" height="2" rx="1" />
        : <rect key={p.day} class={`bar ${p.late ? "late" : "ok"}`} x={i * step} y={h - y(p.delaySec)} width="12" height={y(p.delaySec)} rx="2" />)}
    </svg>
  );
}

/**
 * "Why this quote": how this line did in the last seven days (read from the questions about it that have closed: lib/history.ts), in one line with a small chart
 * and, on a tap, day by day. Questions without such a record show nothing at all.
 */
export function WhyBlock({ m, msg, locale }: { m: Pick<MarketRow, "kind" | "city_id" | "params" | "odds_yes" | "odds_no">; msg: Messages; locale: Locale }) {
  const rec = useLineRecord(m), [open, setOpen] = useState(false);
  if (!rec) return null;
  const t = msg.why;
  const day = (k: string) => dtf(INTL_TAG[locale], { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${k}T12:00:00Z`));
  const prior = Number(m.params.pPrior), sum = 1 / Number(m.odds_yes) + 1 / Number(m.odds_no);
  return (
    <div class={`why ${open ? "open" : ""}`}>
      <button class="whyhead" aria-expanded={open} aria-label={`${t.title}: ${t.line(rec.lateDays, rec.days, fmtMin(rec.avgMin, locale, true))}. ${open ? t.hide : t.show}`} onClick={() => setOpen(!open)}>
        {!open && <Bars rec={rec} h={18} label={t.chart(rec.lateDays, rec.days)} />}
        <span class="whyline">{t.line(rec.lateDays, rec.days, fmtMin(rec.avgMin, locale, true))}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div class="whybody">
          <b class="whytitle">{t.title}</b>
          <Bars rec={rec} h={40} label={t.chart(rec.lateDays, rec.days)} />
          <ul class="whydays">
            {rec.points.filter((p) => p.delaySec !== null).map((p) => (
              <li key={p.day}><span>{day(p.day)}</span><b class="num">{fmtMin((p.delaySec ?? 0) / 60, locale, true)}</b><i class={p.late ? "late" : "ok"}>{p.late ? t.dayLate : t.dayOk}</i></li>
            ))}
          </ul>
          {rec.thresholdMin > 0 && <p class="hint">{t.threshold(fmtMin(rec.thresholdMin, locale))}</p>}
          <p class="hint">{t.source}</p>
          {Number.isFinite(prior) && prior > 0 && prior < 1 && <p class="hint">{t.base(fmtPct(prior, locale))}</p>}
          {Number.isFinite(sum) && <p class="hint">{t.implied(fmtPct(sum, locale))}</p>}
        </div>
      )}
    </div>
  );
}
