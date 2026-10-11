import { INTL_TAG, type Locale, type Messages } from "../i18n/index.ts";

export interface MarketRow {
  id: string;
  city_id: string;
  category: "bus" | "train" | "weather" | "traffic" | "nature" | "strike";
  kind: "bus_delay_gt" | "train_delay_gt" | "rain_at" | "metric_gt" | "quake_m" | "strike_on";
  params: Record<string, unknown>;
  closes_at: string;
  target_at: string;
  odds_yes: number;
  odds_no: number;
  status: string;
  flash_multiplier?: number;
  flash_until?: string | null;
  flash_kind?: "weather_alert" | "rush" | null;
}

/** "08:30", or "Mon 08:30" when the day differs from today in that timezone. */
export function formatWhen(iso: string, locale: Locale, timeZone: string, now = new Date()): string {
  const d = new Date(iso);
  const tag = INTL_TAG[locale];
  const day = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(x);
  const time = new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(d);
  if (day(d) === day(now)) return time;
  return `${new Intl.DateTimeFormat(tag, { weekday: "short", timeZone }).format(d)} ${time}`;
}

export function question(m: MarketRow, msg: Messages, locale: Locale, cityName: string, timeZone: string, now = new Date()): string {
  const time = formatWhen(m.target_at, locale, timeZone, now);
  if (m.kind === "rain_at") return msg.question.rain({ city: cityName, time });
  if (m.kind === "metric_gt") return msg.question.metric({ metric: m.params.metric as "temp", city: cityName, time, value: Number(m.params.threshold), unit: String(m.params.unit ?? "") });
  if (m.kind === "strike_on") return msg.question.strike({ date: "", day: new Intl.DateTimeFormat(INTL_TAG[locale], { day: "numeric", month: "long", timeZone }).format(new Date(m.target_at)), who: [m.params.sector, m.params.unions].filter(Boolean).join(" · "), hours: String(m.params.hours ?? "") });
  if (m.kind === "quake_m") {
    // The window is global, so it is shown in the player's own time zone.
    // A regional question is told in that region's local time; a worldwide one in the player's own.
    const regionKey = m.params.region as string | undefined;
    const tz = regionKey ? String(m.params.tz ?? timeZone) : Intl.DateTimeFormat().resolvedOptions().timeZone;
    return msg.question.quake({ mag: Number(m.params.minMag).toFixed(1), from: formatWhen(m.closes_at, locale, tz, now), to: formatWhen(m.target_at, locale, tz, now), region: regionKey ? msg.wx.regions[regionKey] ?? regionKey : undefined });
  }
  const p = m.params;
  const q = {
    route: String(p.routeName ?? p.routeId ?? ""),
    headsign: String(p.headsign ?? ""),
    stop: String(p.stopName ?? p.stopId ?? ""),
    time,
    min: Math.round(Number(p.thresholdSec ?? 180) / 60),
  };
  return m.kind === "train_delay_gt" ? msg.question.train(q) : msg.question.bus(q);
}

export const minutesUntil = (iso: string, now = Date.now()) => Math.max(0, Math.floor((Date.parse(iso) - now) / 60000));

/** "05:12" under an hour, "2h 05m" above. */
export function countdown(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}h ${p(m)}m` : `${p(m)}:${p(sec)}`;
}

/** Credits returned by a winning 10-credit bet. */
export const per10 = (odds: number) => Math.floor(10 * odds);

/** Local calendar day "YYYY-MM-DD" in a timezone. */
export const dayIn = (tz: string, d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);

/** Days left in the current calendar month (UTC), at least 1. */
export function seasonDaysLeft(now = new Date()): number {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return Math.max(1, Math.ceil((end - now.getTime()) / 86400000));
}

/** "3,07" in Italian, "3.07" in English. */
export const fmtOdds = (odds: number, locale: Locale) => new Intl.NumberFormat(INTL_TAG[locale], { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(odds);

/** Play money is shown with the currency of the audience ($ / € / £). It is fake: the disclaimer says so everywhere. */
const CURRENCY: Record<Locale, string> = { it: "EUR", "en-US": "USD", "en-GB": "GBP", ja: "JPY" };
export function currencySymbol(locale: Locale): string {
  return new Intl.NumberFormat(INTL_TAG[locale], { style: "currency", currency: CURRENCY[locale], currencyDisplay: "narrowSymbol" }).formatToParts(0).find((p) => p.type === "currency")?.value ?? "";
}
export function money(n: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_TAG[locale], { style: "currency", currency: CURRENCY[locale], currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 }).format(n);
}

/** "+€40" / "−€10" / "€10" for the outcome screen, card and list. */
export function resultAmount(st: "won" | "lost" | "void", stake: number, payout: number, locale: Locale): string {
  return st === "won" ? `+${money(payout - stake, locale)}` : st === "lost" ? `−${money(stake, locale)}` : money(stake, locale);
}

/** Delay questions have a "late / on time" answer; everything else (rain, temperature, quakes…) is a plain yes / no. */
export const isYesNo = (kind: string) => !kind.endsWith("_delay_gt");
