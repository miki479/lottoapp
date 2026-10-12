import { computeOdds } from "./odds.ts";
import { localDayStart } from "./time.ts";

/** Weather-style measurements beyond rain. One hourly value per place, compared with a threshold. */
export type MetricId = "temp" | "wind" | "snow" | "uv" | "aqi" | "hail";

export interface MetricDef {
  /** Open-Meteo hourly variable. */
  api: string;
  /** "forecast" or "air-quality" API. */
  source: "forecast" | "air";
  unit: string;
  /** Typical forecast error (one standard deviation), used to price the question. */
  sigma: number;
  /** Threshold granularity. */
  step: number;
  /** Local hour of the question (the answer comes from that whole hour). */
  hour: number;
  /** Plausible range: anything outside is treated as bad data. */
  min: number;
  max: number;
  /** Turns the raw API value into the stored one (hail: weather code -> 1 if thunderstorm with hail). */
  transform?: (v: number) => number;
}

export const METRICS: Record<MetricId, MetricDef> = {
  temp: { api: "temperature_2m", source: "forecast", unit: "°C", sigma: 2, step: 1, hour: 15, min: -90, max: 60 },
  wind: { api: "wind_gusts_10m", source: "forecast", unit: "km/h", sigma: 7, step: 5, hour: 15, min: 0, max: 400 },
  snow: { api: "snowfall", source: "forecast", unit: "cm", sigma: 0.3, step: 0.1, hour: 12, min: 0, max: 50 },
  uv: { api: "uv_index", source: "forecast", unit: "", sigma: 1.2, step: 1, hour: 13, min: 0, max: 16 },
  aqi: { api: "european_aqi", source: "air", unit: "", sigma: 12, step: 10, hour: 12, min: 0, max: 500 },
  /** Hail: WMO weather code 96 or 99 (thunderstorm with hail) in that hour. Only offered through player-made questions. */
  hail: { api: "weather_code", source: "forecast", unit: "", sigma: 1, step: 1, hour: 15, min: 0, max: 1, transform: (v) => (v >= 96 ? 1 : 0) },
};
export const METRIC_IDS = Object.keys(METRICS) as MetricId[];

/** Standard normal CDF (Abramowitz–Stegun 7.1.26). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** Threshold for a forecast value: the forecast rounded to the step, so the question is a fair coin flip. Snow is always "any snow". */
export function thresholdFor(metric: MetricId, forecast: number): number {
  if (metric === "snow") return 0.1;
  const { step } = METRICS[metric];
  return Math.round(forecast / step) * step;
}

/** "Will the measured value be >= threshold?" given the forecast and its typical error. */
export function metricOdds(metric: MetricId, forecast: number, threshold: number) {
  const p = 1 - normalCdf((threshold - forecast) / METRICS[metric].sigma);
  return computeOdds(Math.min(0.9, Math.max(0.1, p)));
}

/** Is a market worth offering for this forecast? (Nobody bets on UV at night or on snow in the tropics.) */
export function worthOffering(metric: MetricId, forecast: number, tempAround?: number): boolean {
  if (!Number.isFinite(forecast)) return false;
  if (metric === "hail") return false;
  if (metric === "uv") return forecast >= 2;
  if (metric === "snow") return forecast >= 0.05 || (tempAround !== undefined && tempAround <= 1 && forecast > 0);
  if (metric === "wind") return forecast >= 15;
  return true;
}

export interface MetricMarketInsert {
  city_id: string; category: "weather"; kind: "metric_gt"; feed_id: string; params: { metric: MetricId; threshold: number; unit: string; localHour: number; forecast: number };
  closes_at: string; target_at: string; deadline_at: string; odds_yes: number; odds_no: number; dedupe_key: string;
}

/**
 * One question per metric per local day (today's still-open hours and tomorrow's), priced from the hourly forecast.
 * `series[metric]` maps the epoch of an hour start to the forecast value for that hour.
 */
export function buildMetricMarkets(o: { id: string; tz: string; nowEpoch: number; series: Partial<Record<MetricId, Map<number, number>>> }): MetricMarketInsert[] {
  const out: MetricMarketInsert[] = [];
  const days = [localDayStart(o.nowEpoch, o.tz), localDayStart(o.nowEpoch + 86400, o.tz)];
  for (const dayStart of days) {
    for (const metric of METRIC_IDS) {
      const def = METRICS[metric];
      const series = o.series[metric];
      if (!series) continue;
      const targetAt = dayStart + def.hour * 3600 + 1800;
      if (targetAt - 600 <= o.nowEpoch + 300) continue;
      const forecast = series.get(Math.floor(targetAt / 3600) * 3600);
      if (forecast === undefined) continue;
      const tempAround = o.series.temp?.get(Math.floor(targetAt / 3600) * 3600);
      if (!worthOffering(metric, forecast, tempAround)) continue;
      const threshold = thresholdFor(metric, forecast);
      if (metric !== "snow" && threshold <= 0 && metric !== "temp") continue;
      const odds = metricOdds(metric, forecast, threshold);
      out.push({
        city_id: o.id, category: "weather", kind: "metric_gt", feed_id: `om-${o.id}`,
        params: { metric, threshold: Math.round(threshold * 10) / 10, unit: def.unit, localHour: def.hour, forecast: Math.round(forecast * 10) / 10 },
        closes_at: new Date((targetAt - 600) * 1000).toISOString(), target_at: new Date(targetAt * 1000).toISOString(),
        deadline_at: new Date((Math.floor(targetAt / 3600) * 3600 + 3600 + 5 * 3600) * 1000).toISOString(),
        odds_yes: odds.yes, odds_no: odds.no, dedupe_key: `${o.id}|metric_${metric}|${targetAt}`,
      });
    }
  }
  return out;
}
