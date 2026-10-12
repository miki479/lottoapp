import { boostedPayout } from "../../../shared/wallet.ts";
import { useCountUp } from "../lib/anim.ts";
import { haptic } from "../lib/haptics.ts";
import { money } from "../lib/format.ts";
import type { Locale, Messages } from "../i18n/index.ts";

/** Big glowing stake number + slider. The number warms up (violet -> magenta -> orange) and pops as the stake grows. */
export function StakeControl(p: { value: number; onChange: (n: number) => void; cap: number; odds: number; boost?: boolean; locale: Locale; msg: Messages }) {
  const lo = 10, hi = Math.max(lo + 10, p.cap);
  const heat = (p.value - lo) / (hi - lo);
  const hot = `hsl(${(260 + 130 * heat) % 360} 95% 68%)`;
  const gross = p.boost ? boostedPayout(p.value, p.odds) : Math.floor(p.value * p.odds);
  const win = useCountUp(gross, 450);
  const fill = Math.round(heat * 100);
  return (
    <div class="stakectl">
      <span class="detail">{p.msg.stake.label}</span>
      <output class="glow pop" key={p.value} aria-live="polite" style={`--hot:${hot};--halo:${Math.round(10 + 26 * heat)}px`}>{money(p.value, p.locale)}</output>
      <input class="range" type="range" min={lo} max={hi} step={10} value={p.value} aria-label={p.msg.stake.label}
        style={`--fill:${fill}%;--hot:${hot}`}
        onInput={(e) => { p.onChange(Number((e.target as HTMLInputElement).value)); haptic.tap(); }} />
      <div class="rangelabels"><span>{money(lo, p.locale)}</span><span>{p.msg.stake.max(money(hi, p.locale))}</span></div>
      <div class="summary"><span>{p.msg.stake.ifRight}</span><b class="num shine" data-moving={win !== gross ? "1" : undefined}>{money(win, p.locale)}</b></div>
    </div>
  );
}
