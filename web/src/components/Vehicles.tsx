
/** Side-view bus and train, both facing right (the way they travel in the animations). Same stroke style as the Lucide set. */
type P = { size?: number; strokeWidth?: number; class?: string; style?: string };
const base = (p: P) => ({ width: p.size ?? 24, height: p.size ?? 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": p.strokeWidth ?? 2, "stroke-linecap": "round" as const, "stroke-linejoin": "round" as const, class: p.class, style: p.style, "aria-hidden": true });

export function TrainSide(p: P) {
  return (
    <svg {...base(p)}>
      <path d="M2 7a2 2 0 0 1 2-2h10.4c1.3 0 2.5.6 3.3 1.6l3.4 4.4c.3.4.4.8.4 1.3V16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
      <path d="M5 9.5h3.5M10.5 9.5H14M16 8.4l2.4 3.1H16z" />
      <path d="M2 13.5h19.5" />
      <circle cx="7" cy="19.2" r="1.6" /><circle cx="16.5" cy="19.2" r="1.6" />
    </svg>
  );
}

export function BusSide(p: P) {
  return (
    <svg {...base(p)}>
      <rect x="2" y="5" width="20" height="12.5" rx="2.5" />
      <path d="M2 11h20M7 5v6M12.5 5v6M17.5 5v6" />
      <path d="M21.5 13.5h.5" />
      <circle cx="7" cy="19" r="1.8" /><circle cx="17" cy="19" r="1.8" />
    </svg>
  );
}
