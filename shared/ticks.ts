import { computeOdds } from "./odds.ts";
import { normalCdf } from "./metrics.ts";
import { localDayStart } from "./time.ts";

/** Questions about a single number at a given instant, for the whole world: coin prices, the Kp index, Wikipedia page views. */
export type TickCategory = "finance" | "nature" | "culture";

export interface TickDef {
  category: TickCategory;
  /** Shown in the question ("Bitcoin"). */
  label: string;
  unit: string;
  min: number;
  max: number;
}

export const CRYPTO = { btc: { id: "bitcoin", label: "Bitcoin", step: 500 }, eth: { id: "ethereum", label: "Ethereum", step: 25 } } as const;
export type CryptoSeries = keyof typeof CRYPTO;
export const isCrypto = (s: string): s is CryptoSeries => s === "btc" || s === "eth";

/** Games whose number of players online (Steam Web API, no key) is asked about. */
export const STEAM = { "730": "Counter-Strike 2", "570": "Dota 2", "271590": "Grand Theft Auto V", "578080": "PUBG", "1245620": "Elden Ring" } as const;
export const isSteam = (s: string) => s.startsWith("steam:") && s.slice(6) in STEAM;
/** Numbers that exist only "right now": they must be read within minutes of the instant. */
export const isStorm = (s: string) => s.startsWith("storm:");
export const isAlert = (s: string) => s.startsWith("alert:");

/** Metals priced in US dollars (gold, silver, platinum per troy ounce; copper per pound), spot, from gold-api.com. `vol` = typical move per square-root-hour. */
export const METALS = { xau: { sym: "XAU", label: "Gold", step: 10, vol: 0.0013, digits: 0 }, xag: { sym: "XAG", label: "Silver", step: 0.25, vol: 0.0026, digits: 2 }, xpt: { sym: "XPT", label: "Platinum", step: 10, vol: 0.0021, digits: 0 }, hg: { sym: "HG", label: "Copper", step: 0.05, vol: 0.0016, digits: 2 } } as const;
export type MetalKey = keyof typeof METALS;
export const isMetal = (s: string) => s.startsWith("metal:") && s.slice(6) in METALS;
/** Average self-service price in Italy (euro a litre) from the Ministry's daily list of every station. */
export const FUELS = { benzina: { label: "Benzina", csv: "Benzina" }, gasolio: { label: "Gasolio", csv: "Gasolio" } } as const;
export type FuelKey = keyof typeof FUELS;
export const isFuel = (s: string) => s.startsWith("fuel:") && s.slice(5) in FUELS;
/** Daily spot price of crude oil, from the US Energy Information Administration (needs its free key). */
export const OIL = { brent: { label: "Brent", eia: "RBRTE" }, wti: { label: "WTI", eia: "RWTC" } } as const;
export type OilKey = keyof typeof OIL;
export const isOil = (s: string) => s.startsWith("oil:") && s.slice(4) in OIL;
/** Number of music events Ticketmaster lists in Italy (or in one city) for a fixed window of dates: new tours are announced all the time. */
export const TM_PLACES = { it: { label: "Italia" }, milano: { label: "Milano", city: "Milano" }, roma: { label: "Roma", city: "Roma" }, torino: { label: "Torino", city: "Torino" }, firenze: { label: "Firenze", city: "Firenze" }, napoli: { label: "Napoli", city: "Napoli" }, padova: { label: "Padova", city: "Padova" }, verona: { label: "Verona", city: "Verona" } } as const;
export type TmPlace = keyof typeof TM_PLACES;
export const isTicket = (s: string) => s.startsWith("tm:") && s.slice(3) in TM_PLACES;
/** The dates the count is about: from two days after the instant, for four weeks (the same window is asked again when the instant comes). */
export function tmWindow(at: number): { from: string; to: string } {
  const start = Math.floor(at / 86400) * 86400 + 2 * 86400, iso = (e: number) => new Date(e * 1000).toISOString().replace(/\.\d+Z$/, "Z");
  return { from: iso(start), to: iso(start + 28 * 86400 - 1) };
}
/** The rating TVmaze shows for one episode (series "tv:<episode id>"): asked again three days after it airs. */
export const isTv = (s: string) => /^tv:\d+$/.test(s);
export const isSpot = (s: string) => isCrypto(s) || isSteam(s) || isStorm(s) || isMetal(s) || isTicket(s);

