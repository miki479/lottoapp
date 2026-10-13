import { useRef, useState } from "preact/hooks";

/**
 * One action at a time: a second tap while the first is still running is ignored (guarded by a ref, so it holds even before the next render),
 * and the busy flag is always cleared, also when the action throws (then `fail` runs, if given). Returns the action's result, or undefined.
 */
export function useBusy() {
  const [busy, setBusy] = useState(false), on = useRef(false);
  const run = async <T,>(fn: () => Promise<T>, fail?: (e: unknown) => void): Promise<T | undefined> => {
    if (on.current) return undefined;
    on.current = true; setBusy(true);
    try { return await fn(); } catch (e) { fail?.(e); return undefined; } finally { on.current = false; setBusy(false); }
  };
  return [busy, run] as const;
}
