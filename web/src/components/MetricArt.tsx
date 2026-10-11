import { CloudFog, Megaphone, Snowflake, Sun, Thermometer, Wind } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import type { MarketRow } from "../lib/format.ts";
import type { Messages } from "../i18n/index.ts";

/** Skyline: [x, width, height] of each tower. */
const TOWERS: [number, number, number][] = [[6, 26, 50], [30, 22, 70], [52, 30, 42], [80, 20, 80], [98, 34, 58], [130, 24, 94], [152, 28, 54], [178, 22, 76], [198, 34, 46], [230, 24, 86], [252, 28, 60], [278, 22, 72], [298, 24, 48]];

/**
 * Black skyscrapers against a sunset. Hovering or pressing "yes" makes the quake build up and the towers sway;
 * the tremor builds up gradually as a rolling wave; moving to "no" (or away) lets it die down slowly.
 */
function QuakeScene({ hint, label, mag }: { hint?: "yes" | "no" | null; label: string; mag: number }) {
  const [phase, setPhase] = useState<"idle" | "shake" | "settle">("idle");
  useEffect(() => {
    if (hint === "yes") { setPhase("shake"); return; }
    setPhase((p) => (p === "shake" ? "settle" : p));
  }, [hint]);
  useEffect(() => {
    if (phase !== "settle") return;
    const t = setTimeout(() => setPhase("idle"), 3600);
    return () => clearTimeout(t);
  }, [phase]);
  return (
    <div class={`quakescene ${phase}`} style={`--mag:${Math.min(1.5, Math.max(0.7, 0.7 + (mag - 5) * 0.4)).toFixed(2)}`} aria-hidden="true">
      <svg viewBox="0 0 320 110" preserveAspectRatio="xMidYMax slice">
        <defs><linearGradient id="qsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3a8a" /><stop offset=".45" stop-color="#e2557c" /><stop offset=".8" stop-color="#ffae57" /><stop offset="1" stop-color="#ffe29a" /></linearGradient></defs>
        <rect width="320" height="110" fill="url(#qsky)" />
        <circle cx="206" cy="92" r="28" fill="#fff1b8" opacity=".95" />
        <g class="birds">
          {[[0, 20, 9, 0], [1, 34, 12, 2.2], [2, 14, 7, 4.5], [3, 28, 10, 6.4], [4, 40, 8, 8.8]].map(([k, y, d, delay]) => (
            <g key={k} class="bird" style={`--y:${y}px;--d:${d}s;--w:${delay}s`}><path d="M0 0q3-4 6 0q3-4 6 0" fill="none" stroke="#1a1424" stroke-width="1.300" stroke-linecap="round" /></g>
          ))}
        </g>
        <g class="towers">
          {TOWERS.map(([x, w, h], k) => (
            <g key={x} class="tw" style={`--a:${(0.8 + (k % 4) * 0.35).toFixed(2)};--o:${(-k * 0.11).toFixed(2)}s`}>
              <rect x={x} y={104 - h} width={w} height={h + 6} fill="#0c0b12" />
              {h > 85 && <rect x={x + w / 2 - 1} y={104 - h - 12} width="2" height="12" fill="#0c0b12" />}
              {Array.from({ length: Math.floor(h / 14) }, (_, r) => ((k * 7 + r * 5) % 4 === 0 ? <rect key={r} x={x + 4 + ((k + r) % 2) * (w / 2)} y={104 - h + 6 + r * 14} width="3" height="4" fill="#ffd27a" opacity=".85" /> : null))}
            </g>
          ))}
        </g>
        <rect y="104" width="320" height="6" fill="#0c0b12" />
      </svg>
      <b>{label}</b>
    </div>
  );
}

const ICON = { temp: Thermometer, wind: Wind, snow: Snowflake, uv: Sun, aqi: CloudFog } as const;

/** Small illustration for non-rain weather questions and earthquakes: an icon, plus what the forecast says. */
export function MetricArt({ m, msg, hint }: { m: MarketRow; msg: Messages; hint?: "yes" | "no" | null }) {
  if (m.kind === "strike_on") return <div class={`metricart strike ${hint ?? ""}`} aria-hidden="true"><Megaphone size={30} /><b>{msg.strikes.art}</b>{typeof m.params.hours === "string" && m.params.hours && <span class="num">{String(m.params.hours).slice(0, 40)}</span>}</div>;
  if (m.kind === "quake_m") return <QuakeScene hint={hint} label={m.params.region ? msg.wx.regions[String(m.params.region)] ?? msg.wx.quakeArt : msg.wx.quakeArt} mag={Number(m.params.minMag ?? 5)} />;
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
