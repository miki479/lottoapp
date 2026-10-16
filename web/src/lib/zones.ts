import type { MarketRow } from "./format.ts";

/** Italian train stations are numbered by the railway's own areas: the first two digits of the code (S08409, or 08409 in the timetable files) say which. They follow the regions closely, not exactly. */
const ZONES: Record<string, string> = {
  "00": "Piemonte", "01": "Lombardia", "17": "Lombardia", "02": "Veneto e Trentino-Alto Adige", "03": "Friuli Venezia Giulia", "04": "Liguria", "05": "Emilia-Romagna", "06": "Toscana",
  "07": "Marche, Umbria e Abruzzo", "08": "Lazio", "09": "Campania", "10": "Puglia, Basilicata e Calabria", "11": "Puglia, Basilicata e Calabria", "13": "Puglia, Basilicata e Calabria", "12": "Sicilia", "14": "Sardegna",
};
/** Stations on the border that the railway numbers with the neighbouring area. */
const OVERRIDE: Record<string, string> = { "minturno-scauri": "Lazio", "formia-gaeta": "Lazio" };

/** The area of an Italian train question, or null when it has none (other countries, unknown codes). */
export function trainZone(m: MarketRow): string | null {
  if (m.category !== "train" || m.city_id !== "italia") return null;
  const name = String(m.params.stopName ?? "").toLowerCase().trim();
  if (OVERRIDE[name]) return OVERRIDE[name]!;
  const code = String(m.params.stopId ?? "").replace(/^S/i, "");
  return ZONES[code.slice(0, 2)] ?? null;
}

export type TrainClass = "hs" | "ic" | "reg";
/** High speed (Frecciarossa, Frecciargento, Frecciabianca, Italo), long distance (Intercity, EuroCity, night trains) and regional, from the name of the train. */
export function trainClass(m: MarketRow): TrainClass | null {
  if (m.category !== "train" || m.city_id !== "italia") return null;
  const k = String(m.params.routeName ?? "").trim().split(/\s+/)[0]?.toUpperCase() ?? "";
  if (["FR", "FA", "FB", "NTV", "ITALO"].includes(k)) return "hs";
  if (["IC", "ICN", "EC", "EN", "ICE"].includes(k)) return "ic";
  return "reg";
}
export const CLASS_LABEL: Record<string, Record<TrainClass, string>> = {
  it: { hs: "Alta velocità", ic: "Intercity", reg: "Regionali" },
  "en-US": { hs: "High speed", ic: "Intercity", reg: "Regional" },
  "en-GB": { hs: "High speed", ic: "Intercity", reg: "Regional" },
  ja: { hs: "高速", ic: "長距離", reg: "普通" },
};
