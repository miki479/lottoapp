import type { CityConfig } from "../../../shared/cities.ts";
import { sb } from "./api.ts";

/** A town a player picked: weather questions can be opened for any place on Earth (see migration 0019). */
export interface Place { id: string; name: string; admin: string | null; country: string; lat: number; lon: number; timezone: string }

const KEY = "places";
const registry = new Map<string, Place>();

/** Lookup used by cityOf(): places behave like cities (name, time zone, country) for cards and lists. */
export const placeAsCity = (p: Place): CityConfig => ({
  id: p.id, country: p.country, name: new Proxy({} as Record<string, string>, { get: () => p.name }), timezone: p.timezone, defaultLocale: "en-US", tone: {}, location: { lat: p.lat, lon: p.lon },
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
  return data as string;
}
