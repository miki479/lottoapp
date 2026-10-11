import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { validateCity, usableFeeds, type CityConfig, type FeedConfig } from "./_shared/shared/cities.ts";
import citiesIndex from "./_shared/cities.index.json" with { type: "json" };

if (getApps().length === 0) initializeApp();
export const db = getFirestore();
export { Timestamp, usableFeeds };
export type { CityConfig, FeedConfig };

export const cities: CityConfig[] = (citiesIndex as unknown[]).map(validateCity);
export const cityById = (id: string) => cities.find((c) => c.id === id);
export const allowUnverified = () => process.env.ALLOW_UNVERIFIED_FEEDS === "1";

export const toEpoch = (t: Timestamp | Date | number): number =>
  typeof t === "number" ? t : Math.floor((t instanceof Date ? t.getTime() : t.toMillis()) / 1000);
export const fromEpoch = (e: number) => Timestamp.fromMillis(e * 1000);

/** Firestore document ids cannot contain "/". */
export const safeId = (...parts: string[]) => parts.map((p) => p.replaceAll("/", "_")).join("__");

export function feedUrl(feed: FeedConfig, city: CityConfig): string {
  let url = feed.url;
  if (feed.type === "open-meteo") {
    const q = new URLSearchParams({
      latitude: String(city.location.lat), longitude: String(city.location.lon),
      hourly: "precipitation", timezone: city.timezone, forecast_days: "2", past_days: "1",
    });
    url = `${feed.url}?${q}`;
  }
  if (feed.requiresKey) {
    const key = process.env[feed.requiresKey];
    if (!key) throw new Error(`missing env ${feed.requiresKey}`);
    url += `${url.includes("?") ? "&" : "?"}acl:consumerKey=${encodeURIComponent(key)}`;
  }
  return url;
}
