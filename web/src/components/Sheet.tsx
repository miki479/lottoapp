import type { ComponentChildren } from "preact";
import { createPortal } from "preact/compat";
import { useEffect, useRef } from "preact/hooks";

/** Bottom sheet on phones, centred dialog on larger screens. Closes on Escape and on outside tap. */
export function Sheet({ onClose, label, children }: { onClose: () => void; label: string; children: ComponentChildren }) {
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", key);
    // lock the page under the sheet (iOS ignores overflow:hidden on body): freeze it in place and give the scroll position back on close
    const y = scrollY, b = document.body.style, prev = { overflow: b.overflow, position: b.position, top: b.top, width: b.width };
    b.overflow = "hidden"; b.position = "fixed"; b.top = `-${y}px`; b.width = "100%";
    return () => { removeEventListener("keydown", key); b.overflow = prev.overflow; b.position = prev.position; b.top = prev.top; b.width = prev.width; scrollTo(0, y); };
  }, []);
  // Pulling the content down while it is scrolled to the top closes the sheet like the handle does, instead of dragging the page below.
  useEffect(() => {
    const el = sheet.current; if (!el) return;
    let y0 = 0, dy = 0, t0 = 0, pulling = false;
    const start = (e: TouchEvent) => { y0 = e.touches[0]!.clientY; dy = 0; t0 = performance.now(); pulling = false; };
    const move = (e: TouchEvent) => {
      const d = e.touches[0]!.clientY - y0;
      if (!pulling && d > 6 && el.scrollTop <= 0 && !(e.target as HTMLElement).closest("input[type=range], textarea, .leaflet-container")) { pulling = true; y0 = e.touches[0]!.clientY; el.style.transition = "none"; return; }
      if (!pulling) return;
      dy = Math.max(0, e.touches[0]!.clientY - y0); el.style.transform = `translateY(${dy}px)`; e.preventDefault();
    };
    const end = () => {
      if (!pulling) return; pulling = false;
      const fast = dy > 30 && dy / Math.max(1, performance.now() - t0) > 0.6;
      el.style.transition = "transform 220ms var(--ease)";
      if (dy > 90 || fast) { el.style.transform = "translateY(110%)"; setTimeout(onClose, 200); } else el.style.transform = "";
    };
    el.addEventListener("touchstart", start, { passive: true }); el.addEventListener("touchmove", move, { passive: false }); el.addEventListener("touchend", end); el.addEventListener("touchcancel", end);
    return () => { el.removeEventListener("touchstart", start); el.removeEventListener("touchmove", move); el.removeEventListener("touchend", end); el.removeEventListener("touchcancel", end); };
  }, []);
  // Drag the handle down to close: the sheet follows the finger, and a pull of 90 px (or a quick flick) dismisses it.
  const drag = useRef<{ y0: number; t0: number; dy: number } | null>(null);
  const down = (e: PointerEvent) => { drag.current = { y0: e.clientY, t0: performance.now(), dy: 0 }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); if (sheet.current) sheet.current.style.transition = "none"; };
  const move = (e: PointerEvent) => { const d = drag.current; if (!d) return; d.dy = Math.max(0, e.clientY - d.y0); if (sheet.current) sheet.current.style.transform = `translateY(${d.dy}px)`; };
  const up = () => {
    const d = drag.current; drag.current = null; const el = sheet.current; if (!d || !el) return;
    const fast = d.dy > 30 && d.dy / Math.max(1, performance.now() - d.t0) > 0.6;
    el.style.transition = "transform 220ms var(--ease)";
    if (d.dy > 90 || fast) { el.style.transform = "translateY(110%)"; setTimeout(onClose, 200); } else el.style.transform = "";
  };
  // Rendered into <body>: a sheet opened from inside an animated screen would otherwise be positioned relative to that screen, not the window.
  return createPortal(
    <div class="scrim" onClick={onClose}>
      <div class="sheet" ref={sheet} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div class="grab" aria-hidden="true" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
        {children}
      </div>
    </div>,
    document.body,
  );
}
