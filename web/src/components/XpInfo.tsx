import { X } from "lucide-preact";
import type { Messages } from "../i18n/index.ts";
import { Sheet } from "./Sheet.tsx";

/** How experience is earned, in plain words. */
export function XpInfo({ msg, onClose }: { msg: Messages; onClose: () => void }) {
  const t = msg.look;
  return (
    <Sheet onClose={onClose} label={t.xpHow}>
      <div class="shead"><h2>{t.xpHow}</h2><button class="iconbtn" onClick={onClose} aria-label={msg.common.close}><X size={22} /></button></div>
      <p class="hint">{t.xpIntro}</p>
      <ul class="xplist">{t.xpRows.map((r) => <li key={r}>{r}</li>)}</ul>
      <p class="hint">{t.xpNote}</p>
    </Sheet>
  );
}
