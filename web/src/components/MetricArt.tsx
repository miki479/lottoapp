import { CloudFog, Snowflake, Sun, Thermometer, Wind } from "lucide-preact";
import { useRef } from "preact/hooks";
import type { MarketRow } from "../lib/format.ts";
import type { Messages } from "../i18n/index.ts";

let uid = 0;
/** Crack line shared by both halves (x runs through the middle, jagged). */
const CRACK = "160,0 168,14 154,30 166,48 152,66 164,84 156,100 161,110";

/**
 * A piece of countryside that splits along a black crack while "yes" is hovered or pressed,
 * and closes again when the pointer leaves. The two halves are the same drawing, clipped on either side of the crack.
 */
function QuakeScene({ hint, label }: { hint?: "yes" | "no" | null; label: string }) {
  const id = useRef(`q${++uid}`).current;
  const scene = (
    <>
      <rect width="320" height="110" fill={`url(#${id}s)`} />
      <circle cx="262" cy="26" r="12" fill="#ffd45e" />
      <path d="M0 74 L48 40 L84 62 L128 30 L176 66 L222 38 L270 64 L320 44 V110 H0Z" fill="#8fa6c4" />
      <path d="M0 84 Q60 62 120 80 T240 76 T320 82 V110 H0Z" fill="#6fae5b" />
      <path d="M0 94 Q80 82 160 92 T320 90 V110 H0Z" fill="#8a5a36" />
      <path d="M0 102 H320 V110 H0Z" fill="#6d4426" />
      <g fill="#3f7d3a"><path d="M40 80 l8 -20 l8 20z" /><path d="M64 82 l7 -16 l7 16z" /><path d="M236 78 l8 -22 l8 22z" /><path d="M276 80 l7 -17 l7 17z" /></g>
      <g fill="#6d4426"><rect x="46" y="80" width="4" height="6" /><rect x="240" y="78" width="4" height="6" /></g>
    </>
  );
  return (
    <div class={`quakescene ${hint === "yes" ? "split" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 320 110" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd2f5" /><stop offset="1" stop-color="#e8f4ff" /></linearGradient>
          <clipPath id={`${id}l`}><polygon points={`0,0 ${CRACK} 0,110`} /></clipPath>
          <clipPath id={`${id}r`}><polygon points={`${CRACK} 320,110 320,0`} /></clipPath>
        </defs>
        <rect width="320" height="110" fill="#0a0a0c" />
        <g class="qh ql" clip-path={`url(#${id}l)`}>{scene}</g>
        <g class="qh qr" clip-path={`url(#${id}r)`}>{scene}</g>
      </svg>
      <b>{label}</b>
    </div>
  );
}

const ICON = { temp: Thermometer, wind: Wind, snow: Snowflake, uv: Sun, aqi: CloudFog } as const;

/** Small illustration for non-rain weather questions and earthquakes: an icon, plus what the forecast says. */
export function MetricArt({ m, msg, hint }: { m: MarketRow; msg: Messages; hint?: "yes" | "no" | null }) {
  if (m.kind === "quake_m") return <QuakeScene hint={hint} label={msg.wx.quakeArt} />;
  const metric = (m.params.metric as keyof typeof ICON) ?? "temp";
  const Icon = ICON[metric] ?? Thermometer;
  const f = m.params.forecast;
  return (
    <div class={`metricart ${metric} ${hint ?? ""}`} aria-hidden="true">
      <Icon size={30} />
      <b>{msg.wx.names[metric]}</b>
      {typeof f === "number" && metric !== "snow" && <span class="num">{msg.wx.forecast(`${f}${String(m.params.unit ?? "")}`)}</span>}
    </div>
  );
}
