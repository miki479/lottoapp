import type { Locale, Messages } from "./types.ts";

export * from "./types.ts";
export { INTL_TAG } from "./tags.ts";

/**
 * The app loads only the language in use (each one is its own chunk, tens of kB): `loadMessages` fetches it, `t` reads it afterwards.
 * To register a new language add the file, the Locale id, and a line below.
 */
const loaders: Record<Locale, () => Promise<{ default: Messages }>> = {
  it: () => import("./it.ts"), "en-US": () => import("./en-US.ts"), "en-GB": () => import("./en-GB.ts"), ja: () => import("./ja.ts"),
};
const cache: Partial<Record<Locale, Messages>> = {};
export async function loadMessages(l: Locale): Promise<Messages> {
  return (cache[l] ??= (await loaders[l]()).default);
}
export const t = (l: Locale): Messages => {
  const m = cache[l];
  if (!m) throw new Error(`messages for ${l} are not loaded`);
  return m;
};
