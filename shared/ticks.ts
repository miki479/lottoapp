import { computeOdds } from "./odds.ts";
import { normalCdf } from "./metrics.ts";
import { addDays, localDateString, zonedEpoch } from "./time.ts";

/** Questions about a single number at a given instant, for the whole world: coin prices, the Kp index, Wikipedia page views. */
export type TickCategory = "finance" | "nature" | "culture" | "traffic" | "space" | "sport" | "games";

export interface TickDef {
  category: TickCategory;
  /** Shown in the question ("Bitcoin"). */
  label: string;
  unit: string;
  min: number;
  max: number;
}

export const CRYPTO = { btc: { id: "bitcoin", label: "Bitcoin", step: 500 }, eth: { id: "ethereum", label: "Ethereum", step: 25 }, sol: { id: "solana", label: "Solana", step: 2 }, bnb: { id: "binancecoin", label: "BNB", step: 10 }, xrp: { id: "ripple", label: "XRP", step: 0.05 } } as const;
export type CryptoSeries = keyof typeof CRYPTO;
export const isCrypto = (s: string): s is CryptoSeries => Object.prototype.hasOwnProperty.call(CRYPTO, s);

/** Games whose number of players online (Steam Web API, no key) is asked about. */
export const STEAM = { "730": "Counter-Strike 2", "570": "Dota 2", "271590": "Grand Theft Auto V", "578080": "PUBG", "1245620": "Elden Ring", "1172470": "Apex Legends", "252490": "Rust", "1086940": "Baldur's Gate 3", "553850": "Helldivers 2", "1091500": "Cyberpunk 2077", "440": "Team Fortress 2", "359550": "Rainbow Six Siege", "230410": "Warframe", "1623730": "Palworld", "1938090": "Call of Duty", "381210": "Dead by Daylight", "105600": "Terraria", /* not a Steam game: the viewers of live Dota 2 matches (OpenDota), asked as "viewers" */ "dota_live": "Dota 2 (live matches)" } as const;
export const isSteam = (s: string) => s.startsWith("steam:") && s.slice(6) in STEAM;
/** Artists whose total number of Last.fm listeners is asked about. The total only grows, so the line sits where the recent pace of growth puts it. */
export const LASTFM = { taylorswift: "Taylor Swift", billieeilish: "Billie Eilish", drake: "Drake", theweeknd: "The Weeknd", dualipa: "Dua Lipa", badbunny: "Bad Bunny", maneskin: "Måneskin", sferaebbasta: "Sfera Ebbasta" } as const;
export type LastfmKey = keyof typeof LASTFM;
export const isLastfm = (s: string) => s.startsWith("lastfm:") && s.slice(7) in LASTFM;
/** Bikes available in a whole public bike-share system (GBFS, open standard): a number that swings with the commute, asked at fixed hours. */
export const BIKES = {
  nyc: { label: "Citi Bike NYC", url: "https://gbfs.citibikenyc.com/gbfs/en/station_status.json", max: 200_000 },
  paris: { label: "Vélib' Paris", url: "https://velib-metropole-opendata.smovengo.cloud/opendata/Velib_Metropole/station_status.json", max: 200_000 },
  tokyo: { label: "docomo Bike Share Tokyo", url: "https://api-public.odpt.org/api/v4/gbfs/docomo-cycle-tokyo/station_status.json", max: 200_000 },
  // `max` = the most bikes the system could plausibly have available (fleet size with a wide margin): a reading above it is a broken feed, not a number.
  capital: { label: "Capital Bikeshare DC", url: "https://gbfs.capitalbikeshare.com/gbfs/en/station_status.json", max: 25_000 },
  divvy: { label: "Divvy Chicago", url: "https://gbfs.divvybikes.com/gbfs/en/station_status.json", max: 25_000 },
  baywheels: { label: "Bay Wheels San Francisco", url: "https://gbfs.baywheels.com/gbfs/en/station_status.json", max: 20_000 },
  bluebikes: { label: "Bluebikes Boston", url: "https://gbfs.bluebikes.com/gbfs/en/station_status.json", max: 20_000 },
  toronto: { label: "Bike Share Toronto", url: "https://toronto.publicbikesystem.net/customer/ube/gbfs/v1/en/station_status", max: 25_000 },
  oslo: { label: "Oslo Bysykkel", url: "https://gbfs.urbansharing.com/oslobysykkel.no/station_status.json", max: 8_000 },
} as const;
export type BikeKey = keyof typeof BIKES;
export const isBikes = (s: string) => s.startsWith("bikes:") && s.slice(6) in BIKES;
/** A reading is believable when there are some bikes and not more than the system's `max`. */
export const bikesPlausible = (key: string, n: number): boolean => key in BIKES && Number.isFinite(n) && n > 0 && n <= BIKES[key as BikeKey].max;
/** AI models on Hugging Face whose number of likes is asked about (public API). The total only grows, so the line sits where the recent pace of growth puts it. */
export const HF = {
  "deepseek-r1": { repo: "deepseek-ai/DeepSeek-R1", label: "DeepSeek-R1" }, "llama-3-1-8b": { repo: "meta-llama/Llama-3.1-8B-Instruct", label: "Llama 3.1 8B" },
  "flux-dev": { repo: "black-forest-labs/FLUX.1-dev", label: "FLUX.1 dev" }, "sdxl": { repo: "stabilityai/stable-diffusion-xl-base-1.0", label: "Stable Diffusion XL" },
  "whisper-v3": { repo: "openai/whisper-large-v3", label: "Whisper large v3" }, "mistral-7b": { repo: "mistralai/Mistral-7B-Instruct-v0.3", label: "Mistral 7B" },
} as const;
export type HfKey = keyof typeof HF;
export const isHf = (s: string) => s.startsWith("hf:") && s.slice(3) in HF;
/** Speed of the solar wind (NOAA SWPC real-time, km/s): the push behind the aurora. A spot reading, asked a few hours ahead. */
export const isSolarWind = (s: string) => s === "sw";
/** Numbers that exist only "right now": they must be read within minutes of the instant. */
export const isStorm = (s: string) => s.startsWith("storm:");
export const isAlert = (s: string) => s.startsWith("alert:");

