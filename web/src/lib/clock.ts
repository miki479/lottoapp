import { useEffect, useState } from "preact/hooks";

// One shared interval for every clock on screen: cheap, and they all tick in sync. A subscriber says how often it wants to be woken:
// the whole app only needs the time every few seconds, a countdown showing seconds wakes just its own little component every second.
const subs = new Map<(t: number) => void, { step: number; last: number }>();
let timer: ReturnType<typeof setInterval> | null = null;
function ensure() {
  if (timer) return;
  timer = setInterval(() => { const t = Date.now(); subs.forEach((s, f) => { if (t - s.last >= s.step - 50) { s.last = t; f(t); } }); }, 1000);
}

/** Current time in ms, re-rendering the caller every `stepMs` (default every second). */
export function useNow(stepMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    subs.set(setNow, { step: stepMs, last: Date.now() }); ensure();
    return () => { subs.delete(setNow); if (subs.size === 0 && timer) { clearInterval(timer); timer = null; } };
  }, [stepMs]);
  return now;
}