/** Saffir-Simpson scale by sustained wind in knots (1 min average), as NHC reports it. */
export const STORM_STEPS: { kt: number; label: string }[] = [{ kt: 34, label: "TS" }, { kt: 64, label: "Cat. 1" }, { kt: 83, label: "Cat. 2" }, { kt: 96, label: "Cat. 3" }, { kt: 113, label: "Cat. 4" }, { kt: 137, label: "Cat. 5" }];

/** English Wikipedia articles people follow: entertainment and sport, no politics. */
export const WIKI_ARTICLES = ["Taylor_Swift", "Cristiano_Ronaldo", "Lionel_Messi", "Rihanna", "Zendaya", "Netflix", "Formula_One", "Eurovision_Song_Contest", "Grand_Theft_Auto_VI", "Fortnite", "Minecraft"] as const;

export function tickDef(series: string): TickDef | null {
  if (isCrypto(series)) return { category: "finance", label: CRYPTO[series].label, unit: "$", min: 1, max: 10_000_000 };
  if (isMetal(series)) return { category: "finance", label: METALS[series.slice(6) as MetalKey].label, unit: "$", min: 0.1, max: 100_000 };
  if (isFuel(series)) return { category: "finance", label: FUELS[series.slice(5) as FuelKey].label, unit: "€/l", min: 0.5, max: 5 };
  if (isOil(series)) return { category: "finance", label: OIL[series.slice(4) as OilKey].label, unit: "$", min: 5, max: 400 };
  if (isAlert(series)) return { category: "nature", label: "Allerta", unit: "", min: 0, max: 3 };
  if (isStorm(series)) return { category: "nature", label: "Storm", unit: " kt", min: 0, max: 200 };
  if (isSteam(series)) return { category: "culture", label: STEAM[series.slice(6) as keyof typeof STEAM], unit: "", min: 0, max: 100_000_000 };
  if (isTv(series)) return { category: "culture", label: "Voto episodio", unit: "", min: 0.5, max: 10 };
  if (isTicket(series)) return { category: "culture", label: `Concerti ${TM_PLACES[series.slice(3) as TmPlace].label}`, unit: "", min: 0, max: 100_000 };
  if (series === "kp") return { category: "nature", label: "Kp", unit: "", min: 0, max: 9 };
  if (series.startsWith("wiki:")) return { category: "culture", label: series.slice(5).replace(/_/g, " "), unit: "", min: 0, max: 200_000_000 };
  return null;
}

export interface TickMarketInsert {
  city_id: "world"; category: TickCategory; kind: "tick_gt"; feed_id: string;
  lat?: number; lon?: number;
  params: { series: string; label: string; threshold: number; unit: string; forecast: number; at: number; note?: string; digits?: number; local?: "true"; from?: string; to?: string; now?: number; showId?: number; season?: number; number?: number; epId?: number; aired?: number };
  closes_at: string; target_at: string; deadline_at: string; odds_yes: number; odds_no: number; dedupe_key: string;
}

function tickMarket(series: string, def: TickDef, forecast: number, threshold: number, sigma: number, at: number, closesAt: number, deadlineAt: number, note?: string): TickMarketInsert {
  const p = 1 - normalCdf((threshold - forecast) / sigma);
  const odds = computeOdds(Math.min(0.9, Math.max(0.1, p)));
  return {
    city_id: "world", category: def.category, kind: "tick_gt", feed_id: `tick-${series}`,
    params: { series, label: def.label, threshold, unit: def.unit, forecast: Math.round(forecast * 100) / 100, at, ...(note ? { note } : {}) },
    closes_at: new Date(closesAt * 1000).toISOString(), target_at: new Date(at * 1000).toISOString(), deadline_at: new Date(deadlineAt * 1000).toISOString(),
    odds_yes: odds.yes, odds_no: odds.no, dedupe_key: `world|tick_${series}|${at}|${threshold}`,
  };
}

const H = 3600;
/** How long after the instant a coin price may still be read for it. */
export const CRYPTO_GRACE_SEC = 10 * 60;

