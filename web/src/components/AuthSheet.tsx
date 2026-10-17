import { Mail, X } from "lucide-preact";
import { FacebookButton } from "./FacebookButton.tsx";
import { useState } from "preact/hooks";
import type { Messages } from "../i18n/index.ts";
import { facebookSignIn, googleSignIn, pendingConfirm, sb } from "../lib/api.ts";
import { useBusy } from "../lib/busy.ts";
import { Sheet } from "./Sheet.tsx";

/** Maps Supabase auth errors to our messages. */
export function authError(e: { message?: string; code?: string } | null, msg: Messages): string {
  const t = `${e?.code ?? ""} ${e?.message ?? ""}`.toLowerCase();
  const k = t.includes("invalid login") || t.includes("invalid_credentials") ? "invalid_credentials"
    : t.includes("same_password") || t.includes("different from the old") ? "same_password"
    : t.includes("email_not_confirmed") || t.includes("not confirmed") ? "email_unconfirmed"
    : t.includes("error sending") || t.includes("unexpected_failure") ? "email_send"
    : t.includes("already") || t.includes("email_exists") ? "email_taken"
    : t.includes("at least") || t.includes("weak_password") ? "weak_password"
    : t.includes("rate") ? "email_rate"
    : t.includes("validate email") || t.includes("email_address_invalid") ? "email_invalid"
    : t.includes("exchange external code") ? "google_retry"
    : t.includes("already linked") || t.includes("identity_already_exists") ? "google_exists"
    : t.includes("not enabled") || t.includes("unsupported provider") ? "provider_off" : "generic";
  // an error that is not known: say so, with its code, so it can be traced instead of a bare "something went wrong"
  return k === "generic" && e?.code ? `${msg.errors.generic!} (${e.code})` : msg.errors[k]!;
}

export function AuthSheet({ msg, guest, googleOn, onClose, onDone }: { msg: Messages; guest: boolean; googleOn: boolean; onClose: () => void; onDone: (text: string) => void }) {
  const [mode, setMode] = useState<"signin" | "signup">(guest ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, run] = useBusy();
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const valid = /.+@.+\..+/.test(email) && password.length >= 8;

  const oops = () => setErr(msg.errors.generic!);
  const submit = () => run(async () => {
    setErr(null); setInfo(null);
    if (mode === "signup" && guest) {
      // Upgrade the guest in place: same account, same credits, now with an email and password.
      const { data, error } = await sb.auth.updateUser({ email, password });
      if (error) setErr(authError(error, msg));
      else if (data.user && data.user.email && !data.user.is_anonymous) onDone(msg.auth.welcome);
      else { pendingConfirm.mark(); setInfo(msg.auth.confirmSent); }
    } else if (mode === "signup") {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } });
      if (error) setErr(authError(error, msg)); else if (data.session) onDone(msg.auth.welcome); else { pendingConfirm.mark(); setInfo(msg.auth.confirmSent); }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) setErr(authError(error, msg)); else onDone(msg.auth.welcome);
    }
  }, oops);
  const magic = () => {
    if (!/.+@.+\..+/.test(email)) return setErr(msg.errors.email_invalid!);
    return run(async () => {
      setErr(null);
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin, shouldCreateUser: true } });
      if (error) setErr(authError(error, msg)); else setInfo(msg.auth.magicSent);
    }, oops);
  };
  const facebook = () => run(async () => { setErr(null); const { error } = await facebookSignIn(); if (error) setErr(authError(error, msg)); }, oops);
  const google = () => run(async () => {
    setErr(null);
    const { error } = guest ? await googleSignIn() : await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin } });
    if (error) setErr(authError(error, msg));
  }, oops);
  return (
    <Sheet onClose={onClose} label={msg.auth.title}>
      <div class="shead"><h2>{msg.auth.title}</h2><button class="iconbtn" onClick={onClose} aria-label={msg.common.close}><X size={22} /></button></div>
      <p style="color:var(--text-2)">{msg.auth.subtitle}</p>
      <div class="seg" role="tablist">
        <button role="tab" class={mode === "signup" ? "on" : ""} aria-selected={mode === "signup"} onClick={() => setMode("signup")}>{msg.auth.tabSignup}</button>
        <button role="tab" class={mode === "signin" ? "on" : ""} aria-selected={mode === "signin"} onClick={() => setMode("signin")}>{msg.auth.tabSignin}</button>
      </div>
      {googleOn && <button class="btn secondary wide" disabled={busy} aria-busy={busy} onClick={google}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.4z" /><path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A12 12 0 0 0 12 24z" /><path fill="#FBBC05" d="M5.6 14.7a7.2 7.2 0 0 1 0-4.6v-3H1.8a12 12 0 0 0 0 10.7z" /><path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3A12 12 0 0 0 1.8 7.1l3.8 3c.9-2.7 3.4-4.7 6.4-4.7z" /></svg>{msg.auth.google}</button>}
      <FacebookButton label={msg.auth.facebook} busy={busy} onClick={facebook} />
      {googleOn && <span class="detail" style="text-align:center">{msg.auth.or}</span>}
      <div><label class="detail fieldlabel" for="em">{msg.auth.email}</label><input id="em" class="field" type="email" autocomplete="email" inputMode="email" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} /></div>
      <div><label class="detail fieldlabel" for="pw">{msg.auth.password}</label><input id="pw" class="field" type="password" autocomplete={mode === "signin" ? "current-password" : "new-password"} value={password} onInput={(e) => setPassword((e.target as HTMLInputElement).value)} /><p class="hint" style="margin-top:6px">{msg.auth.passwordHint}</p></div>
      {err && <p class="formerr" role="alert">{err}</p>}
      {info && <p style="color:var(--text-2)" role="status">{info}</p>}
      <button class="btn primary wide" disabled={busy || !valid} aria-busy={busy} onClick={submit}>{mode === "signup" ? msg.auth.signupCta : msg.auth.signinCta}</button>
      <button class="btn text wide" disabled={busy} aria-busy={busy} onClick={magic}><Mail size={18} />{msg.auth.magic}</button>
      <p class="hint">{guest && mode === "signup" ? msg.auth.guestKeep : guest ? msg.auth.guestLose : ""}</p>
    </Sheet>
  );
}
