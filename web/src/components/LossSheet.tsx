import { Gift, Share2, X } from "lucide-preact";
import { Sheet } from "./Sheet.tsx";
import { money } from "../lib/format.ts";
import type { Locale, Messages } from "../i18n/index.ts";

/** Shown when the balance drops under 1000 after a loss: a friendly way to get back on top (invite a friend: 1500 for each friend who plays), never a push to bet more. */
export function LossSheet(p: { msg: Messages; locale: Locale; credits: number; canShare: boolean; onShare: () => void; onAuth: () => void; onClose: () => void }) {
  const t = p.msg.loss;
  return (
    <Sheet onClose={p.onClose} label={t.title}>
      <div class="losssheet">
        <span class="lossico" aria-hidden="true"><Gift size={30} /></span>
        <h2>{t.title}</h2>
        <p class="hint">{t.body(money(Math.max(0, p.credits), p.locale), money(1500, p.locale))}</p>
        <button class="btn primary wide" onClick={() => { if (p.canShare) p.onShare(); else p.onAuth(); }}><Share2 size={18} />{p.canShare ? t.share : t.signup}</button>
        <button class="btn secondary wide" onClick={p.onClose} aria-label={t.later} title={t.later}><X size={18} /></button>
      </div>
    </Sheet>
  );
}
