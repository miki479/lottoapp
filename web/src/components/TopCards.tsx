import type { LucideIcon } from "lucide-preact";
import type { ComponentChildren } from "preact";

export interface TopItem { mid?: string; id: string; icon: LucideIcon; label: string; big: ComponentChildren; sub: string; extra?: ComponentChildren; onClick: () => void }

/** "Featured": the most delayed now, the most played, the most delayed city, what closes next. */
export function TopCards({ items }: { items: TopItem[] }) {
  return (
    <div class="top-scroll">
      {items.map((it, i) => {
        const Icon = it.icon;
        return (
          <button key={it.id} class={`card pressable topcard c${i % 4}`} style={`animation: rise var(--dur) var(--ease) ${i * 40}ms both`} onClick={it.onClick}>
            <span class="head"><Icon size={16} /><span class="detail">{it.label}</span></span>
            <span class="big">{it.big}</span>
            {it.extra}
            <span class="sub">{it.sub}</span>
          </button>
        );
      })}
    </div>
  );
}
