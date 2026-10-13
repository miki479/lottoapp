import { CITIES } from "./cities.ts";
type CityConfig = (typeof CITIES)[number];
import { FAMOUS_PLACES, FEATURED_PLACES, type Place } from "./places.ts";

/** What a person expects to see first under "Where?": the towns of their own country, then the big ones everyone knows. Names are our own city ids or the names of the famous towns. */
const BY_COUNTRY: Record<string, string[]> = {
  IT: ["rome", "Milano", "torino", "venezia", "Napoli", "Firenze"],
  US: ["New York", "Los Angeles", "sanfrancisco", "boston", "seattle", "denver"],
  CA: ["Toronto", "victoria-bc", "New York", "boston", "seattle"],
  GB: ["London", "paris", "amsterdam", "New York", "berlin"],
  IE: ["London", "paris", "New York", "amsterdam"],
  DE: ["berlin", "amsterdam", "zurich", "paris", "prague", "madrid"],
  AT: ["berlin", "zurich", "prague", "Milano", "paris"],
  CH: ["zurich", "berlin", "Milano", "paris", "madrid"],
  FR: ["paris", "bordeaux", "nantes", "Barcelona", "madrid", "London"],
  ES: ["madrid", "Barcelona", "paris", "Milano", "London"],
  NL: ["amsterdam", "berlin", "paris", "London", "madrid"],
  BE: ["amsterdam", "paris", "berlin", "London"],
  PL: ["prague", "berlin", "paris", "London"],
  CZ: ["prague", "berlin", "paris", "London"],
  FI: ["helsinki", "oslo", "berlin", "London"],
  NO: ["oslo", "helsinki", "London", "berlin"],
  SE: ["helsinki", "oslo", "berlin", "London"],
  JP: ["tokyo", "kumamoto", "toyama", "Singapore", "Sydney", "Los Angeles", "New York"],
  AU: ["brisbane", "Sydney", "Singapore", "tokyo", "London"],
  BR: ["Rio de Janeiro", "Mexico City", "madrid", "New York"],
  MX: ["Mexico City", "Los Angeles", "New York", "madrid"],
};
const FALLBACK = ["New York", "London", "paris", "tokyo", "berlin", "rome"];
/** The language is a hint when the country is unknown. */
const BY_LOCALE: Record<string, string> = { it: "IT", "en-US": "US", "en-GB": "GB", ja: "JP" };

export type StartChip = { city: CityConfig; place?: undefined } | { place: Place; city?: undefined };
const place = (name: string): Place | undefined => [...FEATURED_PLACES, ...FAMOUS_PLACES].find((p) => p.name === name);

/** Up to six chips in the order that makes sense for this person (country first, language as a fallback). */
export function startChips(country: string | null | undefined, locale: string): StartChip[] {
  const cc = (country && BY_COUNTRY[country] ? country : BY_LOCALE[locale]) ?? "";
  const names = [...(BY_COUNTRY[cc] ?? []), ...FALLBACK];
  const out: StartChip[] = [], seen = new Set<string>();
  for (const n of names) {
    const c = CITIES.find((x) => x.id === n && !x.region), pl = c ? undefined : place(n);
    const chip: StartChip | null = c ? { city: c } : pl ? { place: pl } : null;
    if (!chip) continue;
    const key = c ? c.id : pl!.id;
    if (seen.has(key)) continue;
    seen.add(key); out.push(chip);
    if (out.length === 6) break;
  }
  return out;
}
