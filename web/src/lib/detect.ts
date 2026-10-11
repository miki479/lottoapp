import type { Locale } from "../i18n/types.ts";

/** Browser language list (the client-side counterpart of Accept-Language) → one of our locales. */
export function pickLocale(languages: readonly string[]): Locale {
  for (const raw of languages) {
    const l = raw.toLowerCase();
    if (l.startsWith("it")) return "it";
    if (/^en-(gb|au|nz|ie|za|in|sg)\b/.test(l)) return "en-GB";
    if (l.startsWith("en")) return "en-US";
    if (l.startsWith("ja")) return "ja";
  }
  return "en-US";
}

export interface CityInfo { id: string; country: string; timezone: string; enabled: boolean }

const TZ_COUNTRY: Record<string, string> = { "Asia/Tokyo": "JP", "Europe/Rome": "IT", "Europe/Amsterdam": "NL" };

/** Country → city, with the browser timezone as a fallback signal, then the locale. */
export function pickCity(cities: CityInfo[], opts: { country?: string | null; timezone?: string | null; locale: Locale }): string {
  const usable = cities.filter((c) => c.enabled);
  const byCountry = (cc?: string | null) => (cc ? usable.find((c) => c.country === cc.toUpperCase()) : undefined);
  const hit =
    byCountry(opts.country) ??
    byCountry(opts.timezone ? TZ_COUNTRY[opts.timezone] : undefined) ??
    (opts.locale === "it" ? byCountry("IT") : undefined) ??
    (opts.locale === "ja" ? byCountry("JP") : undefined) ??
    usable.find((c) => c.id === "tokyo") ??
    usable[0];
  return hit?.id ?? "tokyo";
}
