import { useEffect, useRef, useState } from "preact/hooks";

export const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Animates a number towards its new value (wallet, payouts). */
export function useCountUp(target: number, ms = 700): number {
  const [shown, setShown] = useState(target);
  const cur = useRef(target);   // what is on screen right now, so a change in mid-flight continues from there (no jump back)
  useEffect(() => {
    if (reducedMotion() || cur.current === target) { cur.current = target; setShown(target); return; }
    const start = performance.now(), a = cur.current;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / ms), e = 1 - Math.pow(1 - p, 3);
      cur.current = Math.round(a + (target - a) * e);
      setShown(cur.current);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}
