// Shared by the Edge Functions. `_shared/` (copy of /shared and /cities) is created by
// scripts/build-functions.mjs before deploy, because Supabase bundles only supabase/functions.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { validateCity, usableFeeds, type CityConfig, type FeedConfig } from "../_shared/shared/cities.ts";
import citiesIndex from "../_shared/cities.index.json" with { type: "json" };

export const db = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

export function requireCron(req: Request): Response | null {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return new Response("forbidden", { status: 403 });
  return null;
}

export const allowUnverified = () => Deno.env.get("ALLOW_UNVERIFIED_FEEDS") === "1";

export async function loadCities(): Promise<CityConfig[]> {
  return (citiesIndex as unknown[]).map(validateCity);
}

/** Wrap a handler so a crash returns its message (the hosted runtime otherwise only says 500). */
export function safe(handler: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req) => {
    try {
      return await handler(req);
    } catch (e) {
      console.error(e);
      return Response.json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
    }
  };
}

/** Feeds switched off to spare the database's disk IO: bus lines nobody bets on (≤3 bets in 30 days against hundreds of questions) and road traffic. Switch back on by deleting the id. */
const FEEDS_OFF = new Set([
  "sta-trip-updates", "renfe-trip-update", "amtab-trip-updates", "apam-trip-updates", "trentino-trip-updates", "entur-ruter-trip-update", "tep-trip-updates",
  "seta-mo-trip-updates", "actv-nav-trip-updates", "grandabus-trip-updates", "hsl-trip-update", "arriva-trip-updates", "tbm-bus-trip-update", "pid-bus-trip-update",
  "naolib-bus-trip-update", "translink-seq-bus-trip-update", "zditm-trip-update", "entur-kol-trip-update", "entur-atb-trip-update", "translink-seq-train-trip-update",
]);
const usableFeedsOn = (city: CityConfig, allow: boolean): FeedConfig[] => usableFeeds(city, allow).filter((f) => !FEEDS_OFF.has(f.id) && f.type !== "digitraffic-tms");
export { usableFeedsOn as usableFeeds };
export type { CityConfig, FeedConfig };

/** Key for a feed: ODPT-style tokens go in the URL, from the environment, never from code. */
export function feedUrl(feed: FeedConfig, city: CityConfig): string {
  let url = feed.url;
  if (feed.type === "open-meteo") {
    const q = new URLSearchParams({
      latitude: String(city.location.lat),
      longitude: String(city.location.lon),
      hourly: "precipitation",
      timezone: "GMT",
      forecast_days: "2",
      past_days: "1",
    });
    url = `${feed.url}?${q}`;
  }
  if (feed.requiresKey && feed.keyIn !== "header") {
    const key = Deno.env.get(feed.requiresKey);
    if (!key) throw new Error(`missing env ${feed.requiresKey}`);
    url += `${url.includes("?") ? "&" : "?"}acl:consumerKey=${encodeURIComponent(key)}`;
  }
  return url;
}
