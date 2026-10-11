import { ChevronUp, Layers } from "lucide-preact";
import type { Locale, Messages } from "../i18n/index.ts";
import { fmtOdds } from "../lib/format.ts";

/** Sticky bar above the tab bar: how many picks are in the parlay and the combined odds. Tap to open it. */
export function ParlayBar({ count, odds, msg, locale, onOpen }: { count: number; odds: number; msg: Messages; locale: Locale; onOpen: () => void }) {
  if (count === 0) return null;
  return (
    <button class="parlaybar" onClick={onOpen} aria-label={msg.slip.title}>
      <span class="pl"><Layers size={20} /><b>{msg.slip.title}</b></span>
      <span class="pc">{msg.slip.bar(count)}</span>
      <span class="po num" key={odds}>{fmtOdds(odds, locale)}×</span>
      <ChevronUp size={20} />
    </button>
  );
}
