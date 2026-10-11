import type { WeatherObservation } from "../types.ts";
import type { WeatherAdapter } from "./types.ts";

/**
 * Open-Meteo hourly response → one observation per hour.
 * Request it with `timezone=auto` or a fixed zone; `utc_offset_seconds` converts local times back to UTC.
 */
export const openMeteoAdapter: WeatherAdapter = (json, feedId) => {
  const j = json as {
    utc_offset_seconds?: number;
    hourly?: { time?: string[]; precipitation?: Array<number | null> };
  };
  const times = j?.hourly?.time;
  const precip = j?.hourly?.precipitation;
  if (!times || !precip || typeof j.utc_offset_seconds !== "number") return [];
  const out: WeatherObservation[] = [];
  times.forEach((t, i) => {
    const mm = precip[i];
    if (typeof mm !== "number") return;
    const localAsUtc = Date.parse(`${t}:00Z`) / 1000;
    if (!Number.isFinite(localAsUtc)) return;
    out.push({ feedId, hourStart: localAsUtc - j.utc_offset_seconds!, precipitationMm: mm });
  });
  return out;
};
