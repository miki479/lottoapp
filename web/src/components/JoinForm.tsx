import { useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { money } from "../lib/format.ts";
import { authError } from "./AuthSheet.tsx";

/** E-mail used behind a nickname-only profile. It never receives mail: the nickname is the login. */
export const nickEmail = (nick: string) => `${nick.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") || "player"}@players.latelotto.app`;

/**
 * "Last step" of a bet for a guest: pick a nickname + password (or sign in), then the bet goes through.
 * With e-mail confirmation turned on (no nickname-only accounts) it falls back to e-mail + password.
 */
export function JoinForm(p: { msg: Messages; locale: Locale; quick: boolean; stakeLabel: string; onJoined: () => Promise<void> }) {
  const [mode, setMode] = useState<"new" | "have">("new");
  const [viaEmail, setViaEmail] = useState(!p.quick);
  const [nick, setNick] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const m = p.msg;
  const id = viaEmail ? email.trim() : nickEmail(nick);
  const ok = password.length >= 8 && (viaEmail ? /.+@.+\..+/.test(email) : nick.trim().length >= 2);

  const go = async () => {
    setBusy(true); setErr(null); setInfo(null);
    try {
      if (mode === "have") {
        const { error } = await sb.auth.signInWithPassword({ email: id, password });
        if (error) { setErr(authError(error, m)); return; }
        await p.onJoined(); return;
      }
      if (!viaEmail) {
        const { data: check } = await sb.rpc("nickname_check", { p_name: nick });
        if (check && check !== "ok") { setErr(m.errors[check as string] ?? m.errors.generic!); return; }
      }
      const { data, error } = await sb.auth.updateUser({ email: id, password });
      if (error) { setErr(authError(error, m)); return; }
      if (!data.user || data.user.is_anonymous || !data.user.email) { setInfo(m.join.checkMail); return; }
      if (!viaEmail) { const r = await sb.rpc("set_nickname", { p_name: nick }); if (r.error) { setErr(m.errors[Object.keys(m.errors).find((k) => r.error!.message.includes(k)) ?? "generic"]!); return; } }
      await p.onJoined();
    } finally { setBusy(false); }
  };
  return (
    <div class="joinform">
      <span class="detail">{m.join.step}</span>
      <h3>{m.join.title}</h3>
      <p class="hint">{m.join.body(money(1000, p.locale))}</p>
      {viaEmail
        ? <input class="field" type="email" autocomplete="email" inputMode="email" placeholder="email" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
        : <input class="field" type="text" autocomplete="username" maxLength={24} placeholder={m.join.nickname} value={nick} onInput={(e) => setNick((e.target as HTMLInputElement).value)} />}
      <input class="field" type="password" autocomplete={mode === "have" ? "current-password" : "new-password"} placeholder={m.join.password} value={password} onInput={(e) => setPassword((e.target as HTMLInputElement).value)} />
      <p class="hint">{m.join.hint}</p>
      {err && <p class="formerr" role="alert">{err}</p>}
      {info && <p class="note">{info}</p>}
      <button class="btn primary wide" disabled={busy || !ok} onClick={go}>{mode === "have" ? m.auth.signinCta : m.join.cta(p.stakeLabel)}</button>
      <div class="joinlinks">
        <button class="link" onClick={() => { setMode(mode === "new" ? "have" : "new"); setErr(null); }}>{mode === "new" ? m.join.haveProfile : m.join.newProfile}</button>
        {p.quick && <button class="link" onClick={() => setViaEmail(!viaEmail)}>{viaEmail ? m.join.nickname : m.join.emailInstead}</button>}
      </div>
    </div>
  );
}
