import { INTL_TAG, type Locale } from "../i18n/index.ts";

/**
 * Optional station-style announcements through the browser's own speech synthesis (free, offline, no data leaves the phone).
 * It is off until the player turns it on, speaks only for events that matter, never twice for the same one, and waits 12 s between phrases.
 */
const KEY = "voice";
let last = 0;
const said = new Set<string>();

export const voiceSupported = () => typeof speechSynthesis !== "undefined";
export const voiceEnabled = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
export const setVoice = (on: boolean) => { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* storage unavailable */ } if (!on && voiceSupported()) speechSynthesis.cancel(); };

export function announce(id: string, text: string, locale: Locale, force = false) {
  if (!voiceSupported() || (!force && !voiceEnabled()) || said.has(id)) return;
  if (!force && Date.now() - last < 12_000) return;
  said.add(id); last = Date.now();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = INTL_TAG[locale]; u.rate = 0.95;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}
