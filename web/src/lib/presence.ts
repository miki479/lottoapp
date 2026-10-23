import { sb } from "./api.ts";
import { every } from "./poll.ts";
import { INTL_TAG, type Locale } from "../i18n/index.ts";

/** Stamp "I am here" for friends: once now and then every two minutes while the tab is visible (the server keeps at most one stamp a minute). */
export function startPresence(): () => void {
  const ping = () => { if (document.visibilityState === "visible") void sb.rpc("touch_seen"); };
  ping();
  const stop = every(ping, 120_000);
  document.addEventListener("visibilitychange", ping);
  return () => { stop(); document.removeEventListener("visibilitychange", ping); };
}

const ONLINE_MS = 3 * 60_000;
/** "online now" or "last seen 5 minutes ago"; null when the friend hides it or was never seen. */
export function seenLabel(iso: string | null | undefined, now: number, locale: Locale, p: { online: string; seen: (when: string) => string }): { text: string; online: boolean } | null {
  if (!iso) return null;
  const ago = Math.max(0, now - Date.parse(iso));
  if (ago < ONLINE_MS) return { text: p.online, online: true };
  const rtf = new Intl.RelativeTimeFormat(INTL_TAG[locale], { numeric: "auto" }), m = Math.round(ago / 60_000);
  const when = m < 60 ? rtf.format(-m, "minute") : m < 1440 ? rtf.format(-Math.round(m / 60), "hour") : rtf.format(-Math.round(m / 1440), "day");
  return { text: p.seen(when), online: false };
}
