import type { ComponentChildren } from "preact";

/** Thin scrolling strip under the top bar: what other players just did and the latest results. Pauses on touch/hover. */
export function Ticker({ items }: { items: { id: string; node: ComponentChildren }[] }) {
  if (items.length === 0) return null;
  const run = [...items, ...items];
  return (
    <div class="ticker" aria-label="Live activity">
      <div class="track" style={`animation-duration:${Math.max(30, items.length * 7)}s`}>
        {run.map((it, i) => <span class="tk" key={`${it.id}-${i}`} aria-hidden={i >= items.length}>{it.node}</span>)}
      </div>
    </div>
  );
}
