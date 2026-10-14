import type { LucideIcon } from "lucide-preact";
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { clip } from "../lib/format.ts";

export interface TopItem { cls?: string; mid?: string; id: string; icon: LucideIcon; label: string; big: ComponentChildren; sub: string; extra?: ComponentChildren; onClick: () => void }

/** Pixels per frame of the slow drift (about 20 px a second) and how long the row waits after a touch before it moves again. */
const DRIFT = 0.34, IDLE_MS = 5000;

/**
 * "Featured": the most delayed now, the most played, the most delayed city, what closes next.
 * On phones and tablets the row drifts slowly and loops, so everything gets shown; it stops while a finger or the mouse is on it, waits a few seconds
 * after the last touch, and stays still for people who asked for less motion.
 */
export function TopCards({ items }: { items: TopItem[] }) {
  const row = useRef<HTMLDivElement>(null), hold = useRef(0), seen = useRef(true);
  useEffect(() => {
    const el = row.current;
    if (!el || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    const io = typeof IntersectionObserver === "function" ? new IntersectionObserver(([e]) => { seen.current = !!e?.isIntersecting; }) : null;
    io?.observe(el);
    let raf = 0, pos = el.scrollLeft;
    const step = () => {
      raf = requestAnimationFrame(step);
      if (!seen.current || document.hidden || performance.now() < hold.current || getComputedStyle(el).flexDirection !== "row") { pos = el.scrollLeft; return; }
      // the copy only exists while the row really scrolls: when everything fits there is nothing to loop and nothing is duplicated
      if (!el.classList.contains("looping")) { if (el.scrollWidth > el.clientWidth + 2) el.classList.add("looping"); return; }
      const dup = el.querySelector<HTMLElement>(".top-dup"), first = el.firstElementChild as HTMLElement | null;
      if (!dup || !first) return;
      const loop = dup.offsetLeft + (parseFloat(getComputedStyle(el).columnGap) || 0) - first.offsetLeft;
      if (loop <= el.clientWidth) { el.classList.remove("looping"); return; }
      pos += DRIFT;
      if (pos >= loop) pos -= loop;
      el.scrollLeft = pos;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); io?.disconnect(); el.classList.remove("looping"); };
  }, [items.length]);
  const pause = (ms = IDLE_MS) => { hold.current = performance.now() + ms; };
  const cards = (copy: boolean) => (
    <>
      {copy ? <span class="top-dup" aria-hidden="true" /> : null}
      {items.map((it, i) => {
        const Icon = it.icon;
        return (
          <button key={(copy ? "d" : "") + it.id} tabIndex={copy ? -1 : undefined} aria-hidden={copy ? "true" : undefined} class={`card pressable topcard c${i % 4} ${it.cls ?? ""}`} style={copy ? undefined : `animation: rise var(--dur) var(--ease) ${i * 40}ms both`} onClick={it.onClick}>
            <span class="head"><Icon size={16} /><span class="detail">{it.label}</span></span>
            <span class="big">{it.big}</span>
            {it.extra}
            <span class="sub">{clip(it.sub, 96)}</span>
          </button>
        );
      })}
    </>
  );
  return (
    <div class="top-scroll" ref={row} onPointerDown={() => pause(60_000)} onPointerUp={() => pause()} onPointerCancel={() => pause()} onTouchStart={() => pause(60_000)} onTouchEnd={() => pause()} onWheel={() => pause()} onMouseEnter={() => pause(60_000)} onMouseLeave={() => pause()}>
      {cards(false)}
      {cards(true)}
    </div>
  );
}
