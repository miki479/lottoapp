import enGB from "./en-GB.ts";
import enUS from "./en-US.ts";
import it from "./it.ts";
import ja from "./ja.ts";
import type { Locale, Messages } from "./types.ts";

export * from "./types.ts";
/** Register new languages here (e.g. `ja`) after adding the file and the Locale id. */
export const MESSAGES: Record<Locale, Messages> = { it, "en-US": enUS, "en-GB": enGB, ja };
export const t = (l: Locale): Messages => MESSAGES[l];
export { INTL_TAG } from "./tags.ts";
