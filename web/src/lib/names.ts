import { INTL_TAG } from "../i18n/index.ts";
import type { Locale } from "../i18n/index.ts";
import { ALERT_AREAS, ALERT_HAZARDS } from "../../../shared/ticks.ts";
import type { Messages } from "../i18n/index.ts";
import { numLocale } from "./num.ts";

/**
 * The names of leagues, clubs and towns as each language writes them. The data keeps the name its source gave (and uses it as a key), so this is display
 * only: a name that is not in a table is shown as it came, which is right for most of them (Juventus, Liverpool, Ajax, Boston Celtics…).
 */

/** English forms; Japanese keeps the Latin spelling of clubs and towns. */
const TEAM_EN: Record<string, string> = {
  "KK Crvena zvezda": "Red Star Belgrade", "KK Partizan": "Partizan Belgrade", "BC Žalgiris": "Žalgiris Kaunas", "Lyon-Villeurbanne": "ASVEL",
  "Bayern München Basketball": "Bayern Munich", "FC Barcelona Basquet": "FC Barcelona", "Virtus Pallacanestro Bologna": "Virtus Bologna", "Anadolu Efes SK": "Anadolu Efes",
  "Hapoel Tel Aviv BC": "Hapoel Tel Aviv", "Maccabi Tel Aviv BC": "Maccabi Tel Aviv", "Besiktas Basketbol": "Beşiktaş Basketball", "Fenerbahçe Basketbol": "Fenerbahçe Basketball",
  "Köln": "Cologne", "Inter Milan": "Inter Milan",
};
const TEAM_IT: Record<string, string> = {
  "KK Crvena zvezda": "Stella Rossa", "KK Partizan": "Partizan", "BC Žalgiris": "Žalgiris", "Lyon-Villeurbanne": "ASVEL", "Bayern München Basketball": "Bayern Monaco",
  "FC Barcelona Basquet": "Barcellona", "Virtus Pallacanestro Bologna": "Virtus Bologna", "Anadolu Efes SK": "Anadolu Efes", "Hapoel Tel Aviv BC": "Hapoel Tel Aviv",
  "Maccabi Tel Aviv BC": "Maccabi Tel Aviv", "Besiktas Basketbol": "Beşiktaş Basket", "Fenerbahçe Basketbol": "Fenerbahçe Basket", "Paris Basketball": "Paris Basket", "Dubai Basketball": "Dubai Basket",
  "Bayern Munich": "Bayern Monaco", "Köln": "Colonia", "Red Bull Salzburg": "Salisburgo", "Sevilla": "Siviglia", "Atlético Madrid": "Atletico Madrid", "AEK Athens": "AEK Atene",
  "Slavia Prague": "Slavia Praga", "Sparta Prague": "Sparta Praga", "Olympiacos": "Olympiakos", "Lyon": "Lione", "Marseille": "Marsiglia", "Inter Milan": "Inter", "AC Milan": "Milan",
  "Heart of Midlothian": "Hearts", "Paris Saint-Germain": "Paris Saint-Germain", "Borussia Mönchengladbach": "Borussia Mönchengladbach",
};
export function teamName(name: string, locale: Locale = numLocale()): string {
  return (locale === "it" ? TEAM_IT : TEAM_EN)[name] ?? name;
}
/** "Home – Away" with both clubs written for the language. */
export function matchName(label: string, locale: Locale = numLocale()): string {
  return label.split(/\s[–-]\s/).map((t) => teamName(t, locale)).join(" – ");
}

const LEAGUE: Record<Locale, Record<string, string>> = {
  it: { "NPB": "Baseball giapponese (NPB)", "Scottish Premiership": "Premiership scozzese", "EuroLeague": "Eurolega", "Serie C - A": "Serie C · Girone A", "Serie C - B": "Serie C · Girone B", "Serie C - C": "Serie C · Girone C" },
  "en-US": { "NPB": "Japan baseball (NPB)", "Serie C - A": "Serie C · Group A", "Serie C - B": "Serie C · Group B", "Serie C - C": "Serie C · Group C" },
  "en-GB": { "NPB": "Japan baseball (NPB)", "Serie C - A": "Serie C · Group A", "Serie C - B": "Serie C · Group B", "Serie C - C": "Serie C · Group C" },
  ja: {
    "Champions League": "チャンピオンズリーグ", "Europa League": "ヨーロッパリーグ", "Conference League": "カンファレンスリーグ", "Premier League": "プレミアリーグ", "La Liga": "ラ・リーガ",
    "Bundesliga": "ブンデスリーガ", "Ligue 1": "リーグ・アン", "Eredivisie": "エールディビジ", "Primeira Liga": "プリメイラ・リーガ", "Scottish Premiership": "スコティッシュ・プレミアシップ",
    "Serie A": "セリエA", "Serie B": "セリエB", "Serie C - A": "セリエC グループA", "Serie C - B": "セリエC グループB", "Serie C - C": "セリエC グループC", "EuroLeague": "ユーロリーグ", "J1 League": "J1リーグ", "NPB": "プロ野球(NPB)",
  },
};
export const leagueName = (name: string, locale: Locale = numLocale()): string => LEAGUE[locale][name] ?? name;

