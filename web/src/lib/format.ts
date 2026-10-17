import { INTL_TAG, type Locale, type Messages } from "../i18n/index.ts";
import { ALWAYS, currencySymbol, fmtDec, fmtInt, fmtNum, fmtOdds, money, MINUS, numLocale } from "./num.ts";
import { alertLabel, teamName } from "./names.ts";
import { dtf } from "./intl.ts";

// every figure on screen is written by lib/num.ts; these stay importable from here
export { currencySymbol, fmtOdds, money };

export interface MarketRow {
  id: string;
  city_id: string;
  category: "bus" | "train" | "weather" | "traffic" | "nature" | "strike" | "finance" | "culture" | "sport" | "law";
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
  const day = (x: Date) => dtf("en-CA", { timeZone }).format(x);
  const time = dtf(tag, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(d);
  if (day(d) === day(now)) return time;
  // the questions read "alle <time>": in Italian the day goes after the hour ("alle 16:00 di martedì"), not before it
  if (locale === "it") return `${time} di ${dtf(tag, { weekday: "long", timeZone }).format(d)}`;
  return `${dtf(tag, { weekday: "short", timeZone }).format(d)} ${time}`;
}

const TRAIN_NAMES: Record<string, [string, string, string]> = { it: ["Alta velocità", "Intercity", "REGIONALE"], "en-US": ["High-speed", "Intercity", "Regional"], "en-GB": ["High-speed", "Intercity", "Regional"] };
/** "REG 4340" → "REGIONALE 4340", "FR 9516" → "Alta velocità 9516": the kind of train in words in front of its number. */
export function trainLabel(route: string, kind: string, locale: string): string {
  const names = TRAIN_NAMES[locale];
  if (kind !== "train_delay_gt" || !names) return route;
  const m = route.trim().match(/^([A-Za-z]{1,4})\s*(\d{1,5}[A-Za-z]?)$/);
  if (!m) return route;
  const code = m[1]!.toUpperCase();
  const label = /^(FR|FA|FB|ES|ITA|NTV|EC|EN)$/.test(code) ? names[0] : /^(IC|ICN)$/.test(code) ? names[1] : /^(REG|RV|R|RE)$/.test(code) ? names[2] : null;
  return label ? `${label} ${m[2]}` : route;
}

export function question(m: MarketRow, msg: Messages, locale: Locale, cityName: string, timeZone: string, now = new Date()): string {
  const time = formatWhen(m.target_at, locale, timeZone, now);
  // a question we wrote ourselves carries its own text in every language
  const own = (m.params as { q?: Record<string, string> }).q;
  if (own) return (locale === "it" ? own.it : locale === "ja" ? own.ja : own.en) ?? own.en ?? own.it ?? "";
  if (m.kind === "bus_full") return msg.question.full({ occ: m.params.occ as "empty", route: String(m.params.routeName ?? ""), stop: String(m.params.stopName ?? ""), time });
  // the answer counts the whole hour: the question names the hour, not the middle of it
  const h0 = new Date(Math.floor(new Date(m.target_at).getTime() / 3600_000) * 3600_000).toISOString(), h1 = new Date(Date.parse(h0) + 3600_000).toISOString();
  const hourFrom = formatWhen(h0, locale, timeZone, now), hourTo = dtf(INTL_TAG[locale], { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(new Date(h1));
  if (m.kind === "rain_at") return msg.question.rain({ city: cityName, time: hourFrom, to: hourTo });
  if (m.kind === "metric_gt") return msg.question.metric({ metric: m.params.metric as "temp", city: cityName, time: hourFrom, to: hourTo, value: Number(m.params.threshold), unit: String(m.params.unit ?? "") });
  if (m.kind === "traffic_speed_lt") {
    const h0 = new Date(m.target_at).getTime() - 30 * 60_000, hh = (t: number) => dtf(INTL_TAG[locale], { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).format(new Date(t));
    return msg.question.traffic({ site: String(m.params.siteName ?? ""), toward: String(m.params.toward ?? ""), from: hh(h0), to: hh(h0 + 3600_000), kmh: Number(m.params.thresholdKmh) });
  }
  if (m.kind === "match_bet" && /^(pg|pa|ps):/.test(String(m.params.bet))) return msg.question.player({ kind: String(m.params.bet).slice(0, 2) as "pg", name: String((m.params.player as { name?: string } | undefined)?.name ?? ""), home: teamName(String(m.params.home), locale), away: teamName(String(m.params.away), locale), time: formatWhen(new Date(Number(m.params.kickoff) * 1000).toISOString(), locale, Intl.DateTimeFormat().resolvedOptions().timeZone, now) });
  if (m.kind === "match_bet" && /^(tot|mrg):/.test(String(m.params.bet))) {
    const bet = String(m.params.bet), raw = Number(bet.slice(4)), unit = String(m.params.league) === "NHL" ? msg.sportui.goalsUnit : msg.sportui.ptsUnit;
    return msg.question.two({ kind: bet.startsWith("tot") ? "tot" : "mrg", line: fmtLine(Math.abs(raw), locale), negative: raw < 0, unit, home: teamName(String(m.params.home), locale), away: teamName(String(m.params.away), locale), time: formatWhen(new Date(Number(m.params.kickoff) * 1000).toISOString(), locale, Intl.DateTimeFormat().resolvedOptions().timeZone, now) });
  }
  if (m.kind === "match_bet") return msg.question.match({ bet: m.params.bet as "home_win", home: teamName(String(m.params.home), locale), away: teamName(String(m.params.away), locale), time: formatWhen(new Date(Number(m.params.kickoff) * 1000).toISOString(), locale, Intl.DateTimeFormat().resolvedOptions().timeZone, now) });
  if (m.kind === "tick_gt" && /^tv:\d+$/.test(String(m.params.series))) {
    const ep = `S${String(m.params.season ?? 0).padStart(2, "0")}E${String(m.params.number ?? 0).padStart(2, "0")}`;
    return msg.question.episode({ show: String(m.params.label ?? ""), ep, value: fmtDec(Number(m.params.threshold), 1, locale), date: dtf(INTL_TAG[locale], { weekday: "short", day: "numeric", month: "short" }).format(new Date(m.target_at)) });
  }
  if (m.kind === "tick_gt" && String(m.params.series).startsWith("tm:")) {
    const dm = (iso: unknown) => dtf(INTL_TAG[locale], { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(String(iso)));
    return msg.question.concerts({ place: String(m.params.label ?? "").replace(/^Concerti /, ""), from: dm(m.params.from), to: dm(m.params.to), value: fmtDec(Math.round(Number(m.params.threshold)), 0, locale), time: formatWhen(m.target_at, locale, Intl.DateTimeFormat().resolvedOptions().timeZone, now) });
  }
  if (m.kind === "tick_gt") {
    const series = String(m.params.series), at = m.target_at, thr = Number(m.params.threshold);
    const nf = new Intl.NumberFormat(INTL_TAG[locale], { maximumFractionDigits: 0, useGrouping: ALWAYS });
    const own = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (series.startsWith("alert:")) return msg.question.tick({ kind: "alert", label: alertLabel(series, msg, String(m.params.label)), value: msg.alertNames[String(m.params.note) as "yellow"] ?? String(m.params.note), time: "", from: "", to: "", day: dtf(INTL_TAG[locale], { day: "numeric", month: "long", timeZone: "Europe/Rome" }).format(new Date(Date.parse(at) - 3600_000)) });
    if (series.startsWith("storm:")) return msg.question.tick({ kind: "storm", label: String(m.params.label), value: `${thr} kt${m.params.note ? ` (${m.params.note})` : ""}`, time: formatWhen(at, locale, own, now), from: "", to: "", day: "" });
    if (series.startsWith("lastfm:")) return msg.question.tick({ kind: "listeners", label: String(m.params.label), value: nf.format(thr), time: formatWhen(at, locale, own, now), from: "", to: "", day: "" });
    if (series.startsWith("hf:")) { const nm = String(m.params.label), lb = locale === "it" ? `Mi piace su Hugging Face di ${nm}` : locale === "ja" ? `Hugging Faceの「${nm}」のいいね数` : `Hugging Face likes of ${nm}`; return msg.question.tick({ kind: "price", label: lb, value: nf.format(thr), time: formatWhen(at, locale, own, now), from: "", to: "", day: "" }); }
    if (series === "sw") return msg.question.tick({ kind: "price", label: locale === "it" ? "Vento solare" : locale === "ja" ? "太陽風の速さ" : "Solar wind speed", value: `${nf.format(thr)} km/s`, time: formatWhen(at, locale, own, now), from: "", to: "", day: "" });
    if (series.startsWith("bikes:")) return msg.question.tick({ kind: "bikes", label: String(m.params.label), value: nf.format(thr), time: formatWhen(at, locale, own, now), from: "", to: "", day: "" });
    if (series === "hn:max") return msg.question.tick({ kind: "hn", label: "", value: nf.format(thr), time: formatWhen(at, locale, own, now), from: "", to: "", day: "" });
    if (series.startsWith("chess:")) return msg.question.tick({ kind: "chess", label: String(m.params.label), value: nf.format(thr), time: formatWhen(at, locale, own, now), from: "", to: "", day: "" });
    if (series.startsWith("launch:")) return msg.question.tick({ kind: "launch", label: String(m.params.label), value: "", time: formatWhen(at, locale, own, now), from: "", to: "", day: "" });
    if (series.startsWith("f1:")) return msg.question.tick({ kind: series.endsWith(":w") ? "f1win" : "f1podium", label: String(m.params.label), value: "", time: dtf(INTL_TAG[locale], { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.parse(at) - 3 * 3600_000)), from: "", to: "", day: String(m.params.note ?? "") });
    if (series.startsWith("steam:")) return msg.question.tick({ kind: "players", label: String(m.params.label), value: nf.format(thr), time: formatWhen(at, locale, own, now), from: "", to: "", day: "" });
    if (series === "kp") return msg.question.tick({ kind: "kp", label: "Kp", value: String(thr), time: "", from: formatWhen(new Date(Date.parse(at) - 3 * 3600_000).toISOString(), locale, own, now), to: formatWhen(at, locale, own, now), day: "" });
    if (series.startsWith("wiki:")) return msg.question.tick({ kind: "wiki", label: String(m.params.label), value: nf.format(thr), time: "", from: "", to: "", day: dtf(INTL_TAG[locale], { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.parse(at) - 3600_000)) });
    const dg = typeof m.params.digits === "number" ? m.params.digits : 0, nd = new Intl.NumberFormat(INTL_TAG[locale], { minimumFractionDigits: dg, maximumFractionDigits: dg, useGrouping: ALWAYS }), lab = msg.cm[String(m.params.label)] ?? String(m.params.label);
    const day = dtf(INTL_TAG[locale], { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.parse(at) - 3600_000));
    // Italian puts the currency after the number ("4.200 $"); English and Japanese put it in front ("$4,200")
    const cur = (sym: string) => (locale === "it" ? `${nd.format(thr)} ${sym}` : `${sym}${nd.format(thr)}`);
    if (series.startsWith("fuel:")) return msg.question.tick({ kind: "fuel", label: lab, value: cur("€"), time: "", from: "", to: "", day });
    if (series.startsWith("fx:")) return msg.question.tick({ kind: "fx", label: lab, value: nd.format(thr), time: "", from: "", to: "", day });
    if (series === "feargreed") return msg.question.tick({ kind: "feargreed", label: lab, value: nd.format(thr), time: "", from: "", to: "", day });
    if (series === "carbon:gb") return msg.question.tick({ kind: "carbon", label: lab, value: `${nd.format(thr)} g/kWh`, time: formatWhen(at, locale, own, now), from: "", to: "", day: "" });
    if (series === "power:it") return msg.question.tick({ kind: "power", label: lab, value: `${nd.format(thr)} €/MWh`, time: formatWhen(at, locale, own, now), from: "", to: "", day: "" });
    if (series.startsWith("tide:")) return msg.question.tick({ kind: "tide", label: lab, value: `${nd.format(thr)} m`, time: formatWhen(at, locale, own, now), from: "", to: "", day: "" });
    if (series.startsWith("river:")) return msg.question.tick({ kind: "river", label: lab, value: `${nd.format(thr)} cm`, time: formatWhen(at, locale, own, now), from: "", to: "", day: "" });
    if (series === "nws:us") return msg.question.tick({ kind: "nws", label: lab, value: nd.format(thr), time: formatWhen(at, locale, own, now), from: "", to: "", day: "" });
    if (series.startsWith("oil:")) return msg.question.tick({ kind: "oil", label: lab, value: cur("$"), time: "", from: "", to: "", day });
    return msg.question.tick({ kind: "price", label: lab, value: cur("$"), time: formatWhen(at, locale, own, now), from: "", to: "", day: "" });
  }
  if (m.kind === "strike_on") return msg.question.strike({ date: "", day: dtf(INTL_TAG[locale], { day: "numeric", month: "long", timeZone }).format(new Date(m.target_at)), who: [m.params.sector, m.params.unions].filter(Boolean).join(" · "), hours: String(m.params.hours ?? "") });
  if (m.kind === "quake_m") {
    // The window is global, so it is shown in the player's own time zone.
    // A regional question is told in that region's local time; a worldwide one in the player's own.
    const regionKey = m.params.region as string | undefined;
    const tz = regionKey ? String(m.params.tz ?? timeZone) : Intl.DateTimeFormat().resolvedOptions().timeZone;
    const circle = m.params.circle as number[] | undefined;
    return msg.question.quake({ mag: fmtDec(Number(m.params.minMag), 1, locale), from: formatWhen(m.closes_at, locale, tz, now), to: formatWhen(m.target_at, locale, tz, now), region: regionKey === "custom" ? `${String(m.params.place)} (${circle?.[2] ?? ""} km)` : regionKey ? msg.wx.regions[regionKey] ?? regionKey : undefined });
  }
  const p = m.params;
  const q = {
    route: trainLabel(String(p.routeName ?? p.routeId ?? ""), m.kind, locale),
    headsign: String(p.headsign ?? ""),
    stop: String(p.stopName ?? p.stopId ?? ""),
    time,
    min: Math.round(Number(p.thresholdSec ?? 180) / 60),
  };
  return m.kind === "train_delay_gt" ? msg.question.train(q) : msg.question.bus(q);
}

/** A text cut to about `max` characters at the end of a whole word, with an ellipsis only when something was left out. */
export function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max + 1), at = cut.lastIndexOf(" ");
  return `${(at > max * 0.5 ? cut.slice(0, at) : t.slice(0, max)).replace(/[\s,;:.\-–—]+$/, "")}\u2026`;
}

/** A line like 226.5 written with the locale's decimal sign. */
export const fmtLine = (n: number, locale: Locale) => fmtNum(n, locale);

/** Whole days from now to an instant (0 on the day itself). */
export const daysUntil = (ms: number, now = Date.now()) => Math.max(0, Math.ceil((ms - now) / 86_400_000));

export const minutesUntil = (iso: string, now = Date.now()) => Math.max(0, Math.floor((Date.parse(iso) - now) / 60000));

/** "05:12" under an hour, "2h 05m" above, "17g 03h" from 48h. */
/** The day unit of countdowns ("2g 05h" in Italian, "2d 05h" in English); the app sets it with the language. */
let dayUnit = "g";
export const setDayUnit = (u: string) => { dayUnit = u; };
export function countdown(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  if (h >= 48) return `${Math.floor(h / 24)}${dayUnit} ${p(h % 24)}h`;
  return h > 0 ? `${h}h ${p(m)}m` : m > 0 ? `${m}m ${p(sec)}s` : `${sec}s`;
}

/** What a winning bet pays out: the stake times the odds, plus the boost's extra when one was used. */
export const potentialWin = (stake: number, odds: number, boosted = false, vicePct = 0) => { const g = Math.floor(stake * odds); return g + (boosted ? Math.min(1000, g - stake) : 0) + Math.floor((g * vicePct) / 100); };

/** Credits returned by a winning 10-credit bet. */
export const per10 = (odds: number) => Math.floor(10 * odds);

/** Local calendar day "YYYY-MM-DD" in a timezone. */
export const dayIn = (tz: string, d = new Date()) => dtf("en-CA", { timeZone: tz }).format(d);

/** Days left in the current calendar month (UTC), at least 1. */
export function seasonDaysLeft(now = new Date()): number {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return Math.max(1, Math.ceil((end - now.getTime()) / 86400000));
}

/** The season is the UTC month: how many days it has, how many are left (at least 1) and how much of it has gone, from 0 to 1. */
export function seasonSpan(now = new Date()): { total: number; left: number; elapsed: number } {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1), end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  return { total: Math.round((end - start) / 86400000), left: seasonDaysLeft(now), elapsed: Math.min(1, Math.max(0, (now.getTime() - start) / (end - start))) };
}

/** A reading of a tick series written with its unit, the way the questions write their lines (prices with the currency, physical readings with their unit, counts plain). */
export function tickValueText(series: string, v: number, digits: number, locale: Locale = numLocale()): string {
  const nd = (x: number) => fmtDec(x, digits, locale), cur = (sym: string) => (locale === "it" ? `${nd(v)} ${sym}` : `${sym}${nd(v)}`);
  if (series === "kp") return fmtDec(v, 1, locale);
  if (series.startsWith("storm:")) return `${fmtInt(v, locale)} kt`;
  if (/^(lastfm|bikes|steam|wiki|tv|tm|alert|chess|launch|f1):/.test(series) || series === "hn:max") return fmtInt(v, locale);
  if (series.startsWith("fuel:")) return cur("€");
  if (series.startsWith("fx:") || series === "feargreed" || series === "nws:us") return nd(v);
  if (series === "carbon:gb") return `${nd(v)} g/kWh`;
  if (series === "power:it") return `${nd(v)} €/MWh`;
  if (series.startsWith("tide:")) return `${nd(v)} m`;
  if (series.startsWith("river:")) return `${nd(v)} cm`;
  return cur("$");
}

/** "+€40" / "−€10" / "€10" for the outcome screen, card and list. */
export function resultAmount(st: "won" | "lost" | "void", stake: number, payout: number, locale: Locale): string {
  return st === "won" ? `+${money(payout - stake, locale)}` : st === "lost" ? `${MINUS}${money(stake, locale)}` : money(stake, locale);
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
  const nums = String.raw`[$€]\d+(?:[.,]\d+)*|\d+(?:[.,]\d+)?\s?(?:min|kt|km\/h|°C|cm|mm|%|\$|€\/MWh|€|g\/kWh|M)|\b\d{1,2}:\d{2}\b|M\s?\d(?:[.,]\d)?`;
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
    : m.kind === "tick_gt" ? (series === "kp" ? "kp" : series.startsWith("wiki:") ? "wiki" : series.startsWith("steam:") ? "game" : series.startsWith("lastfm:") || series.startsWith("hf:") || series.startsWith("bikes:") ? "wiki" : series === "sw" ? "kp" : series.startsWith("storm:") ? "storm" : series.startsWith("alert:") ? "alert" : series.startsWith("metal:") ? "metal" : series.startsWith("fuel:") ? "fuel" : series.startsWith("oil:") ? "oil" : "price") : (String(m.params.metric) as keyof Messages["quips"]);
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