/** Price questions at 00/06/12/18 UTC for the next 30 hours: one around today's price, and a 2% "up" one at 12 and 18 UTC. */
export function buildCryptoMarkets(prices: Partial<Record<CryptoSeries, number>>, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  for (const [s, price] of Object.entries(prices) as [CryptoSeries, number][]) {
    const def = tickDef(s)!, step = CRYPTO[s].step;
    for (let at = Math.floor(now / (6 * H)) * 6 * H + 6 * H; at <= now + 30 * H; at += 6 * H) {
      if (at - 10 * 60 <= now + 300) continue;
      const hours = Math.max(1, (at - now) / H), sigma = price * 0.005 * Math.sqrt(hours);
      const hourUtc = (at % 86400) / H;
      const mk = (th: number) => tickMarket(s, def, price, th, sigma, at, at - 10 * 60, at + 3 * H);
      out.push(mk(Math.round(price / step) * step));
      if (hourUtc === 12 || hourUtc === 18) out.push(mk(Math.round((price * 1.02) / step) * step));
    }
  }
  return out;
}

/** `kp[atEpoch]` is the planetary Kp of the 3-hour window that ENDS at `at`. Offers G1-storm questions when activity is forecast. */
export function buildKpMarkets(predicted: Map<number, number>, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  const def = tickDef("kp")!;
  for (const [start, kp] of predicted) {
    const at = start + 3 * H;
    if (at - 600 <= now + 300 || at > now + 36 * H || kp < 3) continue;
    for (const th of kp >= 4.33 ? [4, 5] : [4]) out.push(tickMarket("kp", def, kp, th, 1.0, at, at - 3 * H - 600 > now ? at - 3 * H - 600 : at - 600, at + 24 * H));
  }
  return out;
}

/** Page-view questions about the UTC day that ends at `dayEnd`; they close at noon that day. `mean` = typical views per day lately. */
export function buildWikiMarkets(means: Record<string, number>, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  for (const [title, mean] of Object.entries(means)) {
    if (!(mean > 1000)) continue;
    const series = `wiki:${title}`, def = tickDef(series)!;
    const step = mean >= 200_000 ? 10_000 : mean >= 50_000 ? 5_000 : mean >= 10_000 ? 1_000 : 500;
    const thr = Math.round(mean / step) * step;
    for (let dayEnd = Math.floor(now / 86400) * 86400 + 86400; dayEnd <= now + 2 * 86400; dayEnd += 86400) {
      if (dayEnd - 12 * H <= now + 300) continue;
      out.push(tickMarket(series, def, mean, thr, mean * 0.15, dayEnd, dayEnd - 12 * H, dayEnd + 30 * H));
    }
  }
  return out;
}

/** Players online on Steam at 12 and 18 UTC for the next 30 hours; the line is today's count rounded to a friendly step. */
export function buildSteamMarkets(counts: Record<string, number>, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  for (const [id, n] of Object.entries(counts)) {
    if (!(n > 1000)) continue;
    const series = `steam:${id}`, def = tickDef(series)!;
    const step = n >= 500_000 ? 25_000 : n >= 100_000 ? 10_000 : n >= 20_000 ? 1_000 : 500;
    const thr = Math.round(n / step) * step;
    for (let at = Math.floor(now / (6 * H)) * 6 * H + 6 * H; at <= now + 30 * H; at += 6 * H) {
      const hourUtc = (at % 86400) / H;
      if ((hourUtc !== 12 && hourUtc !== 18) || at - 600 <= now + 300) continue;
      const hours = Math.max(1, (at - now) / H);
      out.push(tickMarket(series, def, n, thr, n * 0.07 * Math.sqrt(Math.min(hours, 12) / 4), at, at - 600, at + 3 * H));
    }
  }
  return out;
}

/** Typical error of "what it is now" as a forecast `hours` ahead, used to price player-made questions. */
export function tickSigma(series: string, ref: number, hours: number): number {
  if (isStorm(series)) return Math.max(8, 11 * Math.sqrt(Math.max(1, hours) / 12));
  if (isCrypto(series)) return ref * 0.005 * Math.sqrt(Math.max(1, hours));
  if (isMetal(series)) return ref * METALS[series.slice(6) as MetalKey].vol * Math.sqrt(Math.max(1, hours));
  if (isFuel(series)) return ref * 0.002 * Math.sqrt(Math.max(1, hours / 24));
  if (isOil(series)) return ref * 0.0185 * Math.sqrt(Math.max(1, hours / 24));
  if (isSteam(series)) return ref * 0.07 * Math.sqrt(Math.min(Math.max(1, hours), 12) / 4);
  if (isTv(series)) return 0.45;
  if (isTicket(series)) return Math.max(1.2, ref * 0.02 * Math.sqrt(Math.max(1, hours) / 24));
  return ref * 0.15;
}

