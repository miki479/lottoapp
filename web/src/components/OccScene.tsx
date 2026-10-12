import type { Messages } from "../i18n/index.ts";
import type { MarketRow } from "../lib/format.ts";

/** How many of the 8 windows show a passenger for each occupancy level (0 empty ... 5 full). */
const HEADS = [0, 2, 4, 6, 7, 8];
/** What "yes" would look like, from the question itself: empty / few seats left / standing room. */
const YES_LEVEL: Record<string, number> = { empty: 0, few: 2, standing: 3 };

/**
 * Side view of a bus whose windows fill with passengers. Without a choice it shows how full the bus is right now (or a half-full
 * bus); hovering or choosing "yes" shows the situation the question describes, "no" the opposite. CSS only.
 */
export function OccScene({ m, hint, level }: { m: MarketRow; hint: "yes" | "no" | null; level?: number; msg: Messages }) {
  const occ = String(m.params.occ ?? "few");
  const yes = YES_LEVEL[occ] ?? 2;
  // "no" on "empty" = crowded; "no" on "few / standing" = plenty of seats
  const noLevel = occ === "empty" ? 3 : 1;
  const shown = hint === "yes" ? yes : hint === "no" ? noLevel : (level ?? 1);
  const n = HEADS[Math.max(0, Math.min(5, shown))]!;
  const crowded = n >= 7;
  return (
    <div class={`occscene ${crowded ? "crowded" : ""} ${n === 0 ? "empty" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 120 44" class="occbus">
        <path d="M4 8Q4 3 9 3H98C108 3 114 9 114 17V34Q114 36 112 36H9Q4 36 4 31Z" fill="#ffb020" />
        <path d="M6 28h106" stroke="#fff" stroke-width="1.6" opacity=".85" />
        {Array.from({ length: 8 }, (_, i) => (
          <g key={i}>
            <rect x={9 + i * 11.2} y="8" width="9.6" height="13" rx="2" fill="#1c212b" />
            <circle class={`hd ${i < n ? "on" : ""}`} style={`--k:${i}`} cx={13.8 + i * 11.2} cy="16.5" r="3.1" fill="#f4c9a4" />
            <path class={`hd ${i < n ? "on" : ""}`} style={`--k:${i}`} d={`M${10.4 + i * 11.2} 21h6.8v-1.2Q${13.8 + i * 11.2} 17.6 ${10.4 + i * 11.2} 19.8z`} fill="#6c5ce7" />
          </g>
        ))}
        <path d="M98 8h6C109 8 111 12 111 18H98z" fill="#1c212b" />
        <circle cx="26" cy="37" r="5" fill="#1c212b" /><circle cx="26" cy="37" r="1.8" fill="#8a90a0" />
        <circle cx="92" cy="37" r="5" fill="#1c212b" /><circle cx="92" cy="37" r="1.8" fill="#8a90a0" />
      </svg>
      <span class="occroad" />
    </div>
  );
}
