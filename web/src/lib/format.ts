import { INTL_TAG, type Locale, type Messages } from "../i18n/index.ts";

export interface MarketRow {
  id: string;
  city_id: string;
  category: "bus" | "train" | "weather" | "traffic" | "nature" | "strike" | "finance" | "culture" | "sport";
  kind: "bus_delay_gt" | "train_delay_gt" | "rain_at" | "metric_gt" | "quake_m" | "strike_on" | "traffic_speed_lt" | "tick_gt" | "match_bet" | "bus_full";
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
  // the questions read "alle <time>": in Italian the day goes after the hour ("alle 16:00 di martedì"), not before it
  if (locale === "it") return `${time} di ${new Intl.DateTimeFormat(tag, { weekday: "long", timeZone }).format(d)}`;
  return `${new Intl.DateTimeFormat(tag, { weekday: "short", timeZone }).format(d)} ${time}`;
}

export function question(m: MarketRow, msg: Messages, locale: Locale, cityName: string, timeZone: string, now = new Date()): string {
  const time = formatWhen(m.target_at, locale, timeZone, now);
  // a question we wrote ourselves carries its own text in every language
  const own = (m.params as { q?: Record<string, string> }).q;
  if (own) return (locale === "it" ? own.it : locale === "ja" ? own.ja : own.en) ?? own.en ?? own.it ?? "";
  if (m.kind === "bus_full") return msg.question.full({ occ: m.params.occ as "empty", route: String(m.params.routeName ?? ""), stop: String(m.params.stopName ?? ""), time });
  // the answer counts the whole hour: the question names the hour, not the middle of it
  const h0 = new Date(Math.floor(new Date(m.target_at).getTime() / 3600_000) * 3600_000).toISOString(), h1 = new Date(Date.parse(h0) + 3600_000).toISOString();
  const hourFrom = formatWhen(h0, locale, timeZone, now), hourTo = new Intl.DateTimeFormat(INTL_TAG[locale], { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(new Date(h1));
  if (m.kind === "rain_at") return msg.question.rain({ city: cityName, time: hourFrom, to: hourTo });
  if (m.kind === "metric_gt") return msg.question.metric({ metric: m.params.metric as "temp", city: cityName, time: hourFrom, to: hourTo, value: Number(m.params.threshold), unit: String(m.params.unit ?? "") });
  if (m.kind === "traffic_speed_lt") {
    const h0 = new Date(m.target_at).getTime() - 30 * 60_000, hh = (t: number) => new Intl.DateTimeFormat(INTL_TAG[locale], { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(new Date(t));
    return msg.question.traffic({ site: String(m.params.siteName ?? ""), toward: String(m.params.toward ?? ""), from: hh(h0), to: hh(h0 + 3600_000), kmh: Number(m.params.thresholdKmh) });
  }
  if (m.kind === "match_bet" && /^(pg|pa|ps):/.test(String(m.params.bet))) return msg.question.player({ kind: String(m.params.bet).slice(0, 2) as "pg", name: String((m.params.player as { name?: string } | undefined)?.name ?? ""), home: String(m.params.home), away: String(m.params.away), time: formatWhen(new Date(Number(m.params.kickoff) * 1000).toISOString(), locale, Intl.DateTimeFormat().resolvedOptions().timeZone, now) });
  if (m.kind === "match_bet" && /^(tot|mrg):/.test(String(m.params.bet))) {
    const bet = String(m.params.bet), raw = Number(bet.slice(4)), unit = String(m.params.league) === "NHL" ? msg.sportui.goalsUnit : msg.sportui.ptsUnit;
    return msg.question.two({ kind: bet.startsWith("tot") ? "tot" : "mrg", line: fmtLine(Math.abs(raw), locale), negative: raw < 0, unit, home: String(m.params.home), away: String(m.params.away), time: formatWhen(new Date(Number(m.params.kickoff) * 1000).toISOString(), locale, Intl.DateTimeFormat().resolvedOptions().timeZone, now) });
  }
  if (m.kind === "match_bet") return msg.question.match({ bet: m.params.bet as "home_win", home: String(m.params.home), away: String(m.params.away), time: formatWhen(new Date(Number(m.params.kickoff) * 1000).toISOString(), locale, Intl.DateTimeFormat().resolvedOptions().timeZone, now) });
  if (m.kind === "tick_gt" && /^tv:\d+$/.test(String(m.params.series))) {
    const ep = `S${String(m.params.season ?? 0).padStart(2, "0")}E${String(m.params.number ?? 0).padStart(2, "0")}`;
    return msg.question.episode({ show: String(m.params.label ?? ""), ep, value: Number(m.params.threshold).toFixed(1).replace(".", locale === "it" ? "," : "."), date: new Intl.DateTimeFormat(INTL_TAG[locale], { weekday: "short", day: "numeric", month: "short" }).format(new Date(m.target_at)) });
  }
  if (m.kind === "tick_gt" && String(m.params.series).startsWith("tm:")) {
    const dm = (iso: unknown) => new Intl.DateTimeFormat(INTL_TAG[locale], { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(String(iso)));
    return msg.question.concerts({ place: String(m.params.label ?? "").replace(/^Concerti /, ""), from: dm(m.params.from), to: dm(m.params.to), value: String(Math.round(Number(m.params.threshold))), time: formatWhen(m.target_at, locale, Intl.DateTimeFormat().resolvedOptions().timeZone, now) });
  }
  if (m.kind === "tick_gt") {
    const series = String(m.params.series), at = m.target_at, thr = Number(m.params.threshold);
    const nf = new Intl.NumberFormat(INTL_TAG[locale], { maximumFractionDigits: series === "kp" ? 0 : 0 });
    const own = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (series.startsWith("alert:")) return msg.question.tick({ kind: "alert", label: String(m.params.label), value: msg.alertNames[String(m.params.note) as "yellow"] ?? String(m.params.note), time: "", from: "", to: "", day: new Intl.DateTimeFormat(INTL_TAG[locale], { day: "numeric", month: "long", timeZone: "Europe/Rome" }).format(new Date(Date.parse(at) - 3600_000)) });
    if (series.startsWith("storm:")) return msg.question.tick({ kind: "storm", label: String(m.params.label), value: `${thr} kt${m.params.note ? ` (${m.params.note})` : ""}`, time: formatWhen(at, locale, own, now), from: "", to: "", day: "" });
    if (series.startsWith("steam:")) return msg.question.tick({ kind: "players", label: String(m.params.label), value: nf.format(thr), time: formatWhen(at, locale, own, now), from: "", to: "", day: "" });
    if (series === "kp") return msg.question.tick({ kind: "kp", label: "Kp", value: String(thr), time: "", from: formatWhen(new Date(Date.parse(at) - 3 * 3600_000).toISOString(), locale, own, now), to: formatWhen(at, locale, own, now), day: "" });
    if (series.startsWith("wiki:")) return msg.question.tick({ kind: "wiki", label: String(m.params.label), value: nf.format(thr), time: "", from: "", to: "", day: new Intl.DateTimeFormat(INTL_TAG[locale], { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.parse(at) - 3600_000)) });
    const dg = typeof m.params.digits === "number" ? m.params.digits : 0, nd = new Intl.NumberFormat(INTL_TAG[locale], { minimumFractionDigits: dg, maximumFractionDigits: dg }), lab = msg.cm[String(m.params.label)] ?? String(m.params.label);
    const day = new Intl.DateTimeFormat(INTL_TAG[locale], { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.parse(at) - 3600_000));
    if (series.startsWith("fuel:")) return msg.question.tick({ kind: "fuel", label: lab, value: `${nd.format(thr)} €`, time: "", from: "", to: "", day });
    if (series.startsWith("oil:")) return msg.question.tick({ kind: "oil", label: lab, value: `${nd.format(thr)} $`, time: "", from: "", to: "", day });
    return msg.question.tick({ kind: "price", label: lab, value: `${nd.format(thr)} $`, time: formatWhen(at, locale, own, now), from: "", to: "", day: "" });
  }
  if (m.kind === "strike_on") return msg.question.strike({ date: "", day: new Intl.DateTimeFormat(INTL_TAG[locale], { day: "numeric", month: "long", timeZone }).format(new Date(m.target_at)), who: [m.params.sector, m.params.unions].filter(Boolean).join(" · "), hours: String(m.params.hours ?? "") });
  if (m.kind === "quake_m") {
    // The window is global, so it is shown in the player's own time zone.
    // A regional question is told in that region's local time; a worldwide one in the player's own.
    const regionKey = m.params.region as string | undefined;
    const tz = regionKey ? String(m.params.tz ?? timeZone) : Intl.DateTimeFormat().resolvedOptions().timeZone;
    const circle = m.params.circle as number[] | undefined;
    return msg.question.quake({ mag: Number(m.params.minMag).toFixed(1), from: formatWhen(m.closes_at, locale, tz, now), to: formatWhen(m.target_at, locale, tz, now), region: regionKey === "custom" ? `${String(m.params.place)} (${circle?.[2] ?? ""} km)` : regionKey ? msg.wx.regions[regionKey] ?? regionKey : undefined });
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

/** A line like 226.5 written with the locale's decimal sign. */
export const fmtLine = (n: number, locale: Locale) => String(n).replace(".", locale === "it" ? "," : ".");

/** Whole days from now to an instant (0 on the day itself). */
export const daysUntil = (ms: number, now = Date.now()) => Math.max(0, Math.ceil((ms - now) / 86_400_000));

export const minutesUntil = (iso: string, now = Date.now()) => Math.max(0, Math.floor((Date.parse(iso) - now) / 60000));

/** "05:12" under an hour, "2h 05m" above, "17g 03h" from 48h. */
export function countdown(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  if (h >= 48) return `${Math.floor(h / 24)}g ${p(h % 24)}h`;
  return h > 0 ? `${h}h ${p(m)}m` : `${p(m)}:${p(sec)}`;
}

/** What a winning bet pays out: the stake times the odds, plus the boost's extra when one was used. */
export const potentialWin = (stake: number, odds: number, boosted = false) => { const g = Math.floor(stake * odds); return g + (boosted ? Math.min(1000, g - stake) : 0); };

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



export interface Piece { t: string; b: boolean }

/** Splits a question into plain and bold pieces: the subject (line, city, coin, article), the numbers with their unit and the times. */
export function emphasize(text: string, m: MarketRow, cityName: string): Piece[] {
  const p = m.params;
  const names = [p.routeName, p.routeId, p.siteName, p.label, p.home, p.away, cityName].map((x) => (x == null ? "" : String(x).trim())).filter((x) => x.length >= 2 && x !== "world");
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = [...new Set(names)].sort((a, b) => b.length - a.length).map(esc);
  const nums = String.raw`\d+(?:[.,]\d+)?\s?(?:min|kt|km\/h|°C|cm|mm|%|\$|M)|\b\d{1,2}:\d{2}\b|M\s?\d(?:[.,]\d)?`;
  const re = new RegExp([...parts, nums].join("|"), "gi");
  const out: Piece[] = [];
  let last = 0;
  for (const mt of text.matchAll(re)) {
    const i = mt.index ?? 0;
    if (i > last) out.push({ t: text.slice(last, i), b: false });
    out.push({ t: mt[0], b: true });
    last = i + mt[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), b: false });
  return out;
}

/** A dry one-liner under the question, picked by what the question is about (stable per market). */
export function quip(m: MarketRow, msg: Messages): string {
  const series = String(m.params.series ?? "");
  const g: keyof Messages["quips"] =
    m.kind === "bus_delay_gt" || m.kind === "bus_full" ? "bus" : m.kind === "train_delay_gt" ? "train" : m.kind === "rain_at" ? "rain" : m.kind === "quake_m" ? "quake" : m.kind === "strike_on" ? "strike" : m.kind === "traffic_speed_lt" ? "traffic"
    : m.kind === "tick_gt" ? (series === "kp" ? "kp" : series.startsWith("wiki:") ? "wiki" : series.startsWith("steam:") ? "game" : series.startsWith("storm:") ? "storm" : series.startsWith("alert:") ? "alert" : series.startsWith("metal:") ? "metal" : series.startsWith("fuel:") ? "fuel" : series.startsWith("oil:") ? "oil" : "price") : (String(m.params.metric) as keyof Messages["quips"]);
  const list = msg.quips[g] ?? [];
  if (!list.length) return "";
  const h = [...m.id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return list[h % list.length]!;
}

/** What happened, in words, for a "super odds" question (null when the question is not one). */
export function superText(m: MarketRow, msg: Messages): string | null {
  const sp = m.params.super as { reason?: string; subject?: string; value?: string } | undefined;
  if (!sp?.reason) return null;
  const NAMES: Record<string, string> = { "fuel:benzina": "Benzina", "fuel:gasolio": "Gasolio", "metal:xau": "Gold", "metal:xag": "Silver", "metal:xpt": "Platinum", "metal:hg": "Copper", btc: "Bitcoin", eth: "Ethereum" };
  const lab = msg.cm[NAMES[sp.subject ?? ""] ?? ""] ?? NAMES[sp.subject ?? ""] ?? "", v = Number(sp.value);
  return sp.reason === "fuel_move" ? msg.sup.fuel_move(lab, v) : sp.reason === "price_move" ? msg.sup.price_move(lab, v) : sp.reason === "quake" ? msg.sup.quake(v) : sp.reason === "storm" ? msg.sup.storm(v) : null;
}
