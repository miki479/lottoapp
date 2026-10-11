import { X } from "lucide-preact";
import { useState } from "preact/hooks";
import type { Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { Sheet } from "./Sheet.tsx";

export function NicknameSheet({ msg, current, onClose, onSaved }: { msg: Messages; current: string | null; onClose: () => void; onSaved: (name: string) => void }) {
  const [name, setName] = useState(current ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true); setErr(null);
    const { data, error } = await sb.rpc("set_nickname", { p_name: name });
    if (error) { const k = ["nickname_not_allowed", "nickname_taken", "bad_nickname", "registration_required"].find((x) => error.message.includes(x)); setErr(msg.errors[k ?? "generic"]!); if (k === "nickname_not_allowed") void sb.rpc("nickname_check", { p_name: name }); /* logs the attempt for the admin */ }
    else onSaved(String(data));
    setBusy(false);
  };
  return (
    <Sheet onClose={onClose} label={msg.profile.nickname.title}>
      <div class="shead"><h2>{msg.profile.nickname.title}</h2><button class="iconbtn" onClick={onClose} aria-label={msg.common.close}><X size={22} /></button></div>
      <div><label class="detail fieldlabel" for="nn">{msg.profile.nickname.label}</label><input id="nn" class="field" value={name} maxLength={24} placeholder={msg.profile.nickname.placeholder} onInput={(e) => setName((e.target as HTMLInputElement).value)} /><p class="hint" style="margin-top:6px">{msg.profile.nickname.rules}</p></div>
      {err && <p class="formerr" role="alert">{err}</p>}
      <button class="btn primary wide" disabled={busy || name.trim().length < 2} onClick={save}>{msg.profile.nickname.save}</button>
    </Sheet>
  );
}