/** Friendly threshold granularity for a reference value. */
export function tickStep(series: string, ref: number): number {
  if (isCrypto(series)) return CRYPTO[series].step;
  if (isMetal(series)) return METALS[series.slice(6) as MetalKey].step;
  if (isFuel(series)) return 0.005;
  if (isOil(series)) return 0.5;
  if (isTv(series)) return 0.1;
  if (isTicket(series)) return 1;
  if (isSteam(series)) return ref >= 500_000 ? 25_000 : ref >= 100_000 ? 10_000 : ref >= 20_000 ? 1_000 : 500;
  return ref >= 200_000 ? 10_000 : ref >= 50_000 ? 5_000 : ref >= 10_000 ? 1_000 : 500;
}

/** Player-made questions are refused when the outcome is too certain: the chance of "yes" must stay inside this band. */
export const FAIR_MIN = 0.08, FAIR_MAX = 0.92;
export function tickChance(series: string, ref: number, threshold: number, hours: number): number {
  return 1 - normalCdf((threshold - ref) / tickSigma(series, ref, hours));
}

/** A player-made question about a series, priced with that series' own error. */
export function buildCustomTick(series: string, ref: number, threshold: number, at: number, now: number): TickMarketInsert {
  const def = tickDef(series)!, wiki = series.startsWith("wiki:"), hours = Math.max(0.6, (at - now) / H);
  return tickMarket(series, def, ref, threshold, tickSigma(series, ref, hours), at, wiki ? at - 12 * H : at - 600, at + (wiki ? 30 : 3) * H);
}

const withDigits = (m: TickMarketInsert, digits: number): TickMarketInsert => ({ ...m, params: { ...m.params, digits } });

/** Metals at 12 and 18 UTC on weekdays for the next 30 hours (the market is shut at weekends): the line is today's price on a friendly step. */
export function buildMetalMarkets(prices: Partial<Record<MetalKey, number>>, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  for (const [k, price] of Object.entries(prices) as [MetalKey, number][]) {
    if (!(price > 0)) continue;
    const series = `metal:${k}`, def = tickDef(series)!, cfg = METALS[k];
    for (let at = Math.floor(now / (6 * H)) * 6 * H + 6 * H; at <= now + 30 * H; at += 6 * H) {
      const hourUtc = (at % 86400) / H, dow = new Date(at * 1000).getUTCDay();
      if ((hourUtc !== 12 && hourUtc !== 18) || dow === 0 || dow === 6 || at - 600 <= now + 300) continue;
      const hours = Math.max(1, (at - now) / H);
      out.push(withDigits(tickMarket(series, def, price, Math.round(price / cfg.step) * cfg.step, price * cfg.vol * Math.sqrt(hours), at, at - 600, at + 3 * H), cfg.digits));
    }
  }
  return out;
}

/** `extraction` = the date (YYYY-MM-DD) the latest published list refers to. The list of day D appears early on D+1; each question is about one such day and closes at 18:00 UTC on D. */
export function buildFuelMarkets(avgs: Partial<Record<FuelKey, number>>, extraction: string, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  const base = Date.parse(`${extraction}T00:00:00Z`) / 1000;
  if (!Number.isFinite(base)) return out;
  for (const [k, avg] of Object.entries(avgs) as [FuelKey, number][]) {
    if (!(avg > 0.5)) continue;
    const series = `fuel:${k}`, def = tickDef(series)!;
    for (let ahead = 1; ahead <= 2; ahead++) {
      const at = base + (ahead + 1) * 86400, closes = at - 6 * H;
      if (closes <= now + 600) continue;
      const sigma = avg * 0.002 * Math.sqrt(ahead);
      const t0 = Math.round(avg / 0.005) * 0.005;
      for (const thr of [t0, t0 + 0.01]) {
        const p = 1 - normalCdf((thr - avg) / sigma);
        if (p < 0.12 || p > 0.88) continue;
        out.push(withDigits(tickMarket(series, def, avg, Math.round(thr * 1000) / 1000, sigma, at, closes, at + 36 * H), 3));
      }
    }
  }
  return out;
}

