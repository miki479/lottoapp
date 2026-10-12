import type { ComponentChildren } from "preact";
import { createPortal } from "preact/compat";
import { useEffect, useRef } from "preact/hooks";

/** Bottom sheet on phones, centred dialog on larger screens. Closes on Escape and on outside tap. */
export function Sheet({ onClose, label, children }: { onClose: () => void; label: string; children: ComponentChildren }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", key); document.body.style.overflow = ""; };
  }, []);
  // Drag the handle down to close: the sheet follows the finger, and a pull of 90 px (or a quick flick) dismisses it.
  const sheet = useRef<HTMLDivElement>(null);
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
        <div class="grab" role="button" aria-label="Close" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
        {children}
      </div>
    </div>,
    document.body,
  );
}
