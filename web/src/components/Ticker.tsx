import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { reducedMotion } from "../lib/anim.ts";

/** How long each line stays, in ms: long enough to read it whole (about 3 words a second), never less than four seconds. */
const dwell = (text: string) => Math.min(9000, Math.max(4000, 1800 + text.length * 90));

/**
 * One line at a time under the top bar: what the lines and the markets are doing and a few things other players did. Every line is shown whole, on its
 * own, then the next one fades in (nothing scrolls past the edge with its head cut off). It stops while a finger or the pointer is on it, and people who ask
 * for less motion get the same lines without the fade. The same strip sits under the top bar on every screen.
 */
export function Ticker({ items, label }: { items: { id: string; text?: string; node: ComponentChildren }[]; label: string }) {
  const [i, setI] = useState(0), [hold, setHold] = useState(false);
  const n = items.length, cur = items[n ? i % n : 0];
  const box = useRef<HTMLDivElement>(null), line = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);
  // A line wider than the strip stays on one row and glides sideways to its end (never wraps, never cut for good).
  useEffect(() => {
    const over = line.current && box.current ? Math.ceil(line.current.scrollWidth - box.current.clientWidth + 8) : 0;
    setShift(over > 0 ? over : 0);
  }, [cur?.id]);
  const glide = shift > 0 && !reducedMotion() ? Math.round(shift / 40 * 1000) : 0;
  useEffect(() => {
    if (n < 2 || hold) return;
    const t = window.setTimeout(() => setI((k) => (k + 1) % n), dwell(cur?.text ?? "") + glide);
    return () => window.clearTimeout(t);
  }, [i, n, hold, cur?.id, glide]);
  if (n === 0 || !cur) return null;
  return (
    <div ref={box} class={`ticker ${n > 1 ? "rot" : "still"}`} role="status" aria-label={label} onPointerEnter={() => setHold(true)} onPointerLeave={() => setHold(false)} onTouchStart={() => setHold(true)} onTouchEnd={() => setHold(false)}>
      <span ref={line} class={`tk ${reducedMotion() ? "" : "fade"} ${glide ? "glide" : ""}`} key={cur.id} style={glide ? `--shift:-${shift}px;--glide:${glide}ms` : undefined}>{cur.node}</span>
    </div>
  );
}
