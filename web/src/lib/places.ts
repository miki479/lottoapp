import type { CityConfig } from "../../../shared/cities.ts";
import { sb } from "./api.ts";
import { placeName } from "./names.ts";
import type { Locale } from "../i18n/index.ts";

/** A town a player picked: weather questions can be opened for any place on Earth (see migration 0019). */
export interface Place { id: string; name: string; admin: string | null; country: string; lat: number; lon: number; timezone: string }

const KEY = "places";
const registry = new Map<string, Place>();

/** Lookup used by cityOf(): places behave like cities (name, time zone, country) for cards and lists. */
export const placeAsCity = (p: Place): CityConfig => ({
  id: p.id, country: p.country, name: new Proxy({} as Record<string, string>, { get: (_t, locale) => placeName(p.name, String(locale) as Locale) }), timezone: p.timezone, defaultLocale: "en-US", tone: {}, location: { lat: p.lat, lon: p.lon },
  categories: { bus: { enabled: false }, train: { enabled: false }, weather: { enabled: true }, traffic: { enabled: false } }, feeds: [],
});
export const placeById = (id: string) => registry.get(id);
export const registerPlace = (p: Place) => { registry.set(p.id, p); };

export function recentPlaces(): Place[] {
  try { const l = (JSON.parse(localStorage.getItem(KEY) ?? "[]") as Place[]).filter((p) => p?.id && p.name); l.forEach(registerPlace); return l; } catch { return []; }
}
export function rememberPlace(p: Place): Place[] {
  registerPlace(p);
  const l = [p, ...recentPlaces().filter((x) => x.id !== p.id)].slice(0, 6);
  try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* private mode */ }
  return l;
}
export const placeIdOf = (lat: number, lon: number) => `p-${lat.toFixed(2)}_${lon.toFixed(2)}`;

/** The 20 regional capitals of Italy as one-tap shortcuts (everything else is a search away). */
export const ITALY_CAPITALS: Omit<Place, "id">[] = [
  ["Aosta", "Valle d'Aosta", 45.7375, 7.3206], ["Torino", "Piemonte", 45.0703, 7.6869], ["Milano", "Lombardia", 45.4642, 9.19], ["Trento", "Trentino-Alto Adige", 46.0679, 11.1211],
  ["Venezia", "Veneto", 45.4408, 12.3155], ["Trieste", "Friuli-Venezia Giulia", 45.6495, 13.7768], ["Genova", "Liguria", 44.4056, 8.9463], ["Bologna", "Emilia-Romagna", 44.4949, 11.3426],
  ["Firenze", "Toscana", 43.7696, 11.2558], ["Perugia", "Umbria", 43.1107, 12.3908], ["Ancona", "Marche", 43.6158, 13.5189], ["Roma", "Lazio", 41.9028, 12.4964],
  ["L'Aquila", "Abruzzo", 42.3498, 13.3995], ["Campobasso", "Molise", 41.5603, 14.6627], ["Napoli", "Campania", 40.8518, 14.2681], ["Bari", "Puglia", 41.1171, 16.8719],
  ["Potenza", "Basilicata", 40.6404, 15.8056], ["Catanzaro", "Calabria", 38.9098, 16.5877], ["Palermo", "Sicilia", 38.1157, 13.3615], ["Cagliari", "Sardegna", 39.2238, 9.1217],
].map(([name, admin, lat, lon]) => ({ name: name as string, admin: admin as string, country: "IT", lat: lat as number, lon: lon as number, timezone: "Europe/Rome" }));

