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
  category: Exclude<Category, "nature" | "strike">;
  /** Selects the adapter, e.g. "gtfs-rt", "open-meteo". */
  type: string;
  /** For gtfs-rt: "vehicle_positions" | "trip_updates" (explicit delays) | "trip_updates_times" (predicted times only; delay computed against the static timetable). */
  kind?: string;
  url: string;
  staticGtfsUrl?: string;
  /** Extra request headers (e.g. a client name required by the provider). Never secrets: those go through requiresKey. */
  headers?: Record<string, string>;
  /** Name of the environment variable holding the key, or null for open feeds. */
  requiresKey: string | null;
  /** Where the key goes: "query" (ODPT style, default) or "header" (name in keyHeader, optional keyPrefix such as "Bearer "). */
  keyIn?: "query" | "header";
  keyHeader?: string;
  keyPrefix?: string;
  pollSeconds: number;
  staleAfterSeconds: number;
  delaySemantics?: "last_passed_stop";
  /** Only route types to build markets from (GTFS route_type, e.g. 2 = rail, 3 = bus). */
  routeTypes?: number[];
  /** The static calendar does not describe today (Renfe): take the trips that appear in the real-time feed as today's service. */
  useRealtimeTrips?: boolean;
  /** Local hours [from, to) in which questions are created (a feed that goes quiet at night would void them). */
  questionsHours?: [number, number];
  /**
   * True only after someone has read the CURRENT licence/terms of the provider.
   * Unverified feeds are skipped in production unless ALLOW_UNVERIFIED_FEEDS=1.
   */
  licenseVerified: boolean;
  /** Where the licence was read and any usage policy to respect. */
  note?: string;
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
  categories: Record<Exclude<Category, "nature" | "strike">, { enabled: boolean }>;
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
    if (typeof f.licenseVerified !== "boolean") fail(`feed ${f.id}: licenseVerified must be true or false`);
    if (!f.attribution?.license || !f.attribution.url) fail(`feed ${f.id}: attribution is mandatory`);
  }
  for (const cat of ["bus", "train", "weather", "traffic"] as const) {
    if (c.categories?.[cat]?.enabled && !feeds.some((f) => f.category === cat)) {
      fail(`category ${cat} is enabled but has no feed`);
    }
  }
  return c as CityConfig;
}

/** Feeds that may be used: unverified ones need an explicit opt-in (development only). */
export function usableFeeds(city: CityConfig, allowUnverified: boolean): FeedConfig[] {
  return city.feeds.filter((f) => city.categories[f.category]?.enabled && (f.licenseVerified || allowUnverified));
}
