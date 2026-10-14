import { Minus, TrendingDown, TrendingUp } from "lucide-preact";
import type { Messages } from "../i18n/index.ts";
import { useCountUp } from "../lib/anim.ts";
import { fmtSigned, minUnit } from "../lib/num.ts";

const CELLS = 12;
/** Severity colour: violet -> magenta -> amber. Deliberately not red/green, those mean lost/won. */
const hue = (t: number) => (255 + 135 * t) % 360;

/**
 * How late is it right now? A big number, a segmented gauge whose middle tick is the bet's limit
 * (the gauge is full at twice the limit, and the scale widens for bigger delays) and a trend chip: "getting worse / better in the last 10 minutes".
 */
export function DelayMeter(p: { sec: number; prev: number | null; limitSec: number; forecast?: boolean; observedAt?: string; now?: number; msg: Messages; big?: boolean }) {
  const { sec, msg } = p;
  const shown = useCountUp(Math.round(sec / 60), 500);
  // The gauge is full at twice the limit; a delay beyond that doubles the scale (4x, 8x, 16x the limit) so +11 and +18 no longer look the same, and the limit tick moves left with it.
  const span = [2, 4, 8, 16].find((k) => sec <= k * p.limitSec) ?? 16;
  const ratio = Math.max(0, Math.min(1, sec / (span * p.limitSec)));
  const filled = Math.round(ratio * CELLS);
  const diff = p.prev === null ? 0 : Math.round((sec - p.prev) / 60);
  const Trend = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const text = diff > 0 ? msg.meter.up(diff) : diff < 0 ? msg.meter.down(-diff) : msg.meter.steady;
  return (
    <div class={`meter ${p.big ? "big" : ""}`} role="group" aria-label={`${shown} min ${msg.meter.late}`}>
      <div class="mtop">
        <b class="mnum num" style={`--sev:${Math.round(hue(ratio))}`}>{fmtSigned(sec < 0 ? -Math.abs(shown) : Math.abs(shown))}<small> {minUnit()}</small></b>
        <span class="mtrend"><Trend size={14} />{p.prev === null ? (p.forecast ? msg.meter.forecast : msg.meter.late) : text}</span>
      </div>
      <div class="cells" aria-hidden="true">
        {Array.from({ length: CELLS }, (_, i) => <i key={i} class={i < filled ? "on" : ""} style={`--h:${hue(i / (CELLS - 1))};--d:${i * 28}ms`} />)}
        <em class={span > 2 ? "lo" : ""} style={`left:${100 / span}%`}><span>{msg.meter.threshold(Math.round(p.limitSec / 60))}</span></em>
        <u class="sweep" />
      </div>
      {p.observedAt && p.now !== undefined && <small class="mupd">{msg.insight.updated(Math.max(0, Math.round((p.now - Date.parse(p.observedAt)) / 60_000)))}</small>}
    </div>
  );
}
