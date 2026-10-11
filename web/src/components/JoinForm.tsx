import { useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { googleSignIn, sb } from "../lib/api.ts";
import { money } from "../lib/format.ts";
import { authError } from "./AuthSheet.tsx";

/**
 * "Last step" of a bet for a guest: e-mail + password (or Google), then the bet goes through.
 * The guest account is upgraded in place, so credits, streak and bets stay with the player.
 */
export function JoinForm(p: { msg: Messages; locale: Locale; googleOn: boolean; stakeLabel: string; onJoined: () => Promise<void> }) {
  const [mode, setMode] = useState<"new" | "have">("new");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const m = p.msg;
  const ok = password.length >= 8 && /.+@.+\..+/.test(email);

  const go = async () => {
    setBusy(true); setErr(null); setInfo(null);
    try {
      if (mode === "have") {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) { setErr(authError(error, m)); return; }
        await p.onJoined(); return;
      }
      const { data, error } = await sb.auth.updateUser({ email: email.trim(), password });
      if (error) { setErr(authError(error, m)); return; }
      if (!data.user || data.user.is_anonymous || !data.user.email) { setInfo(m.join.checkMail); return; }
      await p.onJoined();
    } finally { setBusy(false); }
  };
  const google = async () => {
    setErr(null);
    const { error } = await googleSignIn();
    if (error) setErr(authError(error, m));
  };
  return (
    <div class="joinform">
      <span class="detail">{m.join.step}</span>
      <h3>{m.join.title}</h3>
      <p class="hint">{m.join.body(money(1000, p.locale))}</p>
      {p.googleOn && <button class="btn secondary wide" onClick={google}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.4z" /><path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A12 12 0 0 0 12 24z" /><path fill="#FBBC05" d="M5.6 14.7a7.2 7.2 0 0 1 0-4.6v-3H1.8a12 12 0 0 0 0 10.7z" /><path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3A12 12 0 0 0 1.8 7.1l3.8 3c.9-2.7 3.4-4.7 6.4-4.7z" /></svg>{m.auth.google}</button>}
      {p.googleOn && <span class="detail" style="text-align:center">{m.auth.or}</span>}
      <input class="field" type="email" autocomplete="email" inputMode="email" placeholder={m.auth.email} value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
      <input class="field" type="password" autocomplete={mode === "have" ? "current-password" : "new-password"} placeholder={m.auth.password} value={password} onInput={(e) => setPassword((e.target as HTMLInputElement).value)} />
      <p class="hint">{m.auth.passwordHint}</p>
      {err && <p class="formerr" role="alert">{err}</p>}
      {info && <p class="note">{info}</p>}
      <button class="btn primary wide" disabled={busy || !ok} onClick={go}>{mode === "have" ? m.auth.signinCta : m.join.cta(p.stakeLabel)}</button>
      <div class="joinlinks"><button class="link" onClick={() => { setMode(mode === "new" ? "have" : "new"); setErr(null); }}>{mode === "new" ? m.join.haveProfile : m.join.newProfile}</button></div>
    </div>
  );
}
