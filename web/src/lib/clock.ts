import { useEffect, useState } from "preact/hooks";

// One shared interval for every countdown on screen: cheap, and they all tick in sync.
const subs = new Set<(t: number) => void>();
let timer: ReturnType<typeof setInterval> | null = null;
function ensure() {
  if (timer) return;
  timer = setInterval(() => { const t = Date.now(); subs.forEach((f) => f(t)); }, 1000);
}

/** Current time in ms, re-rendering the caller every second. */
export function useNow(): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    subs.add(setNow); ensure();
    return () => { subs.delete(setNow); if (subs.size === 0 && timer) { clearInterval(timer); timer = null; } };
  }, []);
  return now;
}
