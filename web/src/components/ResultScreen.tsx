import { MarketVs, reasonOf } from "./MatchVs.tsx";
import { Q } from "./Q.tsx";
import { ArrowRight, Check, RotateCcw, Share2, TrendingDown, X } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { reducedMotion, useCountUp } from "../lib/anim.ts";
import { cityName, cityOf } from "../lib/cities.ts";
import { fmtOdds, money, resultAmount, tickValueText } from "../lib/format.ts";
import { haptic } from "../lib/haptics.ts";
import type { Locale, Messages } from "../i18n/index.ts";
import { ReportLink } from "./ReportLink.tsx";
import type { MyBet } from "../lib/types.ts";
import { fmtDec, fmtNum } from "../lib/num.ts";

/** What the market measured, in words ("Measured delay: 1 min 44 s"). */
export function evidenceLines(b: MyBet, msg: Messages): string[] {
  const m = b.markets, ev = m.evidence;
  if (m.kind === "bus_full") return typeof ev?.level === "number" ? [msg.result.fullMeasured(msg.occ.levels[ev.level] ?? "")] : [];
  if (m.kind === "match_bet") return typeof ev?.home === "number" ? [msg.result.matchScore(ev.home, Number(ev.away))] : [];
  if (m.kind === "tick_gt") return typeof ev?.value === "number" ? [msg.result.tickMeasured(tickValueText(String(m.params.series), ev.value, typeof m.params.digits === "number" ? m.params.digits : 0))] : [];
  if (m.kind === "traffic_speed_lt") return typeof ev?.avgKmh === "number" ? [msg.result.trafficMeasured(Math.round(ev.avgKmh), Number(m.params.thresholdKmh))] : [];
  if (m.kind === "strike_on") return typeof ev?.present === "number" ? [ev.present ? msg.result.strikeOn : msg.result.strikeOff] : [];
  if (m.kind === "metric_gt") return typeof ev?.value === "number" ? [msg.result.metricMeasured(msg.wx.names[m.params.metric as "temp"], `${fmtNum(ev.value, undefined, 1)}${String(m.params.unit ?? "")}`)] : [];
  if (m.kind === "quake_m") return typeof ev?.count === "number" ? [msg.result.quakeMeasured(ev.count, `M${fmtDec(Number(ev.maxMag ?? 0), 1)}`)] : [];
  if (m.kind === "rain_at") return typeof ev?.precipitationMm === "number" ? [msg.result.rainMeasured(fmtNum(ev.precipitationMm, undefined, 1))] : [];
  const out: string[] = [];
  if (typeof ev?.delaySec === "number") { const s = Math.abs(Math.round(ev.delaySec)); out.push(msg.result.measured(Math.floor(s / 60), s % 60)); }
  out.push(msg.result.threshold(Math.round(Number(m.params.thresholdSec ?? 180) / 60)));
  return out;
}

/** "Balance 11.119 € → 11.735 €": the balance without this result and with it, the second figure counting up to its value. */
function BalanceMove({ before, after, label, locale }: { before: number; after: number; label: string; locale: Locale }) {
  const [target, setTarget] = useState(reducedMotion() ? after : before);
  useEffect(() => { if (reducedMotion()) { setTarget(after); return; } setTarget(before); const t = window.setTimeout(() => setTarget(after), 450); return () => window.clearTimeout(t); }, [before, after]);
  const shown = useCountUp(target, 900);
  return (
    <p class="balmove" aria-label={`${label}: ${money(before, locale)} → ${money(after, locale)}`}>
      <span aria-hidden="true">{label}</span><b class="num from" aria-hidden="true">{money(before, locale)}</b><ArrowRight size={18} aria-hidden="true" /><b class="num to" aria-hidden="true">{money(shown, locale)}</b>
    </p>
  );
}

/**
 * The big, clear outcome screen. A win and a loss have the same structure and the same weight: an emblem, the word, the big figure, how the balance moved,
 * what happened, what the bet was. Colour is soft, and always backed by an icon and a word; a loss gets a calm icon, never a check.
 */
export function ResultScreen({ bet, msg, locale, remaining, balance, onClose, onShare, onNext }: { bet: MyBet; msg: Messages; locale: Locale; remaining: number; balance?: { before: number; after: number } | null; onClose: () => void; onShare: () => void; onNext: () => void }) {
  const st = bet.status as "won" | "lost" | "void";
  const m = bet.markets, city = cityOf(m.city_id);
  useEffect(() => { st === "won" ? haptic.success() : st === "lost" ? haptic.error() : haptic.tap(); }, [bet.id]);
  const amount = resultAmount(st, bet.stake, bet.payout, locale);
  const Icon = st === "won" ? Check : st === "lost" ? TrendingDown : RotateCcw;
  const sub = st === "won" ? msg.result.subWon : st === "lost" ? msg.result.subLost : msg.result.subVoid;
  const lines = st === "void" ? [msg.bets.voidReason[m.void_reason ?? ""] ?? ""] : evidenceLines(bet, msg);
  return (
    <div class={`result ${st}`} role="dialog" aria-modal="true" aria-label={msg.result[st]}>
      <button class="iconbtn close" onClick={onClose} aria-label={msg.result.close}><X size={22} /></button>
      <div class="inner">
        <span class="emblem"><Icon size={44} strokeWidth={2.4} /></span>
        <div><span class="detail">{msg.result[st]}</span></div>
        <div class="amount num">{amount}</div>
        {balance && <BalanceMove before={balance.before} after={balance.after} label={msg.result.balance} locale={locale} />}
        <p style="color:var(--text-2)">{sub}</p>
        {m.kind === "match_bet" && <div class="vscard"><MarketVs m={m} size={36} />{reasonOf(m, msg) && <span class="reason big">{reasonOf(m, msg)}</span>}</div>}
        <p class="q" style="font-weight:600"><Q m={m} msg={msg} locale={locale} city={cityName(city, locale)} tz={city.timezone} /></p>
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
