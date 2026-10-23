import { Check, ListChecks } from "lucide-preact";
import type { Locale, Messages } from "../i18n/index.ts";
import { money } from "../lib/format.ts";
import { netOf } from "../lib/stake.ts";
import type { MyBet } from "../lib/types.ts";
import { Sheet } from "./Sheet.tsx";

/** Four or more results waiting: one summary instead of a sheet for each, with a way to go through them or to mark them all as seen. */
export function ResultsDigest({ bets, msg, locale, onOne, onAll }: { bets: readonly MyBet[]; msg: Messages; locale: Locale; onOne: () => void; onAll: () => void }) {
  const t = msg.result.digest;
  const won = bets.filter((b) => b.status === "won").length, lost = bets.filter((b) => b.status === "lost").length, voided = bets.length - won - lost;
  const net = bets.reduce((a, b) => a + (b.status === "void" ? 0 : netOf(b)), 0);
  return (
    <Sheet onClose={onAll} label={t.title(bets.length)}>
      <div class="shead"><h2>{t.title(bets.length)}</h2></div>
      <div class="digest">
        <div class="digrow"><span class="num gain">{won}</span><small>{t.won}</small></div>
        <div class="digrow"><span class="num loss">{lost}</span><small>{t.lost}</small></div>
        {voided > 0 && <div class="digrow"><span class="num">{voided}</span><small>{t.void}</small></div>}
      </div>
      <p class="dignet"><small>{t.net}</small><b class={`num ${net >= 0 ? "gain" : "loss"}`}>{net > 0 ? "+" : ""}{money(net, locale)}</b></p>
      <button class="btn secondary wide" onClick={onOne}><ListChecks size={18} />{t.one}</button>
      <button class="btn primary wide" onClick={onAll}><Check size={18} />{t.all}</button>
    </Sheet>
  );
}