/** Towns the data spells in the language of their country (or in English): the name each of our languages uses. */
const TOWN_IT: Record<string, string> = {
  London: "Londra", Paris: "Parigi", Berlin: "Berlino", Madrid: "Madrid", Cairo: "Il Cairo", "Mexico City": "Città del Messico", "Cape Town": "Città del Capo", Istanbul: "Istanbul",
  Singapore: "Singapore", "Rio de Janeiro": "Rio de Janeiro", Edinburgh: "Edimburgo", Munich: "Monaco di Baviera", München: "Monaco di Baviera", Köln: "Colonia", Cologne: "Colonia",
  Warszawa: "Varsavia", Kraków: "Cracovia", Gdańsk: "Danzica", Wrocław: "Breslavia", Poznań: "Poznań", København: "Copenaghen", Göteborg: "Göteborg", Sevilla: "Siviglia",
  "Den Haag": "L'Aia", Lyon: "Lione", Marseille: "Marsiglia", "Washington DC": "Washington", Seville: "Siviglia", Vienna: "Vienna", Prague: "Praga", Lisbon: "Lisbona",
};
const TOWN_EN: Record<string, string> = {
  Roma: "Rome", Milano: "Milan", Napoli: "Naples", Torino: "Turin", Firenze: "Florence", Venezia: "Venice", Genova: "Genoa", Padova: "Padua", Mantova: "Mantua", Siracusa: "Syracuse",
  München: "Munich", Köln: "Cologne", Warszawa: "Warsaw", Kraków: "Krakow", Gdańsk: "Gdansk", Wrocław: "Wroclaw", København: "Copenhagen", "Den Haag": "The Hague", Sevilla: "Seville",
  Göteborg: "Gothenburg", Málaga: "Malaga",
};
/** "Yokohama 横浜": the Latin name for every language but Japanese, the Japanese one for Japanese. */
const split = (name: string): [string, string] => { const m = /^(.*?)\s+([　-鿿＀-￯]+)$/.exec(name); return m ? [m[1]!, m[2]!] : [name, ""]; };
export function placeName(name: string, locale: Locale = numLocale()): string {
  const [latin, native] = split(name);
  if (locale === "ja") return native || latin;
  return (locale === "it" ? TOWN_IT : TOWN_EN)[latin] ?? latin;
}

/** The alert of a civil-protection zone ("Allerta idraulica (piene dei fiumi) · Romagna") written in the language of the interface, from the series ("alert:romagna:idraulica"). */
export function alertLabel(series: string, msg: Messages, fallback = ""): string {
  const m = /^alert:([a-z]+):([a-z]+)$/.exec(series);
  if (!m) return fallback;
  const hazard = msg.alertHazards[m[2] as keyof Messages["alertHazards"]], area = msg.alertAreas[m[1] as keyof Messages["alertAreas"]];
  return hazard && area ? `${hazard} · ${area}` : fallback;
}
/** The same from the label the data carries (the activity list has no series): the Italian words are matched to their key. */
export function alertLabelOf(label: string, msg: Messages): string {
  const [h, a] = label.split(" · ");
  const hk = Object.entries(ALERT_HAZARDS).find(([, v]) => v.label === h)?.[0], ak = Object.entries(ALERT_AREAS).find(([, v]) => v.label === a)?.[0];
  return hk && ak ? alertLabel(`alert:${ak}:${hk}`, msg, label) : label;
}

/** What a card says it is about, under its picture: the league, the series, the line with its town, or the town — always in the language of the interface. `place` is the town already written for the language. */
/** The operator behind a regional feed: "Romagna" says nothing about who runs the bus, "START Romagna" does. */
const OPERATOR: Record<string, string> = { romagna: "START Romagna", toscana: "Toscana", lazio: "COTRAL", trentino: "Trentino Trasporti", "alto-adige": "STA Alto Adige", "friuli-venezia-giulia": "TPL FVG" };
export const operatorOf = (cityId: string): string | null => OPERATOR[cityId] ?? null;

export function subjectOf(m: { kind: string; params: Record<string, unknown>; city_id?: string }, msg: Messages, locale: Locale, place: string): string {
  const p = m.params;
  if (m.kind === "match_bet") return leagueName(String(p.league ?? ""), locale);
  if (m.kind === "tick_gt") return alertLabel(String(p.series ?? ""), msg) || (msg.cm[String(p.label ?? "")] ?? String(p.label ?? ""));
  if (m.kind.endsWith("_delay_gt") || m.kind === "bus_full") {
    // a regional feed names the stop and the operator instead of the region
    const op = (m as { city_id?: string }).city_id ? operatorOf((m as { city_id: string }).city_id) : null, stop = String(p.stopName ?? "");
    return op ? `${String(p.routeName ?? "")} · ${stop ? `${stop} · ` : ""}${op}` : `${String(p.routeName ?? "")} · ${place}`;
  }
  // an earthquake is about a zone and a size, not about the city the market happens to be filed under
  if (m.kind === "quake_m") { const r = String(p.region ?? ""); return `M${Number(p.minMag).toLocaleString(INTL_TAG[locale], { maximumFractionDigits: 1 })}+ · ${r === "custom" ? String(p.place ?? "") : r ? (msg.wx.regions[r] ?? r) : msg.world}`; }
  return place;
}
