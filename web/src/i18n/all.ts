import enGB from "./en-GB.ts";
import enUS from "./en-US.ts";
import it from "./it.ts";
import ja from "./ja.ts";
import type { Locale, Messages } from "./types.ts";

/** Every language at once, loaded eagerly: for the tests and tools. The app itself loads one language at a time (see index.ts). */
export const MESSAGES: Record<Locale, Messages> = { it, "en-US": enUS, "en-GB": enGB, ja };
