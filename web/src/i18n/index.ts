import enGB from "./en-GB.ts";
import enUS from "./en-US.ts";
import it from "./it.ts";
import type { Locale, Messages } from "./types.ts";

export * from "./types.ts";
/** Register new languages here (e.g. `ja`) after adding the file and the Locale id. */
export const MESSAGES: Record<Locale, Messages> = { it, "en-US": enUS, "en-GB": enGB };
export const t = (l: Locale): Messages => MESSAGES[l];
export const INTL_TAG: Record<Locale, string> = { it: "it-IT", "en-US": "en-US", "en-GB": "en-GB" };
