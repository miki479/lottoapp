import { useEffect, useRef, useState } from "preact/hooks";
import { boostedPayout } from "../../../shared/wallet.ts";
import { useCountUp } from "../lib/anim.ts";
import { haptic } from "../lib/haptics.ts";
import { money } from "../lib/format.ts";
import { currencySymbol, moneySigned } from "../lib/num.ts";
import { balanceAfter, outcomes } from "../lib/stake.ts";
import type { Locale, Messages } from "../i18n/index.ts";

const ALL: Record<string, string> = { it: "Tutto", "en-US": "All", "en-GB": "All", ja: "全額" };
const COIN_RAIN = Array.from({ length: 16 }, (_, i) => ({ left: (i * 37 + 8) % 96, delay: ((i * 53) % 100) / 70, dur: 1.8 + ((i * 29) % 10) / 6, e: i % 2 ? "🤩" : "💸" }));

/**
 * The amount of a bet: a big centred figure that warms up (violet -> magenta -> orange) and pops as the stake grows, a slider with a number field beside it, the
 * presets 10 / 25 / 50 / 100 / All, the balance once it is paid, and the two outcomes side by side (lose on the left, win on the right, same size).
 * At the whole balance the figure turns into "All In".
 */
export function StakeControl(p: { value: number; onChange: (n: number) => void; cap: number; odds: number; balance?: number; boost?: boolean; vice?: number; fancy?: boolean; locale: Locale; msg: Messages }) {
  const lo = 10, hi = Math.max(lo + 10, p.cap);
  const heat = (p.value - lo) / (hi - lo);
  const hue = Math.round((260 + 130 * heat) % 360);
  const base = p.boost ? boostedPayout(p.value, p.odds) : Math.floor(p.value * p.odds);
  // the optional Bonus Vice adds a share of the total paid out, on top of the boost
  const gross = base + (p.vice ? Math.floor(Math.floor(p.value * p.odds) * p.vice / 100) : 0);
  const sides = outcomes(p.value, gross);
  const win = useCountUp(sides.win, 450);
  const fill = Math.round(Math.sqrt(Math.max(0, heat)) * 100);
  // the slider is finer at the low end: a squared scale, in steps that grow with the range
  const step = hi > 20000 ? 100 : hi > 2000 ? 50 : 10;
  const fromSlider = (t: number) => { const v = lo + (hi - lo) * (t / 1000) ** 2; return t >= 1000 ? hi : Math.max(lo, Math.min(hi, Math.round(v / step) * step)); };
  const pos = Math.round(1000 * Math.sqrt(Math.max(0, heat)));
  const bal = p.balance !== undefined ? Math.floor(p.balance) : -1;
  const allIn = bal >= 100 && p.value >= bal && hi >= bal;
  // leaving All In plays the opposite: the words are sucked back into the number
  const [leaving, setLeaving] = useState(false);
  const was = useRef(false);
  useEffect(() => {
    const prev = was.current; was.current = allIn;
    if (prev && !allIn) { setLeaving(true); const t = window.setTimeout(() => setLeaving(false), 800); return () => window.clearTimeout(t); }
    if (allIn) setLeaving(false);
  }, [allIn]);
  // the number field: typing sets the stake as soon as it is a valid amount, the field is tidied up when it loses the focus
  const [text, setText] = useState(String(p.value)), typing = useRef(false);
  useEffect(() => { if (!typing.current) setText(String(p.value)); }, [p.value]);
  const typed = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 7), n = Number(digits);
    if (n > hi) { setText(String(hi)); p.onChange(hi); return; }
    setText(digits);
    if (digits && n >= lo) p.onChange(n);
  };
  const settle = () => { typing.current = false; const n = Number(text); const v = text !== "" && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : p.value; setText(String(v)); p.onChange(v); };
  const share = bal > 0 ? Math.min(100, Math.round((p.value / bal) * 100)) : null;
  return (
    <div class={`stakectl ${allIn ? "allin" : ""}`}>
      <div class="stakehead"><span class="detail">{p.msg.stake.label}</span>{share !== null && <span class="pctbal num">{p.msg.sheet.share(share)}</span>}</div>
      <output class={`glow pop ${p.fancy && p.value >= hi ? "vicemax" : ""} ${allIn || leaving ? "isallin" : ""}`} key={allIn ? "a" : leaving ? "l" : p.value} aria-live="polite" style={`--hue:${hue};--halo:${Math.round(10 + 26 * heat)}px`}>
        {allIn
          ? <span class="aistack"><span class="ainum">{money(p.value, p.locale)}</span><span class="aiword" aria-label="All In">ALL IN<span class="aiburst" aria-hidden="true" /></span></span>
          : leaving
            ? <span class="aistack"><span class="ainum aiback">{money(p.value, p.locale)}</span><span class="aiword aisuck" aria-hidden="true">ALL IN</span></span>
            : money(p.value, p.locale)}
      </output>
      {allIn && <div class="airain" aria-hidden="true">{COIN_RAIN.map((c, i) => <span key={i} style={`left:${c.left}%;animation-delay:${c.delay}s;animation-duration:${c.dur}s`}>{c.e}</span>)}</div>}
      <div class="stakeline">
        <input class="range" type="range" min={0} max={1000} step={1} value={pos} aria-label={p.msg.stake.label}
          style={`--fill:${fill}%;--hue:${hue}`}
          onInput={(e) => { p.onChange(fromSlider(Number((e.target as HTMLInputElement).value))); haptic.tap(); }} />
        <label class="stakein"><input type="text" inputMode="numeric" pattern="[0-9]*" autocomplete="off" value={text} aria-label={p.msg.stake.label}
          onFocus={(e) => { typing.current = true; (e.target as HTMLInputElement).select(); }} onInput={(e) => typed((e.target as HTMLInputElement).value)} onBlur={settle}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} /><span aria-hidden="true">{currencySymbol(p.locale)}</span></label>
      </div>
      <div class="quickstake" role="group" aria-label={p.msg.stake.label}>
        {[10, 25, 50, 100].filter((v) => v < hi).map((v) => <button key={v} type="button" class={p.value === v ? "on" : ""} onClick={() => { p.onChange(v); haptic.tap(); }}>{v}</button>)}
        <button type="button" class={p.value >= hi ? "on" : ""} onClick={() => { p.onChange(hi); haptic.tap(); }}>{ALL[p.locale] ?? ALL["en-US"]}</button>
      </div>
      <div class="stakemeta"><span>{p.msg.sheet.after}: <b class="num">{money(balanceAfter(bal >= 0 ? bal : p.value, p.value), p.locale)}</b></span><span class="num">{p.msg.stake.max(money(hi, p.locale))}</span></div>
      <div class="outcomes">
        <div class="out lose"><span class="ol">{p.msg.sheet.ifLose}</span><b class="num">{moneySigned(sides.lose, p.locale)}</b><small>{p.msg.sheet.loseNote}</small></div>
        <div class="out win"><span class="ol">{p.msg.sheet.ifWin}</span><b class="num" data-moving={win !== sides.win ? "1" : undefined}>{moneySigned(win, p.locale)}</b><small class="num">{p.msg.sheet.winNote(money(sides.back, p.locale))}</small></div>
      </div>
    </div>
  );
}
