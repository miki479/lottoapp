
/** Side-view bus and train, both facing right (the way they travel in the animations). Same stroke style as the Lucide set. */
type P = { size?: number; strokeWidth?: number; class?: string; style?: string };
const base = (p: P) => ({ width: p.size ?? 24, height: p.size ?? 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": p.strokeWidth ?? 2, "stroke-linecap": "round" as const, "stroke-linejoin": "round" as const, class: p.class, style: p.style, "aria-hidden": true });

/** Long red high-speed train with an arrow-shaped nose, facing right. `size` is the height; the width is 3x. */
export function TrainSide(p: P) {
  const h = p.size ?? 24;
  return (
    <svg width={h * 3} height={h} viewBox="0 0 48 16" class={p.class} style={p.style} aria-hidden="true">
      <path d="M2 4.2Q2 2 4.2 2H30C36 2 41 5 46.2 10.2Q47 11 46 11.7Q45.4 12 44.4 12H4.2Q2 12 2 9.8Z" fill="#e2332b" />
      <path d="M33 4h6.4C41 5.4 42.800 7.200 44.200 9H33.800z" fill="#1c212b" />
      <rect x="6" y="4.200" width="24" height="2.800" rx="1.400" fill="#1c212b" />
      <path d="M3 8.600h39" stroke="#fff" stroke-width="1" opacity=".85" />
      <circle cx="9" cy="13.300" r="1.500" fill="#1c212b" /><circle cx="18" cy="13.300" r="1.500" fill="#1c212b" />
      <circle cx="27" cy="13.300" r="1.500" fill="#1c212b" /><circle cx="36" cy="13.300" r="1.500" fill="#1c212b" />
    </svg>
  );
}

/** Illustrated side-view bus (amber), same drawing style as the train. `size` is the height; the width is 2.4x. */
export function BusSide(p: P) {
  const h = p.size ?? 24;
  return (
    <svg width={h * 2.4} height={h} viewBox="0 0 38 16" class={p.class} style={p.style} aria-hidden="true">
      <path d="M2 4.200Q2 2 4.200 2H31C34.500 2 36 4 36 7V11.800Q36 12.600 35.200 12.600H4.200Q2 12.600 2 10.400Z" fill="#ffb020" />
      <rect x="5" y="4.200" width="5" height="3.400" rx=".8" fill="#1c212b" /><rect x="11.500" y="4.200" width="5" height="3.400" rx=".8" fill="#1c212b" />
      <rect x="18" y="4.200" width="5" height="3.400" rx=".8" fill="#1c212b" /><path d="M26 4.200h4.800C32.600 4.200 33.800 5.200 34 7.600H26z" fill="#1c212b" />
      <path d="M3 9.200h32" stroke="#fff" stroke-width="1" opacity=".85" />
      <circle cx="9" cy="13.200" r="1.800" fill="#1c212b" /><circle cx="28" cy="13.200" r="1.800" fill="#1c212b" />
    </svg>
  );
}

/** Illustrated rain cloud, same drawing style as the vehicles. `size` is the height; the width is 1.7x. */
export function CloudRainSide(p: P) {
  const h = p.size ?? 24;
  return (
    <svg width={h * 1.7} height={h} viewBox="0 0 34 20" overflow="visible" class={p.class} style={p.style} aria-hidden="true">
      <g fill="#ffffff" style="filter:drop-shadow(0 0 .9px #3f66c0) drop-shadow(0 1px 1.2px rgba(63,102,192,.45))">
        <circle cx="10" cy="11.500" r="5" /><circle cx="17" cy="8" r="6.500" /><circle cx="24.500" cy="11" r="5" />
        <rect x="10" y="11" width="14.500" height="5.500" rx="2.700" />
      </g>
      <path d="M10 17.800l-1 2M16 17.800l-1 2M22 17.800l-1 2" stroke="#3f66c0" stroke-width="1.800" stroke-linecap="round" />
    </svg>
  );
}
