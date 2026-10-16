import { useEffect, useRef } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { reducedMotion } from "../lib/anim.ts";
import { BrandMark } from "./Header.tsx";
import "./Pack3D.css";

/**
 * A card with real thickness that can be turned on every side: drag (or swipe) to spin it, let go and it keeps turning for a moment,
 * then it settles into a slow sway. The light sweeping over the front follows the angle. Rare cards add sparks around them.
 */
export function Card3D({ front, rarity, spin = true }: { front: ComponentChildren; rarity: "common" | "rare" | "epic" | "legendary"; spin?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const st = useRef({ x: -8, y: spin ? -540 : -12, vx: 0, vy: spin ? 22 : 0, drag: false, lx: 0, ly: 0, idle: 0 });
  useEffect(() => {
    const el = root.current; if (!el) return;
    if (reducedMotion()) { st.current.y = 0; st.current.x = 0; st.current.vy = 0; }
    let raf = 0, t0 = performance.now();
    const paint = () => {
      const s = st.current, t = (performance.now() - t0) / 1000;
      if (!s.drag) {
        if (reducedMotion()) { /* still */ }
        else if (Math.abs(s.vx) + Math.abs(s.vy) > 0.05) { s.x += s.vx; s.y += s.vy; s.vx *= 0.955; s.vy *= 0.955; s.idle = t; if (spin && s.y < -12 && s.vy > 0 && s.vy < 2.2 && s.y < -300) s.vy = Math.max(s.vy, 2.2); }
        else { const k = Math.min(1, (t - s.idle) / 1.5); s.x += (Math.sin(t * 0.7) * 6 - 6 - s.x) * 0.04 * k; s.y += ((Math.round(s.y / 360) * 360 + Math.sin(t * 0.9) * 16) - s.y) * 0.04 * k; }
      }
      const a = ((s.y % 360) + 360) % 360;
      el.style.setProperty("--ry", `${s.y}deg`); el.style.setProperty("--rx", `${s.x}deg`);
      el.style.setProperty("--glare", `${Math.round(50 + Math.sin((s.y * Math.PI) / 180) * 45)}%`);
      el.style.setProperty("--glare2", `${Math.round(50 + Math.sin((s.x * Math.PI) / 180) * 45)}%`);
      el.dataset.side = a > 90 && a < 270 ? "back" : "front";
      raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
  }, []);
  const down = (e: PointerEvent) => { const s = st.current; s.drag = true; s.lx = e.clientX; s.ly = e.clientY; s.vx = 0; s.vy = 0; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); };
  const move = (e: PointerEvent) => { const s = st.current; if (!s.drag) return; const dx = e.clientX - s.lx, dy = e.clientY - s.ly; s.lx = e.clientX; s.ly = e.clientY; s.y += dx * 0.7; s.x -= dy * 0.7; s.vy = dx * 0.7; s.vx = -dy * 0.7; };
  const up = () => { st.current.drag = false; };
  return (
    <div class={`c3 c3-${rarity}`} ref={root} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="group">
      {rarity !== "common" && <span class="c3sparks" aria-hidden="true">{Array.from({ length: rarity === "legendary" ? 14 : 8 }, (_, i) => <i key={i} style={`--i:${i};--a:${(i * 137) % 360}deg;--r:${90 + ((i * 53) % 50)}px;--d:${(i % 5) * 0.5}s`} />)}</span>}
      <div class="c3body">
        {[1, 2, 3, 4, 5].map((z) => <i key={z} class="c3edge" style={`--z:${-z * 1.4}px`} aria-hidden="true" />)}
        <div class="c3face c3front">{front}<i class="c3glare" aria-hidden="true" /><i class="c3holo" aria-hidden="true" /></div>
        <div class="c3face c3back" aria-hidden="true"><i class="c3backpat" /><span class="c3logo"><BrandMark /></span><b>LateBET</b><i class="c3glare" /></div>
      </div>
    </div>
  );
}
