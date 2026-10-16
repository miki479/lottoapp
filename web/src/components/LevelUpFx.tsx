import { useEffect } from "preact/hooks";
import type { Messages } from "../i18n/index.ts";
import { haptic } from "../lib/haptics.ts";

/** Level up, on whatever page the player is: the old level in a small circle, a line that fills up to the big new level, then a burst. */
export function LevelUpFx({ from, to, msg, onDone }: { from: number; to: number; msg: Messages; onDone: () => void }) {
  useEffect(() => {
    const a = setTimeout(() => haptic.success(), 1500), b = setTimeout(onDone, 4200);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  return (
    <div class="lvfx" role="status" aria-live="polite" onClick={onDone}>
      <div class="lvstage">
        <span class="lvsmall num" aria-hidden="true">{from}</span>
        <span class="lvline" aria-hidden="true"><i /></span>
        <span class="lvbig" aria-hidden="true">
          <b class="num">{to}</b>
          <span class="lvburst">
            <i class="ring" /><i class="ring r2" />
            {Array.from({ length: 26 }, (_, k) => <i key={k} class={k % 3 === 0 ? "sq" : ""} style={`--a:${Math.round((k * 360) / 26)}deg;--d:${90 + ((k * 41) % 90)}px`} />)}
          </span>
        </span>
      </div>
      <p class="lvtxt">{msg.look.level(to)}</p>
    </div>
  );
}
