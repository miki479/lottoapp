import { countdown } from "../lib/format.ts";
import { useNow } from "../lib/clock.ts";

/** A countdown to a moment that ticks every second by itself, so the rest of the screen does not have to re-render for it. */
export function Countdown({ to }: { to: number }) {
  const now = useNow();
  return <>{countdown(to - now)}</>;
}
