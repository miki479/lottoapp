import { useEffect, useRef, useState } from "preact/hooks";

export const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Animates a number towards its new value (wallet, payouts). */
export function useCountUp(target: number, ms = 700): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reducedMotion() || from.current === target) { setShown(target); from.current = target; return; }
    const start = performance.now(), a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (target - a) * e));
      if (p < 1) raf = requestAnimationFrame(step); else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}

const COLORS = ["#f0ff3a", "#2ef5b4", "#ff4d62", "#ff2d95", "#35d0ff", "#ffb020"];
/** Fire-and-forget confetti burst from a point (defaults to the middle of the screen). */
export function confetti(x = innerWidth / 2, y = innerHeight / 2, n = 36) {
  if (reducedMotion()) return;
  const host = document.createElement("div");
  host.className = "confetti";
  for (let i = 0; i < n; i++) {
    const s = document.createElement("i");
    const ang = Math.random() * Math.PI * 2, dist = 80 + Math.random() * 180;
    s.style.cssText = `left:${x}px;top:${y}px;background:${COLORS[i % COLORS.length]};--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist - 120}px;--r:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * 80}ms`;
    host.appendChild(s);
  }
  document.body.appendChild(host);
  setTimeout(() => host.remove(), 1700);
}
