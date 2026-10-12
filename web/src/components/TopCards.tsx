import type { LucideIcon } from "lucide-preact";
import type { ComponentChildren } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";

export interface TopItem { mid?: string; id: string; icon: LucideIcon; label: string; big: ComponentChildren; sub: string; extra?: ComponentChildren; onClick: () => void }

/** "Featured": the most delayed now, the most played, the most delayed city, what closes next. */
export function TopCards({ items, lead }: { items: TopItem[]; lead?: ComponentChildren }) {
  // New cards arrive while the data loads; the browser would keep the card it had snapped to and slide the row away from the start. Until the player touches the row, keep it at the start.
  const row = useRef<HTMLDivElement>(null), touched = useRef(false);
  useLayoutEffect(() => { if (!touched.current && row.current && row.current.scrollLeft !== 0) row.current.scrollLeft = 0; });
  const touch = () => { touched.current = true; };
  return (
    <div class="top-scroll" ref={row} onPointerDown={touch} onWheel={touch} onTouchStart={touch}>
      {lead}
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