/** Free geocoding by Open-Meteo (CC BY 4.0, no key). */
export async function searchPlaces(q: string, lang: string, signal?: AbortSignal): Promise<Place[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=${lang}&format=json`;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`geocoding ${r.status}`);
  const j = (await r.json()) as { results?: { name: string; latitude: number; longitude: number; country_code?: string; admin1?: string; timezone?: string }[] };
  return (j.results ?? []).filter((x) => x.country_code && x.timezone).map((x) => ({ id: placeIdOf(x.latitude, x.longitude), name: x.name, admin: x.admin1 ?? null, country: x.country_code!, lat: x.latitude, lon: x.longitude, timezone: x.timezone! }));
}

/** Registers the place on the server and opens its rain questions. Returns the server's place id. */
export async function ensurePlace(p: Omit<Place, "id">): Promise<string> {
  const { data, error } = await sb.rpc("ensure_place", { p_name: p.name, p_admin: p.admin, p_country: p.country, p_lat: p.lat, p_lon: p.lon, p_tz: p.timezone });
  if (error) throw new Error(error.message);
  // known from now on: a market made on this place must be named after it (an id nobody knows used to fall back to the first city of the list)
  registerPlace({ ...p, id: data as string });
  return data as string;
}

const mk = (name: string, country: string, lat: number, lon: number, timezone: string, admin: string | null = null): Place => ({ id: placeIdOf(lat, lon), name, admin, country, lat, lon, timezone });
const it = (name: string) => { const c = ITALY_CAPITALS.find((x) => x.name === name)!; return { ...c, id: placeIdOf(c.lat, c.lon) } as Place; };

/** The famous towns that get a chip on the home screen (small towns never do: they live in the picker and show up only while selected). */
export const FEATURED_PLACES: Place[] = [
  it("Milano"), mk("London", "GB", 51.5074, -0.1278, "Europe/London"), mk("Paris", "FR", 48.8566, 2.3522, "Europe/Paris"), mk("New York", "US", 40.7128, -74.006, "America/New_York"),
];
/** Our own cities with bus/train data that also get a permanent chip (the rest are in the picker, or show up as "trending"). */
export const FEATURED_CITY_IDS = ["rome", "tokyo"];
/** More famous towns, shown in the picker. */
export const FAMOUS_PLACES: Place[] = [
  it("Napoli"), it("Firenze"), mk("Dubai", "AE", 25.2048, 55.2708, "Asia/Dubai"), mk("Sydney", "AU", -33.8688, 151.2093, "Australia/Sydney"),
  mk("Madrid", "ES", 40.4168, -3.7038, "Europe/Madrid"), mk("Barcelona", "ES", 41.3874, 2.1686, "Europe/Madrid"), mk("Berlin", "DE", 52.52, 13.405, "Europe/Berlin"),
  mk("Los Angeles", "US", 34.0522, -118.2437, "America/Los_Angeles"), mk("Istanbul", "TR", 41.0082, 28.9784, "Europe/Istanbul"), mk("Singapore", "SG", 1.3521, 103.8198, "Asia/Singapore"),
  mk("Rio de Janeiro", "BR", -22.9068, -43.1729, "America/Sao_Paulo"), mk("Bangkok", "TH", 13.7563, 100.5018, "Asia/Bangkok"), mk("Cairo", "EG", 30.0444, 31.2357, "Africa/Cairo"),
  mk("Mexico City", "MX", 19.4326, -99.1332, "America/Mexico_City"), mk("Toronto", "CA", 43.6532, -79.3832, "America/Toronto"), mk("Cape Town", "ZA", -33.9249, 18.4241, "Africa/Johannesburg"),
];
/** Great-circle distance in km. */
export function km(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}
[...FEATURED_PLACES, ...FAMOUS_PLACES].forEach(registerPlace);

/** Teaches the registry the places behind a list of market city ids (the ones made on a place somebody else opened): without them a market would be named after the wrong town. */
export async function learnPlaces(cityIds: Iterable<string>): Promise<void> {
  const missing = [...new Set([...cityIds].filter((id) => id.startsWith("p-") && !registry.has(id)))].slice(0, 60);
  if (!missing.length) return;
  const { data } = await sb.from("places").select("id,name,admin,country,lat,lon,timezone").in("id", missing);
  for (const r of (data ?? []) as { id: string; name: string; admin: string | null; country: string; lat: number; lon: number; timezone: string }[]) registerPlace({ id: r.id, name: r.name, admin: r.admin, country: r.country, lat: Number(r.lat), lon: Number(r.lon), timezone: r.timezone });
}
