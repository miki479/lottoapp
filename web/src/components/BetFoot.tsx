import { TriangleAlert } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { money } from "../lib/format.ts";
import { bigStakePct } from "../lib/stake.ts";

/**
 * The foot of a bet sheet, always in view: the error if there is one, then the button that places the bet. A stake above 30% of the balance does not go out on
 * the first tap: the button is replaced by the question ("Stai puntando il 60% del tuo saldo. Confermi?") with its own confirm button and a way back.
 */
export function BetFoot(p: { amount: number; balance: number; label: string; busy: boolean; disabled?: boolean; err: string | null; msg: Messages; locale: Locale; onGo: () => void; reset?: unknown; children?: preact.ComponentChildren }) {
  const pct = bigStakePct(p.amount, p.balance), [sure, setSure] = useState(false), yes = useRef<HTMLButtonElement>(null);
  // changing the stake, the side or the question takes the second question back: it is asked again for what is about to go out
  useEffect(() => { setSure(false); }, [p.amount, p.reset]);
  useEffect(() => { if (sure) yes.current?.focus({ preventScroll: true }); }, [sure]);
  const t = p.msg.sheet;
  return (
    <div class="betfoot">
      {p.children}
      {p.err && <p class="formerr" role="alert">{p.err}</p>}
      {sure && pct !== null ? (
        <div class="bigconfirm" role="group" aria-label={t.bigStake(pct)}>
          <p class="bigq" role="status"><TriangleAlert size={20} aria-hidden="true" />{t.bigStake(pct)}</p>
          <button ref={yes} class="btn primary wide" disabled={p.busy} aria-busy={p.busy} onClick={p.onGo}>{p.busy ? t.confirming : t.bigYes(money(p.amount, p.locale))}</button>
          <button class="btn secondary wide" disabled={p.busy} onClick={() => setSure(false)}>{t.bigNo}</button>
        </div>
      ) : (
        <button class="btn primary wide" disabled={p.busy || p.disabled} aria-busy={p.busy} onClick={pct !== null ? () => setSure(true) : p.onGo}>{p.busy ? t.confirming : p.label}</button>
      )}
    </div>
  );
}
