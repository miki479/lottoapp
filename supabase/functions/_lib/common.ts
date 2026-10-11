// Shared by the Edge Functions. `_shared/` (copy of /shared and /cities) is created by
// scripts/build-functions.mjs before deploy, because Supabase bundles only supabase/functions.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { validateCity, usableFeeds, type CityConfig, type FeedConfig } from "../_shared/shared/cities.ts";

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
  const index = (await import("../_shared/cities.index.json", { with: { type: "json" } })).default as unknown[];
  return index.map(validateCity);
}

export { usableFeeds };
export type { CityConfig, FeedConfig };

/** Key for a feed: ODPT-style tokens go in the URL, from the environment, never from code. */
export function feedUrl(feed: FeedConfig, city: CityConfig): string {
  let url = feed.url;
  if (feed.type === "open-meteo") {
    const q = new URLSearchParams({
      latitude: String(city.location.lat),
      longitude: String(city.location.lon),
      hourly: "precipitation",
      timezone: city.timezone,
      forecast_days: "2",
      past_days: "1",
    });
    url = `${feed.url}?${q}`;
  }
  if (feed.requiresKey) {
    const key = Deno.env.get(feed.requiresKey);
    if (!key) throw new Error(`missing env ${feed.requiresKey}`);
    url += `${url.includes("?") ? "&" : "?"}acl:consumerKey=${encodeURIComponent(key)}`;
  }
  return url;
}
