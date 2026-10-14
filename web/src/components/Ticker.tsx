import type { ComponentChildren } from "preact";

/** Thin scrolling strip under the top bar: what the lines and markets are doing and a few things other players did. Pauses on touch/hover. */
export function Ticker({ items, label }: { items: { id: string; node: ComponentChildren }[]; label: string }) {
  if (items.length === 0) return null;
  // a strip of one line stands still: starting over would put the same sentence twice in a row
  if (items.length === 1) return <div class="ticker still" role="status" aria-label={label}><span class="tk">{items[0]!.node}</span></div>;
  // enough copies for each half to be wider than a phone, so the strip never shows a gap before the first item comes back from the right
  const reps = Math.max(1, Math.ceil(10 / items.length)), half = Array.from({ length: reps }, () => items).flat(), run = [...half, ...half];
  return (
    <div class="ticker" aria-label={label}>
      <div class="track" style={`animation-duration:${Math.max(40, half.length * 7)}s`}>
        {run.map((it, i) => <span class="tk" key={`${it.id}-${i}`} aria-hidden={i >= items.length}>{it.node}</span>)}
      </div>
    </div>
  );
}