/** Metals priced in US dollars (gold, silver, platinum per troy ounce; copper per pound), spot, from gold-api.com. `vol` = typical move per square-root-hour. */
export const METALS = { xau: { sym: "XAU", label: "Gold", step: 10, vol: 0.0013, digits: 0 }, xag: { sym: "XAG", label: "Silver", step: 0.25, vol: 0.0026, digits: 2 }, xpt: { sym: "XPT", label: "Platinum", step: 10, vol: 0.0021, digits: 0 }, hg: { sym: "HG", label: "Copper", step: 0.05, vol: 0.0016, digits: 2 } } as const;
export type MetalKey = keyof typeof METALS;
export const isMetal = (s: string) => s.startsWith("metal:") && s.slice(6) in METALS;
/** ECB euro reference rates (Frankfurter), one fixing per working day around 16:00 CET: euros in the quoted currency. `vol` = typical move per square-root-day. */
export const FX = { usd: { label: "EUR/USD", step: 0.005, vol: 0.0045, digits: 3, min: 0.2, max: 3 }, gbp: { label: "EUR/GBP", step: 0.005, vol: 0.004, digits: 3, min: 0.2, max: 3 }, jpy: { label: "EUR/JPY", step: 0.5, vol: 0.006, digits: 2, min: 50, max: 400 }, chf: { label: "EUR/CHF", step: 0.005, vol: 0.003, digits: 3, min: 0.5, max: 2 }, cad: { label: "EUR/CAD", step: 0.01, vol: 0.0045, digits: 3, min: 0.5, max: 3 }, cny: { label: "EUR/CNY", step: 0.05, vol: 0.0045, digits: 2, min: 3, max: 15 } } as const;
export type FxKey = keyof typeof FX;
export const isFx = (s: string) => s.startsWith("fx:") && s.slice(3) in FX;
/** UK grid carbon intensity (National Grid ESO / Carbon Intensity API, CC BY 4.0), gCO2 per kWh, half-hourly. */
export const isCarbon = (s: string) => s === "carbon:gb";
/** Weather alerts in force on US land zones (National Weather Service, public domain): the "land" figure of api.weather.gov/alerts/active/count. */
export const isNws = (s: string) => s === "nws:us";
/** Crypto Fear & Greed Index (alternative.me), 0 to 100, one value a day at 00:00 UTC. */
export const isFearGreed = (s: string) => s === "feargreed";
/** Day-ahead electricity price of the Italian north zone (Energy-Charts, data from Bundesnetzagentur | SMARD.de, CC BY 4.0), euro per MWh, 15-minute slots; the next day's prices are published around noon UTC the day before. */
export const isPower = (s: string) => s === "power:it";
/** NOAA CO-OPS tide gauges (public domain): water level in metres above MLLW, read every 6 minutes. */
export const TIDES = { nyc: { label: "The Battery, New York", station: "8518750" }, bos: { label: "Boston", station: "8443970" }, sea: { label: "Seattle", station: "9447130" } } as const;
export type TideKey = keyof typeof TIDES;
export const isTide = (s: string) => s.startsWith("tide:") && s.slice(5) in TIDES;
/** German federal river gauges (WSV Pegelonline, DL-DE-Zero-2.0): water level in cm on the gauge, every 15 minutes. */
export const RIVERS = { koeln: { label: "Rhine at Köln", station: "KÖLN" }, kaub: { label: "Rhine at Kaub", station: "KAUB" }, dresden: { label: "Elbe at Dresden", station: "DRESDEN" } } as const;
export type RiverKey = keyof typeof RIVERS;
export const isRiver = (s: string) => s.startsWith("river:") && s.slice(6) in RIVERS;
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
/** A question we write ourselves ("house:gta6"): settled by an admin once the day has passed, refunded if nobody does. */
export const isHouse = (s: string) => /^house:[a-z0-9_-]{2,30}$/.test(s);
/** Hacker News front page: the most points any story on it has right now (Algolia HN search, public). */
export const isHn = (s: string) => s === "hn:max";
/** Chess.com players whose blitz rating is asked about (PubAPI, public). */
export const CHESS = { hikaru: "Hikaru Nakamura", magnuscarlsen: "Magnus Carlsen", nihalsarin: "Nihal Sarin", firouzja2003: "Alireza Firouzja", fabianocaruana: "Fabiano Caruana", gothamchess: "GothamChess" } as const;
export type ChessKey = keyof typeof CHESS;
export const isChess = (s: string) => s.startsWith("chess:") && s.slice(6) in CHESS;
/** A rocket launch (Launch Library 2): "launch:<id>" reads 1 when it lifted off within three hours of the planned time, else 0. */
export const isLaunch = (s: string) => /^launch:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
/** A Formula 1 result (Jolpica, the Ergast successor): "f1:<season>-<round>:<CODE>:w" reads 1 when the driver won, ":p" when on the podium. */
export const isF1 = (s: string) => /^f1:\d{4}-\d{1,2}:[A-Z]{2,3}:[wp]$/.test(s);
/** NASA Near Earth Object Web Service: "neo:<YYYYMMDD>" is a week starting that day (UTC); it reads 1 when an asteroid passes within NEO_LD lunar distances in it. */
export const NEO_LD = 10;
export const isNeo = (s: string) => /^neo:\d{8}$/.test(s);
/** NASA EONET, the register of natural events: how many are open in a category right now. */
export const EONET = { volcanoes: { id: "volcanoes", label: "Volcanoes" }, storms: { id: "severeStorms", label: "Severe storms" }, ice: { id: "seaLakeIce", label: "Sea and lake ice" } } as const;
export type EonetKey = keyof typeof EONET;
export const isEonet = (s: string) => s.startsWith("eonet:") && s.slice(6) in EONET;
/** Yes/no facts read once the event is over, not numbers read at an instant. */
export const isFact = (s: string) => isLaunch(s) || isF1(s) || isNeo(s);
export const isSpot = (s: string) => isEonet(s) || isHn(s) || isChess(s) || isCrypto(s) || isSteam(s) || isLastfm(s) || isHf(s) || isSolarWind(s) || isBikes(s) || isStorm(s) || isMetal(s) || isCarbon(s) || isNws(s) || isTide(s) || isRiver(s) || isTicket(s);

