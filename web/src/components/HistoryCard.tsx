import { memo, forget } from "../lib/cache.ts";
import { TrendingDown, TrendingUp } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { INTL_TAG } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { money } from "../lib/format.ts";
import { moneySigned } from "../lib/num.ts";
import { dtf } from "../lib/intl.ts";

interface Day { day: string; net: number; bets: number }
interface Cat { category: string; bets: number; won: number; lost: number; net: number }

/** How the credits have gone: the running balance over the last days and where they were won or lost, by category. */
export function HistoryCard({ msg, locale }: { msg: Messages; locale: Locale }) {
  const h = msg.hist;
  const [days, setDays] = useState<Day[] | null>(null), [cats, setCats] = useState<Cat[]>([]), [span, setSpan] = useState(30);
  useEffect(() => { let live = true; memo(`mbs:${span}`, 120_000, () => sb.rpc("my_balance_series", { p_days: span })).then(({ data }) => { if (live) setDays(((data ?? []) as Day[]).map((d) => ({ ...d, net: Number(d.net), bets: Number(d.bets) }))); }); return () => { live = false; }; }, [span]);
  useEffect(() => { let live = true; memo("mcs", 120_000, () => sb.rpc("my_category_stats")).then(({ data }) => { if (live) setCats(((data ?? []) as Cat[]).map((c) => ({ ...c, bets: Number(c.bets), won: Number(c.won), lost: Number(c.lost), net: Number(c.net) }))); }); return () => { live = false; }; }, []);
  if (days === null) return <section class="card hist"><div class="sk s" /></section>;
  if (days.length === 0 && cats.length === 0) return <section class="card hist"><b>{h.title}</b><p class="hint">{h.empty}</p></section>;
  let run = 0; const pts = days.map((d) => ({ ...d, cum: (run += d.net) }));
  const total = run, W = 300, H = 90, pad = 8, lo = Math.min(0, ...pts.map((p) => p.cum)), hi = Math.max(0, ...pts.map((p) => p.cum)), sp = hi - lo || 1;
  const x = (i: number) => pad + (pts.length <= 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (pts.length - 1)), y = (v: number) => H - pad - ((v - lo) / sp) * (H - 2 * pad);
  const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.cum).toFixed(1)}`).join(" "), zero = y(0);
  const up = total >= 0, best = cats[0], worst = cats.length > 1 ? cats[cats.length - 1] : undefined;
  const maxAbs = Math.max(1, ...cats.map((c) => Math.abs(c.net)));
  const fmt = (n: number) => moneySigned(n, locale);
  const dayFmt = dtf(INTL_TAG[locale], { day: "numeric", month: "short" });
  return (
    <section class="card hist stack" style="gap:10px">
      <div class="histhead"><b>{h.title}</b><span class={`histtotal num ${up ? "pos" : "neg"}`}>{up ? <TrendingUp size={16} /> : <TrendingDown size={16} />}{fmt(total)}</span></div>
      <div class="mkchips">{[7, 30, 90].map((d) => <button key={d} class={`mkchip ${span === d ? "on" : ""}`} aria-pressed={span === d} onClick={() => setSpan(d)}>{h.days(d)}</button>)}</div>
      {pts.length > 0 && (
        <svg class="histchart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={h.title} preserveAspectRatio="none">
          <line x1={pad} x2={W - pad} y1={zero} y2={zero} class="hz" />
          <polygon points={`${x(0)},${zero} ${line} ${x(pts.length - 1)},${zero}`} class={`harea ${up ? "pos" : "neg"}`} />
          <polyline points={line} class={`hline ${up ? "pos" : "neg"}`} />
          <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1]!.cum)} r="3.500" class={`hdot ${up ? "pos" : "neg"}`} />
        </svg>
      )}
      {pts.length > 0 && <div class="histaxis"><span>{dayFmt.format(new Date(pts[0]!.day))}</span><span>{dayFmt.format(new Date(pts[pts.length - 1]!.day))}</span></div>}
      {(best || worst) && <div class="histbw">
        {best && best.net > 0 && <span class="pos"><TrendingUp size={14} />{h.best}: <b>{msg.tabs[best.category as keyof typeof msg.tabs] ?? best.category}</b> {fmt(best.net)}</span>}
        {worst && worst.net < 0 && <span class="neg"><TrendingDown size={14} />{h.worst}: <b>{msg.tabs[worst.category as keyof typeof msg.tabs] ?? worst.category}</b> {fmt(worst.net)}</span>}
      </div>}
      {cats.length > 0 && <details class="histcats"><summary>{h.byCategory}</summary>
        <ul>{cats.map((c) => <li key={c.category}><span class="cn">{msg.tabs[c.category as keyof typeof msg.tabs] ?? c.category}<em>{c.won}/{c.won + c.lost}</em></span><span class="cb"><i class={c.net >= 0 ? "pos" : "neg"} style={`width:${Math.round((Math.abs(c.net) / maxAbs) * 100)}%`} /></span><b class={`num ${c.net >= 0 ? "pos" : "neg"}`}>{fmt(c.net)}</b></li>)}</ul>
      </details>}
    </section>
  );
}
