import type { CityConfig } from "../../../shared/cities.ts";

// City files are bundled at build time: adding one under /cities needs no code change.
const files = import.meta.glob("../../../cities/*.json", { eager: true, import: "default" }) as Record<string, CityConfig>;
export const CITIES: CityConfig[] = Object.values(files).sort((a, b) => a.id.localeCompare(b.id));

import { placeAsCity, placeById } from "./places.ts";
/** Questions about the whole planet (earthquakes) belong to no city. */
const WORLD: CityConfig = { id: "world", country: "", name: { it: "Mondo", "en-US": "World", "en-GB": "World", ja: "世界" }, timezone: "UTC", defaultLocale: "en-US", tone: {}, location: { lat: 0, lon: 0 }, categories: { bus: { enabled: false }, train: { enabled: false }, weather: { enabled: false }, traffic: { enabled: false } }, feeds: [] };
export const cityOf = (id: string): CityConfig => { if (id === "world") return WORLD; const p = placeById(id); return CITIES.find((c) => c.id === id) ?? (p ? placeAsCity(p) : CITIES[0]!); };
export const enabledCategories = (c: CityConfig) => (["bus", "train", "weather", "traffic"] as const).filter((k) => c.categories[k]?.enabled);
export const cityInfos = () => CITIES.map((c) => ({ id: c.id, country: c.country, timezone: c.timezone, enabled: enabledCategories(c).length > 0 }));
export const cityName = (c: CityConfig, locale: string) => c.name[locale] ?? c.name["en-US"] ?? c.id;
