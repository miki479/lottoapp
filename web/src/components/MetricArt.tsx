import { Activity, CloudFog, Snowflake, Sun, Thermometer, Wind } from "lucide-preact";
import type { MarketRow } from "../lib/format.ts";
import type { Messages } from "../i18n/index.ts";

const ICON = { temp: Thermometer, wind: Wind, snow: Snowflake, uv: Sun, aqi: CloudFog } as const;

/** Small illustration for non-rain weather questions and earthquakes: an icon, plus what the forecast says. */
export function MetricArt({ m, msg, hint }: { m: MarketRow; msg: Messages; hint?: "yes" | "no" | null }) {
  if (m.kind === "quake_m") return <div class={`metricart quake ${hint ?? ""}`} aria-hidden="true"><span class="ring r1" /><span class="ring r2" /><Activity size={30} /><b>{msg.wx.quakeArt}</b></div>;
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
