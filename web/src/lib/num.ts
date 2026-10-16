import { INTL_TAG } from "../i18n/tags.ts";
import type { Locale } from "../i18n/types.ts";

/** The one place figures become text on screen: Intl in the language of the interface, thousands separators from four digits on (Italian leaves 1100 ungrouped by default), a true minus sign. */
export const MINUS = "−";

/** The language the figures are written in; the app sets it together with the language of the interface. */
let active: Locale = "it";
export const setNumLocale = (l: Locale) => { active = l; };
export const numLocale = (): Locale => active;

/** `useGrouping: "always"` (thousands separators at four digits too) is newer than the type definitions in use; engines that do not know it fall back to their default grouping. */
export const ALWAYS = "always" as unknown as boolean;

const cache = new Map<string, Intl.NumberFormat>();
function make(l: Locale, o: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${l}|${JSON.stringify(o)}`;
  let f = cache.get(key);
  if (!f) { f = new Intl.NumberFormat(INTL_TAG[l], o); cache.set(key, f); }
  return f;
}
/** Intl writes a hyphen for a negative number and the full-width yen sign for Japanese money; the screen gets the minus sign and the plain yen. */
export const trueMinus = (s: string) => s.replace("-", MINUS).replace("￥", "¥");

/** 11.119 in Italian, 11,119 in English: whole numbers with the thousands separator even at four digits. */
export const fmtInt = (n: number, l: Locale = active): string => trueMinus(make(l, { maximumFractionDigits: 0, useGrouping: ALWAYS }).format(Math.round(n)));

/** +616 / -189 / 0 with the true minus: a change with its sign (zero stays unsigned). */
export const fmtSigned = (n: number, l: Locale = active): string => trueMinus(make(l, { maximumFractionDigits: 0, useGrouping: ALWAYS, signDisplay: "exceptZero" }).format(Math.round(n)));

/** 1,56 in Italian, 1.56 in English: odds always with two decimals. */
export const fmtOdds = (odds: number, l: Locale = active): string => make(l, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(odds);

/** ×1,56: odds written as a multiplier, the glyph always in front. */
export const fmtMult = (odds: number, l: Locale = active): string => `×${fmtOdds(odds, l)}`;

/** ×2 / ×1,5: a multiplier that is not odds (flash, boost, super quota), without trailing zeros. */
export const fmtTimes = (x: number, l: Locale = active): string => `\u00D7${fmtNum(x, l, 2)}`;

/** A number with a fixed count of decimals (0,04 / 0.04), thousands separators included. */
export const fmtDec = (n: number, digits = 1, l: Locale = active): string => trueMinus(make(l, { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: ALWAYS }).format(n));

/** A number as it is, up to two decimals (226,5 / 226.5). */
export const fmtNum = (n: number, l: Locale = active, maxDecimals = 2): string => trueMinus(make(l, { maximumFractionDigits: maxDecimals, useGrouping: ALWAYS }).format(n));

/** 56% (a share between 0 and 1); `signed` writes +1,2% with the true minus for a loss. */
export const fmtPct = (share: number, l: Locale = active, o: { digits?: number; signed?: boolean } = {}): string =>
  trueMinus(make(l, { style: "percent", maximumFractionDigits: o.digits ?? 0, ...(o.signed ? { signDisplay: "exceptZero" as const } : {}) }).format(share));

/** 14 min (Italian and English), 14 分 (Japanese); `signed` writes +14 min / -3 min with the true minus. */
export const fmtMin = (minutes: number, l: Locale = active, signed = false): string =>
  trueMinus(make(l === "en-GB" ? "en-US" : l, { style: "unit", unit: "minute", unitDisplay: "short", maximumFractionDigits: 0, ...(signed ? { signDisplay: "exceptZero" as const } : {}) }).format(Math.round(minutes)));

/** The money sign of a language: € in Italian, $ for US English, £ for British English, ¥ for Japanese. Play money, not real. */
const CURRENCY: Record<Locale, string> = { it: "EUR", "en-US": "USD", "en-GB": "GBP", ja: "JPY" };
export const currencySymbol = (l: Locale = active): string =>
  trueMinus(make(l, { style: "currency", currency: CURRENCY[l], currencyDisplay: "narrowSymbol" }).formatToParts(0).find((p) => p.type === "currency")?.value ?? "");
/** Credits with the currency of the audience, thousands separators included (1.100 €, $1,100). */
export const money = (n: number, l: Locale = active): string =>
  trueMinus(make(l, { style: "currency", currency: CURRENCY[l], currencyDisplay: "narrowSymbol", maximumFractionDigits: 0, useGrouping: ALWAYS }).format(Math.round(n)));
/** +25.718 € / -189 € with the true minus: a change in credits with its currency sign (zero stays unsigned). */
export const moneySigned = (n: number, l: Locale = active): string =>
  trueMinus(make(l, { style: "currency", currency: CURRENCY[l], currencyDisplay: "narrowSymbol", maximumFractionDigits: 0, useGrouping: ALWAYS, signDisplay: "exceptZero" }).format(Math.round(n)));

/** The word or sign for minutes in a language ("min", "分"). */
export const minUnit = (l: Locale = active): string =>
  make(l === "en-GB" ? "en-US" : l, { style: "unit", unit: "minute", unitDisplay: "short" }).formatToParts(2).find((p) => p.type === "unit")?.value ?? "min";
