import { Flag } from "lucide-preact";
import { useState } from "preact/hooks";
import type { Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";

type Kind = "wrong_data" | "wrong_result" | "other";

/** "Report a problem" for one market: a kind, an optional note, one tap to send. */
export function ReportLink({ marketId, msg }: { marketId: string; msg: Messages }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("wrong_data");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "err">("idle");
  const send = async () => {
    setState("busy");
    const { error } = await sb.rpc("report_market", { p_market: marketId, p_kind: kind, p_note: note.trim() });
    setState(error ? "err" : "sent");
  };
  if (state === "sent") return <p class="hint report-done">{msg.report.sent}</p>;
  if (!open) return <button class="reportlink" onClick={() => setOpen(true)}><Flag size={14} />{msg.report.link}</button>;
  return (
    <div class="reportbox">
      <b>{msg.report.title}</b>
      <div class="seg" role="radiogroup">{(["wrong_data", "wrong_result", "other"] as const).map((k) => <button key={k} class={k === kind ? "on" : ""} aria-pressed={k === kind} onClick={() => setKind(k)}>{msg.report.kinds[k]}</button>)}</div>
      <input class="field" maxLength={300} value={note} placeholder={msg.report.notePh} onInput={(e) => setNote((e.target as HTMLInputElement).value.replace(/[<>]/g, ""))} />
      {state === "err" && <p class="formerr" role="alert">{msg.errors.generic}</p>}
      <button class="btn secondary wide" disabled={state === "busy"} onClick={send}>{msg.report.send}</button>
    </div>
  );
}
