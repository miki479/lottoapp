/**
 * A date formatter is expensive to build (a few tenths of a millisecond, much more on a phone) and the app asks for hundreds of them while drawing a list.
 * They are built once per language and option set and reused.
 */
const cache = new Map<string, Intl.DateTimeFormat>();
export function dtf(locale?: string | string[], options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${Array.isArray(locale) ? locale.join(",") : locale ?? ""}|${options ? JSON.stringify(options) : ""}`;
  let f = cache.get(key);
  if (!f) { f = new Intl.DateTimeFormat(locale, options); if (cache.size > 200) cache.clear(); cache.set(key, f); }
  return f;
}