/** `latest[k]` = the newest published daily price and its date (the source lags by days). Questions about the next two weekdays from now; they close at 12:00 UTC of that day, and the wider the gap since the last published price, the wider the spread. */
export function buildOilMarkets(latest: Partial<Record<OilKey, { date: string; value: number }>>, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  for (const [k, l] of Object.entries(latest) as [OilKey, { date: string; value: number }][]) {
    const last = Date.parse(`${l.date}T00:00:00Z`) / 1000;
    if (!(l.value > 5) || !Number.isFinite(last)) continue;
    const series = `oil:${k}`, def = tickDef(series)!;
    let made = 0;
    for (let d = 0; d <= 8 && made < 2; d++) {
      const day = Math.floor(now / 86400) * 86400 + d * 86400, dow = new Date(day * 1000).getUTCDay();
      if (dow === 0 || dow === 6) continue;
      const at = day + 86400, closes = day + 12 * H;
      if (closes <= now + 600) continue;
      made++;
      const gap = Math.max(1, Math.round((day - last) / 86400));
      out.push(withDigits(tickMarket(series, def, l.value, Math.round(l.value / 0.5) * 0.5, l.value * 0.0185 * Math.sqrt(gap), at, closes, at + 10 * 86400), 2));
    }
  }
  return out;
}

export interface StormNow { id: string; name: string; kt: number; cls: string }

/** Active tropical systems (NHC): questions about the sustained wind one and two days ahead, on the nearest Saffir-Simpson steps. */
export function buildStormMarkets(storms: StormNow[], now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  for (const st of storms) {
    if (!(st.kt >= 20)) continue;
    const series = `storm:${st.id}`;
    for (const minHours of [22, 46]) {
      const at = Math.ceil((now + minHours * H) / (6 * H)) * 6 * H, hours = (at - now) / H;
      const options = STORM_STEPS.map((x) => ({ ...x, chance: tickChance(series, st.kt, x.kt, hours) })).filter((x) => x.chance >= 0.15 && x.chance <= 0.85)
        .sort((a, b) => Math.abs(a.chance - 0.5) - Math.abs(b.chance - 0.5)).slice(0, 2);
      for (const o of options) {
        const def: TickDef = { category: "nature", label: st.name, unit: " kt", min: 0, max: 200 };
        out.push(tickMarket(series, def, st.kt, o.kt, tickSigma(series, st.kt, hours), at, at - 600, at + 3 * H, o.label));
      }
    }
  }
  return out;
}

// ---- Regional civil-protection alerts (Allerta Meteo Emilia-Romagna): colour of the alert per zone and hazard ----
export const ALERT_URL = "https://allertameteo.regione.emilia-romagna.it/o/get-stato-allerta";
export const ALERT_TZ = "Europe/Rome";
export const ALERT_AREAS: Record<string, { label: string; zones: string[]; lat: number; lon: number }> = {
  romagna: { label: "Romagna", zones: ["A1", "A2", "B1", "B2"], lat: 44.2227, lon: 12.0407 },
  bologna: { label: "Bologna e Ferrara", zones: ["C1", "C2", "D1", "D2", "D3"], lat: 44.4949, lon: 11.3426 },
  modena: { label: "Modena e Reggio Emilia", zones: ["E1", "E2", "F1", "F2", "F3"], lat: 44.6471, lon: 10.9252 },
  parma: { label: "Parma e Piacenza", zones: ["G1", "G2", "H1", "H2"], lat: 44.8015, lon: 10.3279 },
};
export const ALERT_HAZARDS: Record<string, { label: string; json: string }> = {
  idraulica: { label: "Allerta idraulica (piene dei fiumi)", json: "idraulica" },
  idrogeologica: { label: "Allerta idrogeologica (frane)", json: "idrogeologica" },
  temporali: { label: "Allerta temporali", json: "temporali" },
};
const LEVEL: Record<string, number> = { green: 0, yellow: 1, orange: 2, red: 3 };

/** The highest alert level in an area for a hazard (0 green … 3 red), from a `get-stato-allerta` answer. */
export function alertLevel(doc: unknown, area: string, hazard: string): number | null {
  const a = ALERT_AREAS[area], h = ALERT_HAZARDS[hazard];
  if (!a || !h || !doc || typeof doc !== "object") return null;
  let best: number | null = null;
  for (const z of a.zones) {
    const v = ((doc as Record<string, Record<string, string | null> | undefined>)[z])?.[h.json];
    if (v === undefined || v === null) continue;
    if (!(v in LEVEL)) return null;
    best = Math.max(best ?? 0, LEVEL[v]!);
  }
  return best;
}

