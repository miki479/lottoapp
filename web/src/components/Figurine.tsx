import { HelpCircle } from "lucide-preact";
import type { ComponentChildren } from "preact";
import type { CardCat, CardDef } from "../../../shared/cards.ts";
import { CARD_ICONS } from "./cardIcons.ts";
import "./RewardsHub.css";

/** Our own simple backdrop for each category: flat shapes in the category colour, nothing borrowed from anywhere. */
function Backdrop({ cat }: { cat: CardCat }) {
  const g = (children: ComponentChildren) => <svg class="fgart" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">{children}</svg>;
  switch (cat) {
    case "transport": return g(<><path d="M-10 118 L110 84" /><path d="M-10 132 L110 98" /><path d="M-10 146 L110 112" />{[8, 24, 40, 56, 72, 88].map((x) => <path key={x} d={`M${x} ${126 - x * 0.28} l6 -14`} class="th" />)}<circle cx="82" cy="26" r="16" class="fl" /></>);
    case "weather": return g(<><circle cx="30" cy="40" r="16" class="fl" /><circle cx="50" cy="32" r="20" class="fl" /><circle cx="72" cy="42" r="15" class="fl" />{[14, 34, 54, 74, 90].map((x, i) => <path key={x} d={`M${x} ${88 + (i % 2) * 8} l-5 14`} class="th" />)}</>);
    case "nature": return g(<><path d="M-4 140 L34 70 L58 108 L76 82 L106 140 Z" class="fl" /><path d="M-4 140 L22 96 L44 140 Z" class="fl2" /><circle cx="80" cy="26" r="11" class="fl" /></>);
    case "sport": return g(<><circle cx="50" cy="70" r="26" class="st" /><path d="M-4 70 H104" class="st" /><circle cx="50" cy="70" r="3" class="fl" /><path d="M-4 20 h24 v24 M104 20 h-24 v24 M-4 120 h24 v-24 M104 120 h-24 v-24" class="st" /></>);
    case "games": return g(<>{Array.from({ length: 28 }, (_, i) => { const x = (i % 7) * 16 - 4, y = Math.floor(i / 7) * 36 - 4; return (i + Math.floor(i / 7)) % 2 ? <rect key={i} x={x} y={y} width="16" height="16" rx="3" class="fl" /> : null; })}</>);
    case "finance": return g(<>{[0, 1, 2, 3, 4].map((i) => <rect key={i} x={6 + i * 19} y={118 - 12 - i * 13} width="14" height={22 + i * 13} rx="2" class="fl" />)}<path d="M6 60 L30 46 L52 54 L96 18" class="st" /></>);
    case "culture": return g(<>{[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M-4 ${40 + i * 10} q 26 -12 52 0 t 56 0`} class="st" />)}<circle cx="70" cy="104" r="9" class="fl" /><path d="M79 104 V80" class="st" /></>);
    case "law": return g(<><path d="M12 112 H88 M16 118 H84" class="st" />{[22, 40, 58, 76].map((x) => <rect key={x} x={x - 5} y="50" width="10" height="58" rx="2" class="fl" />)}<path d="M8 50 L50 26 L92 50 Z" class="fl2" /></>);
  }
}

/**
 * One figurine card: category colour and icon on a flat backdrop, the number in a corner, the name at the bottom.
 * A card that is not owned is a dark silhouette with a question mark. Sizes follow the box it is placed in.
 */
export function Figurine({ card, name, numText, owned = true, big = false }: { card: CardDef; name: string; numText: string; owned?: boolean; big?: boolean }) {
  const Icon = CARD_ICONS[card.icon] ?? HelpCircle;
  return (
    <div class={`fig fc-${card.cat} fr-${card.rarity} ${owned ? "" : "miss"} ${big ? "big" : ""}`} role="img" aria-label={owned ? `${numText}: ${name}` : numText}>
      <Backdrop cat={card.cat} />
      <span class="fgn num">{card.n}</span>
      <span class="fgico">{owned ? <Icon strokeWidth={1.8} /> : <HelpCircle strokeWidth={1.6} />}</span>
      {owned && <span class="fgname">{name}</span>}
      <i class="fgshine" aria-hidden="true" />
    </div>
  );
}
