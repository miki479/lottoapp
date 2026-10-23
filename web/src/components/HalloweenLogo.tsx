/** The event's mark: the game's clock-chip with both hands on midnight, in Halloween orange. It is the same clock that sits on every badge, so it reads as the event's emblem. */
export function HalloweenLogo({ size = 32, bare = false }: { size?: number; bare?: boolean }) {
  return (
    <svg class="hwlogo" width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Midnight">
      <circle cx="24" cy="24" r="22" fill="#120a1f" {...(bare ? {} : { stroke: "#ff8a2a", "stroke-width": 2.5 })} />
      <circle cx="24" cy="24" r="17.5" fill="none" stroke="#ff8a2a" stroke-opacity=".45" stroke-width="1" stroke-dasharray="1.5 4.2" />
      {Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6, r1 = i % 3 === 0 ? 13.5 : 15, r2 = 17; return <line key={i} x1={24 + Math.sin(a) * r1} y1={24 - Math.cos(a) * r1} x2={24 + Math.sin(a) * r2} y2={24 - Math.cos(a) * r2} stroke="#ffd27a" stroke-width={i % 3 === 0 ? 2 : 1} stroke-linecap="round" />; })}
      <line x1="24" y1="24" x2="24" y2="9.5" stroke="#ffb347" stroke-width="2.6" stroke-linecap="round" />
      <line x1="24" y1="24" x2="24" y2="13.5" stroke="#ff6a1a" stroke-width="3.2" stroke-linecap="round" />
      <circle cx="24" cy="24" r="2.4" fill="#ffd27a" />
    </svg>
  );
}