/** "YYYY-MM-DD HH:mm" in Italy for the API's `data` parameter. */
export function alertQueryDate(epoch: number): string {
  const d = new Date(epoch * 1000), p = new Intl.DateTimeFormat("en-CA", { timeZone: ALERT_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}`;
}

const ALERT_BASE: Record<string, [number, number]> = { idraulica: [0.1, 0.04], idrogeologica: [0.09, 0.03], temporali: [0.22, 0.07] };
export const LEVEL_NAMES = ["green", "yellow", "orange", "red"] as const;

/** Day-after-tomorrow and the next: "will the alert for that day be at least yellow / orange?" Closes before the bulletin for that day is issued. */
export function buildAlertMarkets(now: number, current: Record<string, number>): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  for (const [area, a] of Object.entries(ALERT_AREAS)) {
    const hazards = area === "romagna" ? ["idraulica", "idrogeologica", "temporali"] : ["idraulica", "temporali"];
    for (const hz of hazards) {
      const series = `alert:${area}:${hz}`, active = (current[series] ?? 0) >= 1;
      for (const dayOff of [2, 3]) {
        const day = localDayStart(now + dayOff * 86400, ALERT_TZ), at = day + 12 * H, closes = day - 16 * H;
        if (closes <= now + 300) continue;
        for (const thr of hz === "temporali" ? [1] : [1, 2]) {
          const base = ALERT_BASE[hz]![thr - 1]!, p = Math.min(0.6, active ? base * 2.5 : base);
          const def: TickDef = { category: "nature", label: `${ALERT_HAZARDS[hz]!.label} · ${a.label}`, unit: "", min: 0, max: 3 };
          const m = tickMarket(series, def, p * 3, thr, 1, at, closes, at + 36 * H, LEVEL_NAMES[thr]);
          const odds = computeOdds(Math.min(0.9, Math.max(0.1, p)));
          out.push({ ...m, odds_yes: odds.yes, odds_no: odds.no, lat: a.lat, lon: a.lon, params: { ...m.params, forecast: current[series] ?? 0, local: "true" } });
        }
      }
    }
  }
  return out;
}

/**
 * "Will Ticketmaster list at least N music events in <place> for the four weeks starting two days after the instant?" One question per place,
 * at 06:00 UTC the next day; N is a little above today's count (new tours are announced all the time, a few are cancelled).
 */
export function buildTicketMarkets(counts: Partial<Record<TmPlace, number>>, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  const at = Math.floor(now / 86400) * 86400 + 86400 + 6 * H;
  const hours = (at - now) / H, win = tmWindow(at);
  for (const [id, n] of Object.entries(counts) as [TmPlace, number][]) {
    if (!(n >= 3)) continue;
    const series = `tm:${id}`, def = tickDef(series)!;
    const drift = n * 0.012 * (hours / 24), thr = Math.max(n + 1, Math.round(n + Math.max(1, n * 0.03)));
    const m = tickMarket(series, def, n + drift, thr, tickSigma(series, n, hours), at, at - 10 * 60, at + 3 * H);
    out.push({ ...m, params: { ...m.params, from: win.from, to: win.to, now: n } });
  }
  return out;
}

export interface TvArgs { showId: number; showName: string; episodeId: number; season: number; number: number; airstamp: number; reference: number; threshold: number; now: number }
/** The TVmaze rating three days after an episode airs: "at least <threshold>?" priced around the show's recent episodes. */
export function buildTvMarket(a: TvArgs): TickMarketInsert {
  const series = `tv:${a.episodeId}`, def = tickDef(series)!;
  const at = a.airstamp + 72 * H;
  const closes = Math.min(at - 6 * H, Math.max(a.now + 15 * 60, a.airstamp));
  const m = tickMarket(series, def, a.reference, a.threshold, tickSigma(series, a.reference, 72), at, Math.max(closes, a.now + 10 * 60), at + 6 * H);
  return { ...m, params: { ...m.params, label: a.showName, showId: a.showId, season: a.season, number: a.number, epId: a.episodeId, aired: a.airstamp, digits: 1 } };
}
