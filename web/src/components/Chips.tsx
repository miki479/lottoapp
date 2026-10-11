import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";

export interface Chip<T extends string> { id: T; label: ComponentChildren; icon?: string; count?: number; disabled?: boolean }

/** Chip row with a highlight pill that slides to the selected chip. */
export function Chips<T extends string>({ chips, value, onPick, small }: { chips: Chip<T>[]; value: T; onPick: (id: T) => void; small?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ x: 0, w: 0, ready: false });
  const measure = () => {
    const el = host.current?.querySelector<HTMLElement>(`[data-id="${value}"]`);
    if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth, ready: true });
  };
  useLayoutEffect(measure, [value, chips.map((c) => c.id).join(), chips.map((c) => c.count).join()]);
  useEffect(() => { addEventListener("resize", measure); return () => removeEventListener("resize", measure); }, [value]);
  useEffect(() => { host.current?.querySelector<HTMLElement>(`[data-id="${value}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }, [value]);
  return (
    <div class={`chips ${small ? "small" : ""}`} ref={host} role="tablist">
      <span class="pill" style={`transform:translateX(${pill.x}px);width:${pill.w}px;opacity:${pill.ready ? 1 : 0}`} />
      {chips.map((c) => (
        <button key={c.id} data-id={c.id} role="tab" aria-selected={value === c.id} disabled={c.disabled} class={value === c.id ? "on" : ""} onClick={() => onPick(c.id)}>
          {c.icon && <i class="ci" key={value === c.id ? "on" : "off"}>{c.icon}</i>}
          <span>{c.label}</span>
          {c.count !== undefined && c.count > 0 && <em key={c.count}>{c.count}</em>}
        </button>
      ))}
    </div>
  );
}
