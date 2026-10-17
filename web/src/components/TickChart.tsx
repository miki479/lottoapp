import { memo, forget } from "../lib/cache.ts";
import { isCrypto } from "../../../shared/ticks.ts";
import { useEffect, useState } from "preact/hooks";
import type { Messages } from "../i18n/index.ts";
import type { Locale } from "../i18n/index.ts";
import { INTL_TAG } from "../i18n/index.ts";
import type { MarketRow } from "../lib/format.ts";
import { sb } from "../lib/api.ts";
import { fmtPct } from "../lib/num.ts";
import { ChevronDown } from "lucide-preact";

/** Whether the player left the trend open: it stays that way for the next sheets (closed by default, the sheet is short). */
let leftOpen = false;

interface Pt { at: number; v: number }

/** The trend behind a number question: recent history with the threshold line, plus a few plain statistics. */
export function TickChart({ m, msg, locale }: { m: MarketRow; msg: Messages; locale: Locale }) {
  const series = String(m.params.series ?? "");
  const key = isCrypto(series) ? `px:${series}` : series;  // steam:<id>, kp and wiki:<title> are stored under their own name
  const kind = series === "kp" ? "kp" : series.startsWith("wiki:") ? "wiki" : "price";  // storms and games are lines like prices
  const [pts, setPts] = useState<Pt[] | null>(null), [open, setOpen] = useState(leftOpen);
  useEffect(() => {
    let live = true;
    memo(`th:${key}:${kind}`, 100_000, () => sb.rpc("tick_history", { p_series: key, p_limit: kind === "price" ? 48 : kind === "kp" ? 24 : 14 })).then(({ data }: { data: unknown }) => {
      if (live) setPts(((data ?? []) as { at: string; value: number | string }[]).map((r) => ({ at: Date.parse(r.at), v: Number(r.value) })));
    });
    return () => { live = false; };
  }, [key]);
  if (series.startsWith("alert:")) return null;
  if (pts === null) return <div class="sk s" />;
  if (pts.length < 3) return null;
  const thr = Number(m.params.threshold), W = 320, H = 96, pad = 6;
  const all = [...pts.map((p) => p.v), thr];
  const lo = kind === "price" ? Math.min(...all) : Math.min(0, ...all), hi = Math.max(...all), span = hi - lo || 1;
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (pts.length - 1);
  const y = (v: number) => H - pad - ((v - lo) / span) * (H - 2 * pad);
  const last = pts[pts.length - 1]!, first = pts[0]!;
  const dg = typeof m.params.digits === "number" ? m.params.digits : 0, nf = new Intl.NumberFormat(INTL_TAG[locale], { minimumFractionDigits: kind === "kp" ? 0 : dg, maximumFractionDigits: kind === "kp" ? 1 : dg });
  const above = pts.filter((p) => p.v >= thr).length;
  const change = first.v ? ((last.v - first.v) / first.v) * 100 : 0;
  // currency goes in front outside Italy ("$4,200", "€1.85/l"); other units stay behind the number
  const cur = isCrypto(series) || series.startsWith("metal:") || series.startsWith("oil:") ? "$" : series.startsWith("fuel:") ? "€" : "";
  const suffix = series.startsWith("fuel:") ? "/l" : series === "carbon:gb" ? " g/kWh" : series === "power:it" ? " €/MWh" : series.startsWith("tide:") || series.startsWith("wave:") ? " m" : series.startsWith("mf:") ? "%" : series.startsWith("river:") ? " cm" : series.startsWith("storm:") ? " kt" : "";
  const fmt = (v: number) => locale === "it" && cur ? `${nf.format(v)} ${cur}${suffix}` : `${cur}${nf.format(v)}${cur && locale === "it" ? "" : suffix}`;
  const poly = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  return (
    <div class={`tickchart ${kind} ${open ? "open" : ""}`}>
      <button class="tchead" aria-expanded={open} onClick={() => { leftOpen = !open; setOpen(!open); }}><b>{msg.chart.title}</b><span class="num">{fmt(last.v)}</span><ChevronDown size={18} class="tcchev" aria-hidden="true" /></button>
      {open && <><svg role="img" aria-label={msg.chart.title} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {kind === "price" ? <>
          <polygon points={`${x(0)},${H - pad} ${poly} ${x(pts.length - 1)},${H - pad}`} class="tcarea" />
          <polyline points={poly} class="tcline" />
        </> : pts.map((p, i) => <rect key={i} class={`tcbar ${p.v >= thr ? "hi" : ""}`} x={x(i) - (W / pts.length) * 0.32} width={(W / pts.length) * 0.64} y={y(p.v)} height={H - pad - y(p.v)} rx="2" />)}
        <line x1="0" x2={W} y1={y(thr)} y2={y(thr)} class="tcthr" />
        {kind === "price" && <circle cx={x(pts.length - 1)} cy={y(last.v)} r="3.500" class="tcdot" />}
      </svg>
      <div class="tcstats">
        <span><em>{msg.chart.min}</em><b class="num">{fmt(Math.min(...all))}</b></span>
        <span><em>{msg.chart.max}</em><b class="num">{fmt(hi)}</b></span>
        {kind === "price" && <span><em>{msg.chart.change}</em><b class={`num ${change >= 0 ? "up" : "down"}`}>{fmtPct(change / 100, locale, { digits: 1, signed: true })}</b></span>}
        <span><em>{msg.chart.line}</em><b class="num">{fmt(thr)}</b></span>
        <span><em>{msg.chart.above}</em><b class="num">{above}/{pts.length}</b></span>
      </div></>}
    </div>
  );
}
