import type { ComponentChildren } from "preact";

/**
 * Strip under the top bar that keeps moving from right to left: what the lines and the markets are doing and a few things other players did.
 * Every line is one unbroken row; and it stops while a finger or the pointer is on it.
 * People who ask for less motion get the same lines in a strip they can scroll by hand.
 */
export function Ticker({ items, label }: { items: { id: string; text?: string; node: ComponentChildren }[]; label: string }) {
  if (items.length === 0) return null;
  // enough copies for each half to be wider than a phone, so the strip never shows a gap before the first item comes back from the right
  const reps = Math.max(1, Math.ceil(10 / items.length)), half = Array.from({ length: reps }, () => items).flat(), run = [...half, ...half];
  return (
    <div class="ticker" role="status" aria-label={label}>
      <div class="track" style={`animation-duration:${Math.max(48, half.length * 8)}s`}>
        {run.map((it, i) => <span class="tk" key={`${it.id}-${i}`} aria-hidden={i >= half.length}>{it.node}</span>)}
      </div>
    </div>
  );
}
