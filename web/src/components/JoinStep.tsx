import { ArrowLeft, X } from "lucide-preact";
import type { Locale, Messages } from "../i18n/index.ts";
import { JoinForm } from "./JoinForm.tsx";
import { Sheet } from "./Sheet.tsx";

/** Shown after tapping the bet button as a guest: the sign-up is its own step, then the bet goes through. */
export function JoinStep(p: { msg: Messages; locale: Locale; googleOn: boolean; stakeLabel: string; onBack: () => void; onClose: () => void; onJoined: () => Promise<void> }) {
  return (
    <Sheet onClose={p.onClose} label={p.msg.join.step}>
      <div class="shead"><button class="iconbtn" onClick={p.onBack} aria-label={p.msg.common.cancel}><ArrowLeft size={22} /></button><span class="grow" /><button class="iconbtn" onClick={p.onClose} aria-label={p.msg.common.close}><X size={22} /></button></div>
      <JoinForm msg={p.msg} locale={p.locale} googleOn={p.googleOn} stakeLabel={p.stakeLabel} onJoined={p.onJoined} />
    </Sheet>
  );
}
