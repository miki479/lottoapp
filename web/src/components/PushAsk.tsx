import { Bell, X } from "lucide-preact";
import type { Messages } from "../i18n/index.ts";

/** One quiet question after the first bet. Shown once; the answer is remembered. */
export function PushAsk({ msg, onYes, onNo }: { msg: Messages; onYes: () => void; onNo: () => void }) {
  return (
    <div class="pushask" role="dialog" aria-label={msg.push.askTitle}>
      <span class="pi"><Bell size={20} /></span>
      <div class="pt"><b>{msg.push.askTitle}</b><span>{msg.push.askBody}</span></div>
      <div class="pb"><button class="btn primary" onClick={onYes}>{msg.push.yes}</button><button class="btn secondary" onClick={onNo}><X size={16} />{msg.push.later}</button></div>
    </div>
  );
}
