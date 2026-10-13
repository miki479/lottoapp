import { CITIES } from "./cities.ts";
import { placeById } from "./places.ts";
import { MAP_PROVINCES, MAP_REGIONS } from "./italyMap.ts";

/** Italian regions as filters ("reg:<id>"): which region a town or a region-wide feed belongs to, and the names to show. */
const BY_FEED: Record<string, string> = { romagna: "emilia-romagna", lazio: "lazio", toscana: "toscana", trentino: "trentino-alto-adige", "alto-adige": "trentino-alto-adige", "friuli-venezia-giulia": "friuli-venezia-giulia" };
const cache = new Map<string, string | null>();

/** The region of a point in Italy: the one of the nearest province (data points are the provinces' middles, so a town is never far from its own). */
export function regionOfPoint(lat: number, lon: number): string | null {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (cache.has(key)) return cache.get(key)!;
  let best: string | null = null, bd = 0.9 * 0.9; // about 80-100 km: beyond that it is not in Italy
  for (const p of MAP_PROVINCES) { const d = (p.lat - lat) ** 2 + ((p.lon - lon) * 0.74) ** 2; if (d < bd) { bd = d; best = p.region; } }
  cache.set(key, best);
  return best;
}
export const regionOfFeed = (cityId: string): string | null => BY_FEED[cityId] ?? null;
export const REGION_FILTER = "reg:";
export const isRegionFilter = (f: string) => f.startsWith(REGION_FILTER);
export const regionLabel = (id: string, locale: string): string => { const r = MAP_REGIONS.find((x) => x.id === id); return r ? (locale === "it" ? r.name : r.en) : id; };
/** The five regions shown as chips before the player's own: the biggest ones. */
export const TOP_REGIONS = ["lombardia", "lazio", "campania", "veneto", "emilia-romagna"];

/** Where a question's town is: one of our cities, or a town a player added. */
export const locOf = (id: string): { lat: number; lon: number } | null => { const c = CITIES.find((x) => x.id === id); if (c) return c.location; const pl = placeById(id); return pl ? { lat: pl.lat, lon: pl.lon } : null; };
/** The Italian region a question's town belongs to (null abroad). */
export const regionOfCity = (id: string): string | null => { const f = regionOfFeed(id); if (f) return f; const l = locOf(id); const c = CITIES.find((x) => x.id === id)?.country ?? placeById(id)?.country; return l && c === "IT" ? regionOfPoint(l.lat, l.lon) : null; };
