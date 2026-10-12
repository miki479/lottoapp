import { Check, RotateCcw, Share2, X } from "lucide-preact";
import { useEffect } from "preact/hooks";
import { cityName, cityOf } from "../lib/cities.ts";
import { fmtOdds, money, question, resultAmount } from "../lib/format.ts";
import { haptic } from "../lib/haptics.ts";
import type { Locale, Messages } from "../i18n/index.ts";
import { ReportLink } from "./ReportLink.tsx";
import type { MyBet } from "../lib/types.ts";

/** What the market measured, in words ("Measured delay: 1 min 44 s"). */
export function evidenceLines(b: MyBet, msg: Messages): string[] {
  const m = b.markets, ev = m.evidence;
  if (m.kind === "traffic_speed_lt") return typeof ev?.avgKmh === "number" ? [msg.result.trafficMeasured(Math.round(ev.avgKmh), Number(m.params.thresholdKmh))] : [];
  if (m.kind === "strike_on") return typeof ev?.present === "number" ? [ev.present ? msg.result.strikeOn : msg.result.strikeOff] : [];
  if (m.kind === "metric_gt") return typeof ev?.value === "number" ? [msg.result.metricMeasured(msg.wx.names[m.params.metric as "temp"], `${ev.value}${String(m.params.unit ?? "")}`)] : [];
  if (m.kind === "quake_m") return typeof ev?.count === "number" ? [msg.result.quakeMeasured(ev.count, `M${Number(ev.maxMag ?? 0).toFixed(1)}`)] : [];
  if (m.kind === "rain_at") return typeof ev?.precipitationMm === "number" ? [msg.result.rainMeasured(Math.round(ev.precipitationMm * 10) / 10)] : [];
  const out: string[] = [];
  if (typeof ev?.delaySec === "number") { const s = Math.abs(Math.round(ev.delaySec)); out.push(msg.result.measured(Math.floor(s / 60), s % 60)); }
  out.push(msg.result.threshold(Math.round(Number(m.params.thresholdSec ?? 180) / 60)));
  return out;
}

/** The big, clear outcome screen. Colour is soft, and always backed by an icon and a word. */
export function ResultScreen({ bet, msg, locale, remaining, onClose, onShare, onNext }: { bet: MyBet; msg: Messages; locale: Locale; remaining: number; onClose: () => void; onShare: () => void; onNext: () => void }) {
  const st = bet.status as "won" | "lost" | "void";
  const m = bet.markets, city = cityOf(m.city_id);
  useEffect(() => { st === "won" ? haptic.success() : st === "lost" ? haptic.error() : haptic.tap(); }, [bet.id]);
  const amount = resultAmount(st, bet.stake, bet.payout, locale);
  const Icon = st === "won" ? Check : st === "lost" ? X : RotateCcw;
  const sub = st === "won" ? msg.result.subWon : st === "lost" ? msg.result.subLost : msg.result.subVoid;
  const lines = st === "void" ? [msg.bets.voidReason[m.void_reason ?? ""] ?? ""] : evidenceLines(bet, msg);
  return (
    <div class={`result ${st}`} role="dialog" aria-modal="true" aria-label={msg.result[st]}>
      <button class="iconbtn close" onClick={onClose} aria-label={msg.result.close}><X size={22} /></button>
      <div class="inner">
        <span class="emblem"><Icon size={44} strokeWidth={2.4} /></span>
        <div><span class="detail">{msg.result[st]}</span></div>
        <div class="amount num">{amount}</div>
        <p style="color:var(--text-2)">{sub}</p>
        <p class="q" style="font-weight:600">{question(m, msg, locale, cityName(city, locale), city.timezone)}</p>
        {lines.filter(Boolean).map((l) => <p class="hint" key={l}>{l}</p>)}
        <div class="facts"><div><span class="detail">{msg.result.stake}</span><b class="num">{money(bet.stake, locale)}</b></div><div><span class="detail">{msg.result.odds}</span><b class="num">{fmtOdds(Number(bet.odds), locale)}</b></div></div>
      </div>
      <div class="btns">
        <button class="btn primary wide" onClick={onShare}><Share2 size={18} />{msg.result.share}</button>
        {remaining > 0 ? <button class="btn secondary wide" onClick={onNext}>{msg.result.more(remaining)}</button> : <button class="btn secondary wide" onClick={onClose}>{msg.result.close}</button>}
        <ReportLink marketId={m.id} msg={msg} />
      </div>
    </div>
  );
}
