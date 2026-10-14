import { useEffect, useRef, useState } from "preact/hooks";
import type { Messages } from "../i18n/index.ts";
import { fmtDec } from "../lib/num.ts";

type SkyState = "clear" | "light" | "heavy";
/** From the forecast millimetres of the hour: nothing, a drizzle, or a proper downpour. */
export const skyOf = (mm: number | undefined): SkyState => (mm === undefined || mm < 0.1 ? "clear" : mm < 1 ? "light" : "heavy");

/**
 * The sky of a rain question. At rest it shows the forecast (sun, light rain or heavy rain).
 * While a choice is hovered or pressed it plays the "what if": YES turns the sky to rain, NO brings the sun back.
 */
export function Sky({ mm, hint, msg }: { mm: number | undefined; hint: "yes" | "no" | null; msg: Messages }) {
  const real = skyOf(mm);
  const shown: SkyState = hint === "yes" ? (real === "clear" ? "light" : real) : hint === "no" ? "clear" : real;
  const drops = shown === "heavy" ? 16 : shown === "light" ? 7 : 0;
  return (
    <div class={`sky ${shown}`} data-hint={hint ?? ""} aria-hidden="true">
      <span class="sun"><i /></span>
      <span class="cl c1" /><span class="cl c2" />
      <span class="rain">{Array.from({ length: drops }, (_, i) => <i key={i} style={`left:${(i * 100) / drops + 3}%;animation-delay:${-((i * 137) % 900)}ms;animation-duration:${shown === "heavy" ? 480 : 820}ms`} />)}</span>
      <span class="skycap">{shown === "clear" ? msg.weather.clear : shown === "light" ? msg.weather.light : msg.weather.heavy}{mm !== undefined && !hint ? ` · ${fmtDec(mm, 1)} mm` : ""}</span>
    </div>
  );
}

/** Hold a hint for a moment after a touch (a tap opens the bet sheet at once, so the animation needs a short life of its own). */
export function useHint() {
  const [hint, setHint] = useState<"yes" | "no" | null>(null);
  const t = useRef<number | undefined>(undefined);
  useEffect(() => () => clearTimeout(t.current), []);
  const show = (h: "yes" | "no", hold = 0) => { clearTimeout(t.current); setHint(h); if (hold) t.current = setTimeout(() => setHint(null), hold) as unknown as number; };
  const clear = () => { clearTimeout(t.current); setHint(null); };
  return { hint, show, clear };
}