/** Saffir-Simpson scale by sustained wind in knots (1 min average), as NHC reports it. */
export const STORM_STEPS: { kt: number; label: string }[] = [{ kt: 34, label: "TS" }, { kt: 64, label: "Cat. 1" }, { kt: 83, label: "Cat. 2" }, { kt: 96, label: "Cat. 3" }, { kt: 113, label: "Cat. 4" }, { kt: 137, label: "Cat. 5" }];

/** English Wikipedia articles people follow: entertainment and sport, no politics. */
export const WIKI_ARTICLES = ["Taylor_Swift", "Cristiano_Ronaldo", "Lionel_Messi", "Rihanna", "Zendaya", "Netflix", "Formula_One", "Eurovision_Song_Contest", "Grand_Theft_Auto_VI", "Fortnite", "Minecraft", "ChatGPT", "OpenAI", "Artificial_intelligence", "SpaceX", "Elon_Musk", "NASA", "Nvidia", "Bitcoin"] as const;

export function tickDef(series: string): TickDef | null {
  if (isCrypto(series)) return { category: "finance", label: CRYPTO[series].label, unit: "$", min: 1, max: 10_000_000 };
  if (isMetal(series)) return { category: "finance", label: METALS[series.slice(6) as MetalKey].label, unit: "$", min: 0.1, max: 100_000 };
  if (isFx(series)) { const c = FX[series.slice(3) as FxKey]; return { category: "finance", label: c.label, unit: "", min: c.min, max: c.max }; }
  if (isCarbon(series)) return { category: "nature", label: "UK grid carbon", unit: " g/kWh", min: 0, max: 800 };
  if (isNws(series)) return { category: "nature", label: "US weather alerts", unit: "", min: 0, max: 20_000 };
  if (isFearGreed(series)) return { category: "finance", label: "Fear & Greed", unit: "", min: 0, max: 100 };
  if (isPower(series)) return { category: "finance", label: "Italy power price", unit: " €/MWh", min: -500, max: 4000 };
  if (isTide(series)) return { category: "nature", label: TIDES[series.slice(5) as TideKey].label, unit: " m", min: -5, max: 15 };
  if (isRiver(series)) return { category: "nature", label: RIVERS[series.slice(6) as RiverKey].label, unit: " cm", min: -100, max: 2000 };
  if (isFuel(series)) return { category: "finance", label: FUELS[series.slice(5) as FuelKey].label, unit: "€/l", min: 0.5, max: 5 };
  if (isOil(series)) return { category: "finance", label: OIL[series.slice(4) as OilKey].label, unit: "$", min: 5, max: 400 };
  if (isAlert(series)) return { category: "nature", label: "Allerta", unit: "", min: 0, max: 3 };
  if (isStorm(series)) return { category: "nature", label: "Storm", unit: " kt", min: 0, max: 200 };
  if (isSteam(series)) return { category: "games", label: STEAM[series.slice(6) as keyof typeof STEAM], unit: "", min: 0, max: 100_000_000 };
  if (isBikes(series)) return { category: "traffic", label: BIKES[series.slice(6) as BikeKey].label, unit: "", min: 0, max: BIKES[series.slice(6) as BikeKey].max };
  if (isHf(series)) return { category: "culture", label: HF[series.slice(3) as HfKey].label, unit: "", min: 50, max: 10_000_000 };
  if (isSolarWind(series)) return { category: "nature", label: "Solar wind", unit: " km/s", min: 150, max: 2500 };
  if (isLastfm(series)) return { category: "culture", label: LASTFM[series.slice(7) as LastfmKey], unit: "", min: 1000, max: 2_000_000_000 };
  if (isHn(series)) return { category: "culture", label: "Hacker News", unit: " pt", min: 1, max: 50_000 };
  if (isChess(series)) return { category: "games", label: CHESS[series.slice(6) as ChessKey], unit: "", min: 400, max: 4500 };
  if (isEonet(series)) return { category: "space", label: EONET[series.slice(6) as EonetKey].label, unit: "", min: 0, max: 5000 };
  if (isNeo(series)) return { category: "space", label: "Asteroid", unit: "", min: 0, max: 1 };
  if (isLaunch(series)) return { category: "space", label: "Launch", unit: "", min: 0, max: 1 };
  if (isF1(series)) return { category: "sport", label: "F1", unit: "", min: 0, max: 1 };
  if (isHouse(series)) return { category: "culture", label: "Esclusiva", unit: "", min: 0, max: 1 };
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

/**
 * How a threshold is read. A question worded "at least" (a storm's wind, an alert level, Kp, concert count, an episode rating) is yes when the number is
 * `>=` the line; all the others ("above", "more than", "will exceed") are yes only when it is strictly `>`: a reading exactly on the line is a No.
 */
export const tickInclusive = (series: string): boolean => isStorm(series) || isAlert(series) || series === "kp" || isTicket(series) || isTv(series);

/** Float noise in a computed line (1.1650000000000003) must not decide a reading that is exactly on it. */
const fix = (x: number) => Math.round(x * 1e6) / 1e6;

/** Whether a measured value settles the question on Yes. */
export function tickYes(series: string, value: number, threshold: number): boolean {
  const v = fix(value), t = fix(threshold);
  return tickInclusive(series) ? v >= t : v > t;
}

/** Smallest step between two possible readings of a series: 0 when it is a fine-grained (effectively continuous) number. */
export function tickGrain(series: string): number {
  if (series === "kp") return 1 / 3;
  if (isStorm(series)) return 5;
  if (isHn(series) || isChess(series) || isLaunch(series) || isF1(series) || isNeo(series) || isEonet(series)) return 1;
  if (isAlert(series) || isNws(series) || isRiver(series) || isCarbon(series) || isFearGreed(series) || isTicket(series) || isBikes(series) || isSteam(series) || isLastfm(series) || isHf(series) || series.startsWith("wiki:")) return 1;
  if (isTv(series)) return 0.1;
  if (isFuel(series) || isTide(series)) return 0.001;
  if (isPower(series) || isOil(series)) return 0.01;
  if (isFx(series)) return series === "fx:jpy" ? 0.01 : 0.0001;
  return 0;
}

/**
 * The chance that a reading, normal around `forecast` with spread `sigma`, settles the question on Yes. A number that can only take whole
 * values (or steps of a third, or five knots) is shifted by half a step so that the line itself is counted on the right side.
 */
export function tickAbove(series: string, forecast: number, threshold: number, sigma: number): number {
  const g = tickGrain(series);
  let cut = threshold;
  if (g > 0) {
    const k = tickInclusive(series) ? Math.ceil(threshold / g - 1e-9) : Math.floor(threshold / g + 1e-9) + 1;
    cut = (k - 0.5) * g;
  }
  return 1 - normalCdf((cut - forecast) / sigma);
}

function tickMarket(series: string, def: TickDef, forecast: number, threshold: number, sigma: number, at: number, closesAt: number, deadlineAt: number, note?: string): TickMarketInsert {
  const p = tickAbove(series, forecast, threshold, sigma);
  const odds = computeOdds(Math.min(0.9, Math.max(0.1, p)));
  return {
    city_id: "world", category: def.category, kind: "tick_gt", feed_id: `tick-${series}`,
    params: { series, label: def.label, threshold: fix(threshold), unit: def.unit, forecast: Math.round(forecast * 100) / 100, at, ...(note ? { note } : {}) },
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

/** Players online on Steam at 12 and 18 UTC for the next 30 hours; the line is the count expected at that hour (today's count carried along the daily shape) on a friendly step. */
export function buildSteamMarkets(counts: Record<string, number>, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  for (const [id, n] of Object.entries(counts)) {
    if (!(n > 1000)) continue;
    const series = `steam:${id}`, def = tickDef(series)!;
    const step = n >= 500_000 ? 25_000 : n >= 100_000 ? 10_000 : n >= 20_000 ? 1_000 : 500;
    for (let at = Math.floor(now / (6 * H)) * 6 * H + 6 * H; at <= now + 30 * H; at += 6 * H) {
      const hourUtc = (at % 86400) / H;
      if ((hourUtc !== 12 && hourUtc !== 18) || at - 600 <= now + 300) continue;
      const hours = Math.max(1, (at - now) / H), forecast = n * diurnalRatio(series, now, at), line = Math.round(forecast / step) * step;
      if (!(line > 0)) continue;
      out.push(tickMarket(series, def, forecast, line, tickSigma(series, forecast, hours), at, at - 600, at + 3 * H));
    }
  }
  return out;
}

/** Listeners on Last.fm at 12 UTC tomorrow and the day after. `stats[key]` = the total now and its pace in listeners per hour (from our own history); no pace yet, no question. */
export function buildLastfmMarkets(stats: Record<string, { listeners: number; perHour: number }>, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  for (const [key, { listeners: n, perHour }] of Object.entries(stats)) {
    if (!(n > 10_000) || !(perHour > 0) || !(key in LASTFM)) continue;
    const series = `lastfm:${key}`, def = tickDef(series)!;
    for (let at = Math.floor(now / 86400) * 86400 + 12 * H; at <= now + 50 * H; at += 86400) {
      if (at - 600 <= now + 4 * H) continue;
      const hours = (at - now) / H, expected = n + perHour * hours, step = Math.max(100, 10 ** Math.floor(Math.log10(Math.max(1, perHour * hours / 2))));
      const thr = Math.round(expected / step) * step;
      out.push(tickMarket(series, def, expected, thr, Math.max(step, perHour * hours * 0.3), at, at - 600, at + 3 * H));
    }
  }
  return out;
}

/** Bikes available at 06 and 12 and 18 UTC for the next 30 hours; the line is today's number rounded to a friendly step. */
export function buildBikesMarkets(counts: Record<string, number>, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  for (const [key, n] of Object.entries(counts)) {
    if (!(n > 500) || !bikesPlausible(key, n)) continue;
    const series = `bikes:${key}`, def = tickDef(series)!, step = n >= 20_000 ? 1000 : n >= 5000 ? 500 : 250, thr = Math.round(n / step) * step;
    for (let at = Math.floor(now / (6 * H)) * 6 * H + 6 * H; at <= now + 30 * H; at += 6 * H) {
      const hourUtc = (at % 86400) / H;
      if (![6, 12, 18].includes(hourUtc) || at - 600 <= now + 300) continue;
      const hours = Math.max(1, (at - now) / H);
      out.push(tickMarket(series, def, n, thr, n * 0.1 * Math.sqrt(Math.min(hours, 12) / 4), at, at - 600, at + 3 * H));
    }
  }
  return out;
}

/**
 * Players online on Steam follow the sun: the trough (about 23-04 UTC) is roughly 0.4 times the peak (about 13 UTC), far more than the few percent a
 * question 6-24 hours ahead was priced to allow. Mean-normalised hour-of-day shape of five games (Counter-Strike 2, Dota 2, PUBG, GTA V, Elden Ring)
 * over a day of our own readings, shrunk a fifth towards flat because it is a single day. UTC hour -> factor.
 */
const STEAM_SHAPE = [0.67, 0.66, 0.67, 0.67, 0.68, 0.70, 0.73, 0.82, 0.90, 0.91, 1.0, 1.19, 1.46, 1.72, 1.65, 1.57, 1.41, 1.32, 1.28, 1.23, 1.06, 0.88, 0.77, 0.68]
  .map((x) => 1 + 0.8 * (x - 1));
function shapeAt(series: string, epoch: number): number {
  if (!isSteam(series)) return 1;
  const h = (((epoch % 86400) + 86400) % 86400) / 3600, i = Math.floor(h), f = h - i;
  return STEAM_SHAPE[i]! * (1 - f) + STEAM_SHAPE[(i + 1) % 24]! * f;
}
/** What a reading taken at `fromEpoch` is worth at `toEpoch` for a series with a daily rhythm (1 for the others). */
export function diurnalRatio(series: string, fromEpoch: number, toEpoch: number): number {
  return shapeAt(series, toEpoch) / shapeAt(series, fromEpoch);
}

/** Likes on Hugging Face at 12 UTC tomorrow and the day after. `stats[key]` = the total now and its pace in likes per hour (from our own history); no pace yet, no question. */
export function buildHfMarkets(stats: Record<string, { likes: number; perHour: number }>, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  for (const [key, { likes: n, perHour }] of Object.entries(stats)) {
    if (!(n > 500) || !(perHour > 0) || !(key in HF)) continue;
    const series = `hf:${key}`, def = tickDef(series)!;
    for (let at = Math.floor(now / 86400) * 86400 + 12 * H; at <= now + 50 * H; at += 86400) {
      if (at - 600 <= now + 4 * H) continue;
      const hours = (at - now) / H, expected = n + perHour * hours, step = Math.max(5, 10 ** Math.floor(Math.log10(Math.max(1, perHour * hours / 2))));
      const thr = Math.round(expected / step) * step;
      out.push(tickMarket(series, def, expected, thr, Math.max(step, perHour * hours * 0.3), at, at - 600, at + 3 * H));
    }
  }
  return out;
}

/** Solar wind speed read now (km/s): questions about the speed 6, 12 and 24 hours ahead, on the whole hour, with a line near today's value and one higher. */
export function buildSolarWindMarkets(speed: number, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  if (!(speed > 150 && speed < 2500)) return out;
  const def = tickDef("sw")!;
  for (const ahead of [6, 12, 24]) {
    const at = Math.ceil((now + ahead * H) / H) * H, hours = (at - now) / H, sigma = tickSigma("sw", speed, hours);
    for (const thr of [Math.round(speed / 25) * 25, Math.round((speed + 60) / 25) * 25]) out.push(tickMarket("sw", def, speed, thr, sigma, at, at - 600, at + 3 * H));
  }
  return out;
}

/** Typical error of "what it is now" as a forecast `hours` ahead, used to price player-made questions. */
export function tickSigma(series: string, ref: number, hours: number): number {
  if (isStorm(series)) return Math.max(8, 11 * Math.sqrt(Math.max(1, hours) / 12));
  if (isCrypto(series)) return ref * 0.005 * Math.sqrt(Math.max(1, hours));
  if (isMetal(series)) return ref * METALS[series.slice(6) as MetalKey].vol * Math.sqrt(Math.max(1, hours));
  if (isFx(series)) return ref * FX[series.slice(3) as FxKey].vol * Math.sqrt(Math.max(1, hours / 24));
  if (isEonet(series)) return Math.max(1.5, ref * 0.12 * Math.sqrt(Math.max(1, hours) / 24 + 0.5));
  if (isHn(series)) return Math.max(60, ref * 0.25 * Math.sqrt(Math.min(Math.max(1, hours), 12) / 4));
  if (isChess(series)) return 18 * Math.sqrt(Math.max(1, hours) / 12 + 1);
  if (isCarbon(series)) return Math.max(12, ref * 0.2 * Math.sqrt(Math.min(Math.max(1, hours), 12) / 4));
  if (isNws(series)) return Math.max(8, ref * 0.25 * Math.sqrt(Math.min(Math.max(1, hours), 12) / 4));
  if (isFearGreed(series)) return 5 * Math.sqrt(Math.max(1, hours / 24));
  if (isPower(series)) return Math.max(15, Math.abs(ref) * 0.15) * Math.sqrt(Math.max(1, hours / 24));
  if (isTide(series)) return 0.1 * Math.sqrt(Math.min(Math.max(1, hours), 24) / 6 + 1);
  if (isRiver(series)) return Math.max(3, Math.abs(ref) * 0.03 * Math.sqrt(Math.min(Math.max(1, hours), 48) / 12));
  if (isFuel(series)) return ref * 0.002 * Math.sqrt(Math.max(1, hours / 24));
  if (isOil(series)) return ref * 0.0185 * Math.sqrt(Math.max(1, hours / 24));
  if (isSteam(series)) return ref * Math.sqrt(0.07 ** 2 * Math.min(Math.max(1, hours), 12) / 4 + 0.08 ** 2); // the second term: the daily shape is itself an estimate
  if (isBikes(series)) return ref * 0.1 * Math.sqrt(Math.min(Math.max(1, hours), 12) / 4);
  if (isLastfm(series)) return ref * 0.0004 * Math.sqrt(Math.max(1, hours) / 24);
  if (isHf(series)) return Math.max(3, ref * 0.002 * Math.sqrt(Math.max(1, hours) / 24));
  if (isSolarWind(series)) return Math.max(40, 85 * Math.sqrt(Math.max(1, hours) / 12));
  if (isTv(series)) return 0.45;
  if (isTicket(series)) return Math.max(1.2, ref * 0.02 * Math.sqrt(Math.max(1, hours) / 24));
  return ref * 0.15;
}

/** Friendly threshold granularity for a reference value. */
export function tickStep(series: string, ref: number): number {
  if (isCrypto(series)) return CRYPTO[series].step;
  if (isMetal(series)) return METALS[series.slice(6) as MetalKey].step;
  if (isFx(series)) return FX[series.slice(3) as FxKey].step;
  if (isEonet(series)) return ref >= 30 ? 5 : ref >= 10 ? 2 : 1;
  if (isHn(series)) return ref >= 800 ? 100 : 50;
  if (isChess(series)) return 10;
  if (isCarbon(series)) return 5;
  if (isNws(series)) return ref >= 1000 ? 100 : ref >= 200 ? 25 : ref >= 50 ? 10 : 5;
  if (isFearGreed(series)) return 5;
  if (isPower(series)) return 5;
  if (isTide(series)) return 0.1;
  if (isRiver(series)) return 5;
  if (isFuel(series)) return 0.005;
  if (isOil(series)) return 0.5;
  if (isTv(series)) return 0.1;
  if (isLastfm(series)) return Math.max(100, 10 ** Math.floor(Math.log10(ref * 0.0004)));
  if (isHf(series)) return Math.max(5, 10 ** Math.floor(Math.log10(Math.max(1, ref * 0.002))));
  if (isSolarWind(series)) return 25;
  if (isTicket(series)) return 1;
  if (isSteam(series)) return ref >= 500_000 ? 25_000 : ref >= 100_000 ? 10_000 : ref >= 20_000 ? 1_000 : 500;
  return ref >= 200_000 ? 10_000 : ref >= 50_000 ? 5_000 : ref >= 10_000 ? 1_000 : 500;
}

/** Player-made questions are refused when the outcome is too certain: the chance of "yes" must stay inside this band. */
export const FAIR_MIN = 0.08, FAIR_MAX = 0.92;
export function tickChance(series: string, ref: number, threshold: number, hours: number, now = Date.now() / 1000): number {
  const forecast = ref * diurnalRatio(series, now, now + hours * H);
  return tickAbove(series, forecast, threshold, tickSigma(series, forecast, hours));
}

/** A player-made question about a series, priced with that series' own error. */
export function buildCustomTick(series: string, ref: number, threshold: number, at: number, now: number): TickMarketInsert {
  const def = tickDef(series)!, wiki = series.startsWith("wiki:"), hours = Math.max(0.6, (at - now) / H), forecast = ref * diurnalRatio(series, now, at);
  return tickMarket(series, def, forecast, threshold, tickSigma(series, forecast, hours), at, wiki ? at - 12 * H : at - 600, at + (wiki ? 30 : 3) * H);
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
        const p = tickAbove(series, avg, thr, sigma);
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

/** `latest[k]` = the newest ECB fixing and its date. Questions about the next two weekdays' fixings (published ~15:00 UTC, so they close at 12:00 UTC of that day); a fixing older than a week is not trusted. */
export function buildFxMarkets(latest: Partial<Record<FxKey, { date: string; value: number }>>, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  for (const [k, l] of Object.entries(latest) as [FxKey, { date: string; value: number }][]) {
    const last = Date.parse(`${l.date}T00:00:00Z`) / 1000, cfg = FX[k];
    if (!cfg || !(l.value > 0) || !Number.isFinite(last) || now - last > 7 * 86400) continue;
    const series = `fx:${k}`, def = tickDef(series)!;
    let made = 0;
    for (let d = 0; d <= 8 && made < 2; d++) {
      const day = Math.floor(now / 86400) * 86400 + d * 86400, dow = new Date(day * 1000).getUTCDay();
      if (dow === 0 || dow === 6) continue;
      const at = day + 86400, closes = day + 12 * H;
      if (closes <= now + 600) continue;
      made++;
      const gap = Math.max(1, Math.round((day - last) / 86400));
      out.push(withDigits(tickMarket(series, def, l.value, Math.round(l.value / cfg.step) * cfg.step, l.value * cfg.vol * Math.sqrt(gap), at, closes, at + 10 * 86400), cfg.digits));
    }
  }
  return out;
}

/** UK grid carbon intensity now (gCO2/kWh): a question every 6 hours (00, 06, 12, 18 UTC) for the next 30 hours, on a 5 g step. */
export function buildCarbonMarkets(intensity: number | null | undefined, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  if (!(typeof intensity === "number" && intensity > 0)) return out;
  const series = "carbon:gb", def = tickDef(series)!;
  for (let at = Math.floor(now / (6 * H)) * 6 * H + 6 * H; at <= now + 30 * H; at += 6 * H) {
    if (at - 600 <= now + 300) continue;
    const hours = Math.max(1, (at - now) / H);
    out.push(withDigits(tickMarket(series, def, intensity, Math.round(intensity / 5) * 5, tickSigma(series, intensity, hours), at, at - 600, at + 3 * H), 0));
  }
  return out;
}

/** Hacker News: the best score on the front page now, a question every 6 hours (00, 06, 12, 18 UTC) for the next 30 hours. */
export function buildHnMarkets(top: number | null | undefined, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  if (!(typeof top === "number" && top >= 20 && top <= 50_000)) return out;
  const series = "hn:max", def = tickDef(series)!, step = tickStep(series, top);
  for (let at = Math.floor(now / (6 * H)) * 6 * H + 6 * H; at <= now + 30 * H; at += 6 * H) {
    if (at - 600 <= now + 300) continue;
    const hours = Math.max(1, (at - now) / H);
    out.push(withDigits(tickMarket(series, def, top, Math.max(step, Math.round(top / step) * step), tickSigma(series, top, hours), at, at - 600, at + 3 * H), 0));
  }
  return out;
}

/** Chess.com blitz ratings: a question per player at 08 and 20 UTC for the next 36 hours, on a 10-point step. */
export function buildChessMarkets(ratings: Partial<Record<ChessKey, number>>, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  for (const k of Object.keys(CHESS) as ChessKey[]) {
    const r = ratings[k];
    if (!(typeof r === "number" && r >= 800 && r <= 4000)) continue;
    const series = `chess:${k}`, def = tickDef(series)!;
    for (let at = Math.floor(now / (12 * H)) * 12 * H + 8 * H; at <= now + 36 * H; at += 12 * H) {
      if (at - 600 <= now + 300) continue;
      const hours = Math.max(1, (at - now) / H);
      out.push(withDigits(tickMarket(series, def, r, Math.round(r / 10) * 10, tickSigma(series, r, hours), at, at - 600, at + 3 * H), 0));
    }
  }
  return out;
}

/** A yes/no fact: the odds come straight from the chance, the line is 0.5 (a reading of 1 is Yes). */
function factMarket(series: string, label: string, note: string, p: number, at: number, closesAt: number, deadlineAt: number): TickMarketInsert {
  const def = { ...tickDef(series)!, label }, odds = computeOdds(Math.min(0.9, Math.max(0.1, p)));
  return { ...tickMarket(series, def, p, 0.5, 0.5, at, closesAt, deadlineAt, note), odds_yes: odds.yes, odds_no: odds.no };
}

/**
 * Rocket launches that are "Go" within the next five days: will it lift off within three hours of its planned time? A launch that is on "Go" and soon
 * goes about two times in three; one further away slips more often. Closed 15 minutes before the planned time, read once the three hours are over.
 */
export function buildLaunchMarkets(launches: { id: string; name: string; net: number; go: boolean }[], now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  for (const l of launches) {
    if (!l.go || !(l.net - 15 * 60 > now + 3600 && l.net < now + 5 * 86400) || !/^[0-9a-f-]{36}$/.test(l.id)) continue;
    const p = l.net - now < 24 * 3600 ? 0.68 : 0.58, at = l.net + 3 * H;
    out.push(factMarket(`launch:${l.id}`, l.name.slice(0, 80), String(l.net), p, at, l.net - 15 * 60, at + 12 * H));
  }
  return out;
}

/**
 * The next Grand Prix: for the five drivers leading the championship, "will he win?" and "will he be on the podium?". The chances follow the share of
 * points (squared, so the leader counts more); the race clock comes from the calendar and the result is read three hours after the start.
 */
export function buildF1Markets(race: { season: number; round: number; name: string; start: number } | null, standings: { code: string; name: string; points: number }[], now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  if (!race || !(race.start - 300 > now + 3600 && race.start < now + 6 * 86400) || standings.length < 3) return out;
  const total = standings.reduce((s, d) => s + d.points ** 2, 0) || 1, at = race.start + 3 * H;
  for (const d of standings.slice(0, 5)) {
    if (!/^[A-Z]{2,3}$/.test(d.code) || !(d.points > 0)) continue;
    const share = d.points ** 2 / total, win = Math.min(0.6, Math.max(0.05, share)), pod = Math.min(0.9, Math.max(0.12, share * 2.8 + 0.1));
    for (const [what, p] of [["w", win], ["p", pod]] as const) out.push(factMarket(`f1:${race.season}-${race.round}:${d.code}:${what}`, d.name, race.name, p, at, race.start - 300, at + 24 * H));
  }
  return out;
}

/** NASA EONET open events per category: a question per category at 00 and 12 UTC for the next 36 hours. */
export function buildEonetMarkets(counts: Partial<Record<EonetKey, number>>, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  for (const k of Object.keys(EONET) as EonetKey[]) {
    const c = counts[k];
    if (!(typeof c === "number" && c >= 3 && c <= 5000)) continue;
    const series = `eonet:${k}`, def = tickDef(series)!, step = tickStep(series, c);
    for (let at = Math.floor(now / (12 * H)) * 12 * H + 12 * H; at <= now + 36 * H; at += 12 * H) {
      if (at - 600 <= now + 300) continue;
      const hours = Math.max(1, (at - now) / H);
      out.push(withDigits(tickMarket(series, def, c, Math.max(step, Math.round(c / step) * step), tickSigma(series, c, hours), at, at - 600, at + 3 * H), 0));
    }
  }
  return out;
}

/**
 * Asteroids: for the next two weeks (Monday to Sunday, UTC), "will one pass within ten lunar distances?". The chance is the share of the last weeks in which one
 * did (NASA's list as it stands now, with the late discoveries in it), smoothed so it never gets extreme. Read a day after the week ends.
 */
export function buildNeoMarkets(past: { weeks: number; hits: number } | null, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  if (!past || past.weeks < 4) return out;
  const p = Math.min(0.85, Math.max(0.15, (past.hits + 1) / (past.weeks + 2)));
  const day = Math.floor(now / 86400), dow = (day + 3) % 7; // 0 = Monday (1 Jan 1970 was a Thursday)
  for (let k = 0; k < 2; k++) {
    const start = (day - dow + 7 * (k + 1)) * 86400;
    if (!(start - 900 > now + 3600)) continue;
    const ymd = new Date(start * 1000).toISOString().slice(0, 10), at = start + 8 * 86400;
    const m = factMarket(`neo:${ymd.replace(/-/g, "")}`, "Asteroid", String(NEO_LD), p, at, start - 900, at + 24 * H);
    out.push({ ...m, params: { ...m.params, from: ymd, to: new Date((start + 6 * 86400) * 1000).toISOString().slice(0, 10) } });
  }
  return out;
}

/** US land weather alerts in force now: a question every 6 hours (00, 06, 12, 18 UTC) for the next 30 hours, on a friendly step. */
export function buildNwsMarkets(count: number | null | undefined, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  const def = tickDef("nws:us")!;
  if (!(typeof count === "number" && count > 0 && count <= def.max)) return out;
  const step = tickStep("nws:us", count), thr = Math.max(step, Math.round(count / step) * step);
  for (let at = Math.floor(now / (6 * H)) * 6 * H + 6 * H; at <= now + 30 * H; at += 6 * H) {
    if (at - 600 <= now + 300) continue;
    const hours = Math.max(1, (at - now) / H);
    out.push(withDigits(tickMarket("nws:us", def, count, thr, tickSigma("nws:us", count, hours), at, at - 600, at + 3 * H), 0));
  }
  return out;
}

/** `prices` = day-ahead prices by unix second of the 15-minute slot. Questions about the price at 12:00 and 18:00 UTC of the one and two days after the newest day that has both, priced from that day's own values; they close at 09:00 UTC the day before (the next day's prices come out around noon). */
export function buildPowerMarkets(prices: Record<number, number> | null | undefined, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  if (!prices) return out;
  const series = "power:it", def = tickDef(series)!, today = Math.floor(now / 86400) * 86400;
  let refDay = -1;
  for (let d = today + 86400; d >= today - 86400; d -= 86400) if ([12, 18].every((h) => Number.isFinite(prices[d + h * H]))) { refDay = d; break; }
  if (refDay < 0) return out;
  for (let k = 1; k <= 2; k++) {
    const day = refDay + k * 86400, closes = day - 86400 + 9 * H;
    if (closes <= now + 600) continue;
    for (const h of [12, 18]) {
      const ref = prices[refDay + h * H]!;
      if (!(ref >= def.min && ref <= def.max)) continue;
      out.push(withDigits(tickMarket(series, def, ref, Math.round(ref / 5) * 5, tickSigma(series, ref, k * 24), day + h * H, closes, day + h * H + 10 * 86400), 0));
    }
  }
  return out;
}

/** Tide gauges: `pred` = hourly predictions by unix second (metres), `obs` = the latest reading. A question every 3 hours for the next 24: the prediction at that hour plus half of the surge seen now (reading minus prediction). */
export function buildTideMarkets(g: Partial<Record<TideKey, { pred: Record<number, number>; obs: { at: number; v: number } | null }>>, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  for (const [k, x] of Object.entries(g) as [TideKey, { pred: Record<number, number>; obs: { at: number; v: number } | null }][]) {
    if (!TIDES[k] || !x) continue;
    const series = `tide:${k}`, def = tickDef(series)!, h0 = Math.floor((x.obs?.at ?? now) / H) * H, p0 = x.pred[h0], p1 = x.pred[h0 + H];
    const atObs = x.obs && Number.isFinite(p0) && Number.isFinite(p1) ? p0! + (p1! - p0!) * ((x.obs.at - h0) / H) : null;
    const surge = x.obs && atObs !== null && Math.abs(x.obs.v - atObs) < 1.5 && now - x.obs.at < 3 * H ? x.obs.v - atObs : 0;
    for (let at = Math.floor(now / (3 * H)) * 3 * H + 3 * H; at <= now + 24 * H; at += 3 * H) {
      const pr = x.pred[at];
      if (!Number.isFinite(pr) || at - 600 <= now + 300) continue;
      const fc = pr! + surge * 0.5, hours = Math.max(1, (at - now) / H);
      if (!(fc >= def.min && fc <= def.max)) continue;
      out.push(withDigits(tickMarket(series, def, fc, Math.round(fc * 10) / 10, tickSigma(series, fc, hours), at, at - 600, at + 3 * H), 1));
    }
  }
  return out;
}

/** River gauges (cm): a question at 00 and 12 UTC for the next 36 hours, on a 5 cm step around the level now. */
export function buildRiverMarkets(levels: Partial<Record<RiverKey, number>>, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  for (const [k, v] of Object.entries(levels) as [RiverKey, number][]) {
    if (!RIVERS[k]) continue;
    const series = `river:${k}`, def = tickDef(series)!;
    if (!(typeof v === "number" && v >= def.min && v <= def.max)) continue;
    for (let at = Math.floor(now / (12 * H)) * 12 * H + 12 * H; at <= now + 36 * H; at += 12 * H) {
      if (at - 600 <= now + 300) continue;
      out.push(withDigits(tickMarket(series, def, v, Math.round(v / 5) * 5, tickSigma(series, v, Math.max(1, (at - now) / H)), at, at - 600, at + 3 * H), 0));
    }
  }
  return out;
}

/** `latest` = the newest index value and its timestamp (00:00 UTC of its day). Questions about the values of the next two days, which appear at 00:00 UTC; they close an hour before. A value older than two days is not trusted. */
export function buildFearGreedMarkets(latest: { ts: number; value: number } | null | undefined, now: number): TickMarketInsert[] {
  const out: TickMarketInsert[] = [];
  if (!latest || !(latest.value >= 0 && latest.value <= 100) || !Number.isFinite(latest.ts) || now - latest.ts > 2 * 86400 + 3 * H) return out;
  const series = "feargreed", def = tickDef(series)!;
  for (let ahead = 1; ahead <= 3 && out.length < 2; ahead++) {
    const day = Math.floor(now / 86400) * 86400 + ahead * 86400, closes = day - H;
    if (closes <= now + 600) continue;
    const gap = Math.max(1, Math.round((day - latest.ts) / 86400));
    const thr = Math.min(95, Math.max(5, Math.round(latest.value / 5) * 5));
    out.push(withDigits(tickMarket(series, def, latest.value, thr, 5 * Math.sqrt(gap), day + H, closes, day + 10 * 86400), 0));
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
        const dayStr = addDays(localDateString(now, ALERT_TZ), dayOff), day = zonedEpoch(dayStr, 0, ALERT_TZ), at = zonedEpoch(dayStr, 12 * H, ALERT_TZ), closes = day - 16 * H;
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
