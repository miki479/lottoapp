import type { Category } from "./types.ts";

export interface FeedAttribution {
  name: string;
  via?: string;
  license: string;
  licenseUrl: string;
  url: string;
}

export interface FeedConfig {
  id: string;
  category: Category;
  /** Selects the adapter, e.g. "gtfs-rt", "open-meteo". */
  type: string;
  /** For gtfs-rt: "vehicle_positions" | "trip_updates". */
  kind?: string;
  url: string;
  staticGtfsUrl?: string;
  /** Name of the environment variable holding the key, or null for open feeds. */
  requiresKey: string | null;
  pollSeconds: number;
  staleAfterSeconds: number;
  delaySemantics?: "last_passed_stop";
  attribution: FeedAttribution;
}

export interface CityConfig {
  id: string;
  country: string;
  name: Record<string, string>;
  timezone: string;
  defaultLocale: string;
  tone: Record<string, string>;
  location: { lat: number; lon: number };
  categories: Record<Category, { enabled: boolean }>;
  feeds: FeedConfig[];
}

/** Throws a readable error if a city file is malformed. Adding a city must not need code changes. */
export function validateCity(raw: unknown): CityConfig {
  const c = raw as Partial<CityConfig> | null;
  const fail = (m: string): never => {
    throw new Error(`Invalid city config${c?.id ? ` "${c.id}"` : ""}: ${m}`);
  };
  if (!c || typeof c !== "object") return fail("not an object");
  if (!c.id || !/^[a-z0-9-]+$/.test(c.id)) fail("id must be a lowercase slug");
  if (!c.country || !/^[A-Z]{2}$/.test(c.country)) fail("country must be an ISO 3166-1 alpha-2 code");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: c.timezone });
  } catch {
    fail(`unknown timezone ${c.timezone}`);
  }
  if (!c.name || Object.keys(c.name).length === 0) fail("name is required");
  if (!c.defaultLocale) fail("defaultLocale is required");
  if (!c.location || typeof c.location.lat !== "number" || typeof c.location.lon !== "number") fail("location lat/lon required");
  const feeds = c.feeds ?? [];
  const ids = new Set<string>();
  for (const f of feeds) {
    if (!f.id || ids.has(f.id)) fail(`duplicate or missing feed id ${f.id}`);
    ids.add(f.id);
    if (!f.url?.startsWith("https://")) fail(`feed ${f.id}: url must be https`);
    if (!(f.pollSeconds > 0) || !(f.staleAfterSeconds >= f.pollSeconds)) fail(`feed ${f.id}: bad poll/stale seconds`);
    if (!f.attribution?.license || !f.attribution.url) fail(`feed ${f.id}: attribution is mandatory`);
  }
  for (const cat of ["bus", "weather", "traffic"] as const) {
    if (c.categories?.[cat]?.enabled && !feeds.some((f) => f.category === cat)) {
      fail(`category ${cat} is enabled but has no feed`);
    }
  }
  return c as CityConfig;
}
