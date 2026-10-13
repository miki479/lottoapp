import { boostedPayout } from "../../../shared/wallet.ts";
import { useCountUp } from "../lib/anim.ts";
import { haptic } from "../lib/haptics.ts";
import { money } from "../lib/format.ts";
import type { Locale, Messages } from "../i18n/index.ts";

const WARN: Record<string, (pct: number) => string> = {
  it: (n) => `Stai puntando il ${n}% dei tuoi crediti.`,
  "en-US": (n) => `You are betting ${n}% of your credits.`,
  "en-GB": (n) => `You are betting ${n}% of your credits.`,
  ja: (n) => `クレジットの${n}%を賭けようとしています。`,
};
const COIN_RAIN = Array.from({ length: 16 }, (_, i) => ({ left: (i * 37 + 8) % 96, delay: ((i * 53) % 100) / 70, dur: 1.8 + ((i * 29) % 10) / 6, e: i % 2 ? "🤩" : "💸" }));
const LETTERS = ["A", "l", "l", " ", "I", "n"];

/** Big glowing stake number + slider. The number warms up (violet -> magenta -> orange) and pops as the stake grows. At the whole balance it turns into "All In". */
export function StakeControl(p: { value: number; onChange: (n: number) => void; cap: number; odds: number; balance?: number; boost?: boolean; vice?: number; fancy?: boolean; locale: Locale; msg: Messages }) {
  const lo = 10, hi = Math.max(lo + 10, p.cap);
  const heat = (p.value - lo) / (hi - lo);
  const hot = `hsl(${(260 + 130 * heat) % 360} 95% 68%)`;
  const base = p.boost ? boostedPayout(p.value, p.odds) : Math.floor(p.value * p.odds);
  // the optional Bonus Vice adds a share of the total paid out, on top of the boost
  const gross = base + (p.vice ? Math.floor(Math.floor(p.value * p.odds) * p.vice / 100) : 0);
  const win = useCountUp(gross, 450);
  const fill = Math.round(Math.sqrt(Math.max(0, heat)) * 100);
  // the slider is finer at the low end: a squared scale, in steps that grow with the range
  const step = hi > 20000 ? 100 : hi > 2000 ? 50 : 10;
  const fromSlider = (t: number) => { const v = lo + (hi - lo) * (t / 1000) ** 2; return t >= 1000 ? hi : Math.max(lo, Math.min(hi, Math.round(v / step) * step)); };
  const pos = Math.round(1000 * Math.sqrt(Math.max(0, heat)));
  const bal = p.balance !== undefined ? Math.floor(p.balance) : -1;
  const allIn = bal >= 100 && p.value >= bal && hi >= bal;
  const share = bal > 0 ? Math.round((p.value / bal) * 100) : 0;
  const warn = !allIn && share >= 50 && p.value >= 200;
  return (
    <div class={`stakectl ${allIn ? "allin" : ""}`}>
      <span class="detail">{p.msg.stake.label}</span>
      <output class={`glow pop ${p.fancy && p.value >= hi ? "vicemax" : ""} ${allIn ? "isallin" : ""}`} key={allIn ? "a" : p.value} aria-live="polite" style={`--hot:${hot};--halo:${Math.round(10 + 26 * heat)}px`}>
        {allIn ? <span class="ailetters" aria-label="All In">{LETTERS.map((c, i) => <i key={i} style={`--i:${i}`}>{c === " " ? " " : c}</i>)}<span class="aiemo"> 🤩💸</span></span> : money(p.value, p.locale)}
      </output>
      {allIn && <div class="airain" aria-hidden="true">{COIN_RAIN.map((c, i) => <span key={i} style={`left:${c.left}%;animation-delay:${c.delay}s;animation-duration:${c.dur}s`}>{c.e}</span>)}</div>}
      <input class="range" type="range" min={0} max={1000} step={1} value={pos} aria-label={p.msg.stake.label}
        style={`--fill:${fill}%;--hot:${hot}`}
        onInput={(e) => { p.onChange(fromSlider(Number((e.target as HTMLInputElement).value))); haptic.tap(); }} />
      <div class="rangelabels"><span>{money(lo, p.locale)}</span><span>{p.msg.stake.max(money(hi, p.locale))}</span></div>
      {allIn && <p class="aimoney">{money(p.value, p.locale)}</p>}
      {warn && <p class="stakewarn" role="status">{(WARN[p.locale] ?? WARN["en-US"]!)(share)}</p>}
      <div class="summary"><span>{p.msg.stake.ifRight}</span><b class="num shine" data-moving={win !== gross ? "1" : undefined}>{money(win, p.locale)}</b></div>
    </div>
  );
}
