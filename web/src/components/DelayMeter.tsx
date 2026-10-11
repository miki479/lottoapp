import { Minus, TrendingDown, TrendingUp } from "lucide-preact";
import type { Messages } from "../i18n/index.ts";
import { useCountUp } from "../lib/anim.ts";

const CELLS = 12;
/** Severity colour: violet -> magenta -> amber. Deliberately not red/green, those mean lost/won. */
const hue = (t: number) => (255 + 135 * t) % 360;

/**
 * How late is it right now? A big number, a segmented gauge whose middle tick is the bet's limit
 * (the gauge is full at twice the limit) and a trend chip: "getting worse / better in the last 10 minutes".
 */
export function DelayMeter(p: { sec: number; prev: number | null; limitSec: number; forecast?: boolean; msg: Messages; big?: boolean }) {
  const { sec, msg } = p;
  const shown = useCountUp(Math.round(sec / 60), 500);
  const ratio = Math.max(0, Math.min(1, sec / (2 * p.limitSec)));
  const filled = Math.round(ratio * CELLS);
  const diff = p.prev === null ? 0 : Math.round((sec - p.prev) / 60);
  const Trend = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const text = diff > 0 ? msg.meter.up(diff) : diff < 0 ? msg.meter.down(-diff) : msg.meter.steady;
  return (
    <div class={`meter ${p.big ? "big" : ""}`} aria-label={`${shown}′ ${msg.meter.late}`}>
      <div class="mtop">
        <b class="mnum num" style={`color:hsl(${hue(ratio)} 95% 66%)`}>{sec < 0 ? "−" : "+"}{Math.abs(shown)}<small>′</small></b>
        <span class="mtrend"><Trend size={14} />{p.prev === null ? (p.forecast ? msg.meter.forecast : msg.meter.late) : text}</span>
      </div>
      <div class="cells" aria-hidden="true">
        {Array.from({ length: CELLS }, (_, i) => <i key={i} class={i < filled ? "on" : ""} style={`--h:${hue(i / (CELLS - 1))};--d:${i * 28}ms`} />)}
        <em style={`left:${100 / 2}%`}><span>{msg.meter.threshold(Math.round(p.limitSec / 60))}</span></em>
      </div>
    </div>
  );
}
