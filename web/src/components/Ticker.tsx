import type { ComponentChildren } from "preact";

/** Thin scrolling strip under the top bar: what other players just did and the latest results. Pauses on touch/hover. */
export function Ticker({ items }: { items: { id: string; node: ComponentChildren }[] }) {
  if (items.length === 0) return null;
  // enough copies for each half to be wider than a phone, so the strip never shows a gap before the first item comes back from the right
  const reps = Math.max(1, Math.ceil(10 / items.length)), half = Array.from({ length: reps }, () => items).flat(), run = [...half, ...half];
  return (
    <div class="ticker" aria-label="Live activity">
      <div class="track" style={`animation-duration:${Math.max(40, half.length * 7)}s`}>
        {run.map((it, i) => <span class="tk" key={`${it.id}-${i}`} aria-hidden={i >= items.length}>{it.node}</span>)}
      </div>
    </div>
  );
}
