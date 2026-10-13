/** Crest of a league with its number inlaid. The higher the league, the more it has: a plain bronze shield, a double-rimmed silver one, a gold crest with a crown,
 * a faceted platinum one with wings, and a diamond crest with a jewelled crown, wings and a glint. Drawn as SVG, so it stays sharp at any size. */
const SHIELD = "M50 6 L88 17 V55 C88 80 69 95 50 103 C31 95 12 80 12 55 V17 Z";
const INNER = "M50 14 L80 23 V54 C80 75 65 87 50 94 C35 87 20 75 20 54 V23 Z";

const PAL = [
  { a: "#f0b988", b: "#b8743a", c: "#6b3d14", rim: "#4a2a0c", ink: "#fbe8d0", ink2: "#7a4a1e" },
  { a: "#fbfcff", b: "#aab3c2", c: "#6c7585", rim: "#4a5260", ink: "#ffffff", ink2: "#59626f" },
  { a: "#fff1a6", b: "#f0b429", c: "#9a6400", rim: "#6b4300", ink: "#fffbe6", ink2: "#8a5a00" },
  { a: "#f3fbff", b: "#a7c4de", c: "#587ca3", rim: "#355675", ink: "#ffffff", ink2: "#3c5f85" },
  { a: "#e8fbff", b: "#7ad7f5", c: "#3b6fd8", rim: "#26418f", ink: "#ffffff", ink2: "#1f3a86" },
] as const;

export function LeagueEmblem({ league, size = 44 }: { league: number; size?: number }) {
  const n = Math.min(4, Math.max(0, Math.trunc(league || 0))), c = PAL[n]!, id = `lge${n}`;
  const crown = n >= 2, wings = n >= 3;
  const h = size * (crown ? 1.18 : 1.05), w = size * (wings ? 1.36 : 1);
  return (
    <svg class={`lgemblem l${n}`} width={w} height={h} viewBox={`${wings ? -18 : 0} ${crown ? -20 : 0} ${wings ? 136 : 100} ${crown ? 126 : 110}`} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-m`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color={c.a} /><stop offset=".5" stop-color={c.b} /><stop offset="1" stop-color={c.c} /></linearGradient>
        <linearGradient id={`${id}-i`} x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color={c.c} /><stop offset="1" stop-color={c.b} /></linearGradient>
        <clipPath id={`${id}-c`}><path d={SHIELD} /></clipPath>
      </defs>
      {wings && (
        <g fill={`url(#${id}-m)`} stroke={c.rim} stroke-width="1.4" stroke-linejoin="round">
          {[-1, 1].map((s) => (
            <g key={s} transform={s < 0 ? "" : "translate(100 0) scale(-1 1)"}>
              <path d="M13 36 C2 30 -4 22 -8 10 C0 14 6 14 12 12 Z" />
              <path d="M12 48 C-2 44 -8 38 -13 26 C-3 30 4 30 11 28 Z" />
              {n >= 4 && <path d="M12 60 C-1 58 -8 54 -14 44 C-4 46 3 45 11 43 Z" />}
            </g>
          ))}
        </g>
      )}
      {crown && (
        <g stroke={c.rim} stroke-width="1.6" stroke-linejoin="round">
          <path d={n >= 4 ? "M24 10 L28 -12 L40 2 L50 -16 L60 2 L72 -12 L76 10 Z" : "M32 10 L35 -6 L43 4 L50 -9 L57 4 L65 -6 L68 10 Z"} fill={`url(#${id}-m)`} />
          {n >= 4 && <g stroke="none"><circle cx="28" cy="-12" r="3" fill="#ff7ad9" /><circle cx="50" cy="-16" r="3.6" fill="#7af2ff" /><circle cx="72" cy="-12" r="3" fill="#ff7ad9" /></g>}
        </g>
      )}
      <path d={SHIELD} fill={`url(#${id}-m)`} stroke={c.rim} stroke-width="2.4" stroke-linejoin="round" />
      {n >= 1 && <path d={SHIELD} fill="none" stroke={c.ink} stroke-opacity=".55" stroke-width="1.2" transform="translate(50 54) scale(.95) translate(-50 -54)" />}
      {n >= 2 && Array.from({ length: 10 }, (_, i) => { const t = (i / 10) * Math.PI * 2; return <circle key={i} cx={50 + 33 * Math.sin(t) * 1.05} cy={54 - 38 * Math.cos(t)} r="1.9" fill={c.ink} fill-opacity=".8" />; })}
      {n >= 3 && (
        <g clip-path={`url(#${id}-c)`} fill="#fff" fill-opacity=".16"><path d="M12 17 L50 6 L50 54 Z" /><path d="M88 17 L50 6 L50 54 Z" fill-opacity=".05" /><path d="M12 55 L50 54 L50 103 C31 95 12 80 12 55Z" fill-opacity=".1" /></g>
      )}
      <path d={INNER} fill={`url(#${id}-i)`} stroke={c.rim} stroke-opacity=".7" stroke-width="1.4" />
      {n >= 1 && <path d="M20 66 Q50 76 80 66 L80 72 Q50 82 20 72 Z" fill={c.ink} fill-opacity=".35" />}
      {n >= 4 && <path d="M50 28 L68 54 L50 84 L32 54 Z" fill="#fff" fill-opacity=".18" stroke={c.ink} stroke-opacity=".6" stroke-width="1" />}
      <text x="50" y="68" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="900" font-size="46" fill={c.ink2} transform="translate(0 2.4)">{n + 1}</text>
      <text x="50" y="68" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="900" font-size="46" fill={c.ink} stroke={c.rim} stroke-width="1.1" paint-order="stroke">{n + 1}</text>
      <path d="M22 24 L50 14 L78 24" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2" stroke-linecap="round" />
      {n >= 4 && <path class="lgsparkle" d="M84 30 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" fill="#fff" />}
    </svg>
  );
}
