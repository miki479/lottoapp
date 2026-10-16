import { Coins, Gift, Sparkles } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { Sheet } from "./Sheet.tsx";
import { useCountUp } from "../lib/anim.ts";
import { haptic } from "../lib/haptics.ts";
import { money } from "../lib/format.ts";
import type { Locale, Messages } from "../i18n/index.ts";

/** The daily chest: a box shows up, shakes, opens, the gifts come out of it, and one button says "collect". The server pays when the button is pressed (onCollect). */
export function ChestScene(p: { msg: Messages; locale: Locale; reward: number; onCollect: () => Promise<void>; onClose: () => void }) {
  const t = p.msg.dm, [stage, setStage] = useState<"shake" | "open">("shake"), [busy, setBusy] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => { setStage("open"); haptic.success(); }, 1100);
    return () => clearTimeout(a);
  }, []);
  const shown = useCountUp(stage === "open" ? p.reward : 0, 900);
  const collect = async () => { if (busy) return; setBusy(true); try { await p.onCollect(); } finally { setBusy(false); p.onClose(); } };
  return (
    <Sheet onClose={p.onClose} label={t.chest}>
      <div class={`chestscene ${stage}`}>
        <div class="chestglow" aria-hidden="true" />
        <div class="chestbox" aria-hidden="true">
          <div class="chestlid"><span /></div>
          <div class="chestbody"><i /></div>
          <div class="chestgifts">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => <b key={i} style={`--i:${i}`}>{i % 3 === 0 ? <Coins size={26} /> : i % 3 === 1 ? <Gift size={24} /> : <Sparkles size={22} />}</b>)}
          </div>
        </div>
        <div class="chestprize" aria-live="polite"><span class="detail">{t.chest}</span><b class="num">{money(shown, p.locale)}</b></div>
        <button class="btn primary wide" disabled={stage !== "open" || busy} aria-busy={busy} onClick={collect}>{t.collect}</button>
      </div>
    </Sheet>
  );
}
