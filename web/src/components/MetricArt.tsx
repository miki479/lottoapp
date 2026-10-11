import { CloudFog, Snowflake, Sun, Thermometer, Wind } from "lucide-preact";
import { useRef } from "preact/hooks";
import type { MarketRow } from "../lib/format.ts";
import type { Messages } from "../i18n/index.ts";

let uid = 0;
/** Crack line shared by both halves, running across the road and down the soil. */
const CRACK = "160,34 168,46 154,58 166,70 152,82 164,94 158,104";
/** Outline of the whole slab: it is the black "hole" that shows when the halves move apart. */
const SLAB = "22,36 298,36 316,66 316,102 4,102 4,66";

/**
 * A slab of land with a road across it. While "yes" is hovered or pressed it tears along a black crack
 * (the right half sinks a little); when the pointer leaves, the two halves slide back together.
 */
function QuakeScene({ hint, label }: { hint?: "yes" | "no" | null; label: string }) {
  const id = useRef(`q${++uid}`).current;
  const scene = (
    <>
      <polygon points="22,36 298,36 316,66 4,66" fill="#7bb661" />
      <polygon points="38,44 282,44 298,58 22,58" fill="#4b4e57" />
      <path d="M44 51 H66 M84 51 H106 M124 51 H146 M174 51 H196 M214 51 H236 M254 51 H276" stroke="#ffd45e" stroke-width="2.200" stroke-linecap="round" />
      <path d="M38 44 L282 44 M22 58 L298 58" stroke="#e9eef5" stroke-width="1.200" opacity=".7" />
      <rect x="4" y="66" width="312" height="36" fill="#9a6a42" />
      <rect x="4" y="66" width="312" height="5" fill="#5f9c4b" />
      <path d="M4 82 H316" stroke="#845630" stroke-width="2" /><path d="M4 92 H316" stroke="#6b4425" stroke-width="2" />
      <g fill="#b9a58c"><circle cx="40" cy="78" r="3" /><circle cx="92" cy="88" r="3.500" /><circle cx="224" cy="80" r="3" /><circle cx="272" cy="90" r="3.500" /><circle cx="130" cy="97" r="2.500" /></g>
    </>
  );
  return (
    <div class={`quakescene ${hint === "yes" ? "split" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 320 110">
        <defs>
          <clipPath id={`${id}l`}><polygon points={`0,0 ${CRACK} 0,110`} /></clipPath>
          <clipPath id={`${id}r`}><polygon points={`${CRACK} 320,110 320,0`} /></clipPath>
        </defs>
        <ellipse cx="160" cy="104" rx="150" ry="4" fill="rgba(0,0,0,.18)" />
        <polygon points={SLAB} fill="#0a0a0c" />
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
