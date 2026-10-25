import { useState } from "preact/hooks";
import type { Messages } from "../i18n/index.ts";

/** The version of the terms and privacy text that is in force (when it changes, bump it: the acceptance is stored with it). */
export const TERMS_VERSION = "2026-10";

/**
 * Age and terms confirmation. When the player is creating an account (`required`) a box must be ticked before anything goes ahead; when they sign in the same line is
 * a plain notice (a sign-in with Google, Facebook or a link can still create an account). What was accepted is kept on the account once it exists (see accept_terms).
 */
export function useConsent(msg: Messages, required: boolean) {
  const [agree, setAgree] = useState(false), [need, setNeed] = useState(false);
  const t = msg.auth;
  /** True when it may go ahead. `createsAccount`: the action can open an account even in the sign-in tab (OAuth, magic link). */
  const gate = (createsAccount = false): boolean => {
    if (required && !agree) { setNeed(true); return false; }
    if (required || createsAccount) { try { localStorage.setItem("tos_pending", TERMS_VERSION); } catch { /* private mode */ } }
    return true;
  };
  const node = required ? (
    <label class={`consent ${need && !agree ? "need" : ""}`}>
      <input type="checkbox" checked={agree} onChange={(e) => { setAgree((e.target as HTMLInputElement).checked); setNeed(false); }} />
      <span>{t.agree1}<a href="/terms.html" target="_blank" rel="noopener noreferrer">{t.agreeTerms.trim()}</a>{t.agree2}<a href="/privacy.html" target="_blank" rel="noopener noreferrer">{t.agreePrivacy.trim()}</a>.</span>
    </label>
  ) : <p class="hint consentnote">{t.agreeNote}</p>;
  return { gate, node, need: need && !agree ? t.agreeNeed : null };
}
