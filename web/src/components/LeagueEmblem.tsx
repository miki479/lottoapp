/** Crest of a league with its number inlaid, drawn like the trophies: bevelled metal, rivets, a recessed face, a gloss and a cast shadow.
 * The higher the league, the more it has: a riveted bronze shield with a laurel; silver adds a second rim and a star; gold a crown and more stars; platinum
 * feathered wings and facets; diamond a gem-set crown, a faceted gem behind the number and a glint. Pure SVG, sharp at any size. */
const SHIELD = "M50 6 L88 17 V55 C88 80 69 95 50 103 C31 95 12 80 12 55 V17 Z";
const MID = "M50 10 L84 20 V55 C84 77 67 91 50 99 C33 91 16 77 16 55 V20 Z";
const INNER = "M50 15 L80 24 V54 C80 75 65 87 50 94 C35 87 20 75 20 54 V24 Z";

const PAL = [
  { a: "#ffd9b0", b: "#cd8a4b", c: "#8a4d1c", d: "#4a2a0c", ink: "#fff0dc", ink2: "#7a4a1e", gem: "#ffb36b" },
  { a: "#ffffff", b: "#c3ccda", c: "#7d889a", d: "#444c5a", ink: "#ffffff", ink2: "#59626f", gem: "#dfe8ff" },
  { a: "#fff6bd", b: "#f6c336", c: "#b07400", d: "#6b4300", ink: "#fffbe6", ink2: "#8a5a00", gem: "#ff6b6b" },
  { a: "#ffffff", b: "#bcd6ee", c: "#5f86b0", d: "#2f4f72", ink: "#ffffff", ink2: "#3c5f85", gem: "#7af2ff" },
  { a: "#f0fdff", b: "#8fe0f8", c: "#3f78e0", d: "#223a8a", ink: "#ffffff", ink2: "#1f3a86", gem: "#ff7ad9" },
] as const;

/** One laurel branch along an arc: leaves of growing size, rotated along the curve. */
function Laurel({ side, fill, stroke }: { side: -1 | 1; fill: string; stroke: string }) {
  const leaves = Array.from({ length: 7 }, (_, i) => {
    const t = i / 6, x = 50 + side * (27 - 5 * t + Math.sin(t * 2.6) * 2), y = 78 - t * 34, rot = side * (-28 - t * 26) + (side < 0 ? 0 : 0);
    return <ellipse key={i} cx={x} cy={y} rx={2 + (1 - t) * 1.5} ry={4.4 - t * 1.2} transform={`rotate(${rot} ${x} ${y})`} />;
  });
  return <g fill={fill} stroke={stroke} stroke-opacity=".6" stroke-width=".5">{leaves}</g>;
}

export function LeagueEmblem({ league, size = 44 }: { league: number; size?: number }) {
  const n = Math.min(4, Math.max(0, Math.trunc(league || 0))), c = PAL[n]!, id = `lge${n}`;
  const crown = n >= 2, wings = n >= 3;
  const h = size * (crown ? 1.2 : 1.08), w = size * (wings ? 1.4 : 1.02);
  return (
    <svg class={`lgemblem l${n}`} width={w} height={h} viewBox={`${wings ? -20 : -1} ${crown ? -22 : -1} ${wings ? 140 : 102} ${crown ? 134 : 114}`} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-m`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color={c.a} /><stop offset=".35" stop-color={c.b} /><stop offset=".7" stop-color={c.c} /><stop offset="1" stop-color={c.d} /></linearGradient>
        <linearGradient id={`${id}-r`} x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color={c.d} /><stop offset=".5" stop-color={c.c} /><stop offset="1" stop-color={c.a} /></linearGradient>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95" /><stop offset=".45" stop-color="#fff" stop-opacity="0" /><stop offset=".55" stop-color="#000" stop-opacity="0" /><stop offset="1" stop-color="#000" stop-opacity=".55" /></linearGradient>
        <radialGradient id={`${id}-f`} cx=".38" cy=".25" r=".95"><stop offset="0" stop-color={c.b} /><stop offset=".6" stop-color={c.c} /><stop offset="1" stop-color={c.d} /></radialGradient>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55" /><stop offset="1" stop-color="#fff" stop-opacity="0" /></linearGradient>
        <linearGradient id={`${id}-t`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color={c.ink} /><stop offset="1" stop-color={c.a} /></linearGradient>
        <clipPath id={`${id}-c`}><path d={SHIELD} /></clipPath>
      </defs>
      <ellipse cx="50" cy="107" rx="32" ry="3.6" fill="#000" fill-opacity=".22" />
      {wings && (
        <g stroke={c.d} stroke-width="1.1" stroke-linejoin="round">
          {[-1, 1].map((s) => (
            <g key={s} transform={s < 0 ? "" : "translate(100 0) scale(-1 1)"}>
              {([[36, 12, 10, -8], [48, 26, 12, -13], [60, 44, 14, -14], ...(n >= 4 ? [[72, 62, 14, -14]] : [])] as [number, number, number, number][]).map(([y, ty, , tx], i) => (
                <g key={i}>
                  <path d={`M13 ${y} C2 ${y - 6} ${tx - 2} ${ty + 6} ${tx} ${ty} C${tx + 8} ${ty + 4} 6 ${ty + 4} 12 ${ty - 1} Z`} fill={`url(#${id}-r)`} transform="translate(.8 1.2)" fill-opacity=".55" stroke="none" />
                  <path d={`M13 ${y} C2 ${y - 6} ${tx - 2} ${ty + 6} ${tx} ${ty} C${tx + 8} ${ty + 4} 6 ${ty + 4} 12 ${ty - 1} Z`} fill={`url(#${id}-m)`} />
                  <path d={`M12 ${y - 2} Q2 ${ty + 8} ${tx + 2} ${ty + 2}`} fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".7" />
                </g>
              ))}
            </g>
          ))}
        </g>
      )}
      {crown && (
        <g stroke={c.d} stroke-width="1.5" stroke-linejoin="round">
          <path d={n >= 4 ? "M24 11 L28 -13 L40 2 L50 -18 L60 2 L72 -13 L76 11 Z" : "M30 11 L34 -7 L43 4 L50 -11 L57 4 L66 -7 L70 11 Z"} fill={`url(#${id}-m)`} />
          <path d={n >= 4 ? "M24 11 H76 V6 H24 Z" : "M30 11 H70 V6.500 H30 Z"} fill={`url(#${id}-r)`} />
          <path d={n >= 4 ? "M28 -12 L40 2 L50 -17" : "M34 -6 L43 4 L50 -10"} fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".9" stroke-linecap="round" />
          <g stroke="none">
            {(n >= 4 ? [[28, -13], [50, -18], [72, -13]] : [[34, -7], [50, -11], [66, -7]]).map(([x, y], i) => <circle key={i} cx={x} cy={y} r={n >= 4 ? 3.2 : 2.4} fill={i === 1 ? "#7af2ff" : c.gem} stroke={c.d} stroke-width=".6" />)}
            {[0, 1, 2, 3].map((i) => <circle key={i} cx={n >= 4 ? 33 + i * 11.3 : 36.500 + i * 9} cy="8.500" r="1" fill={c.ink} fill-opacity=".85" />)}
          </g>
        </g>
      )}
      {/* outer rim: a dark body with a light-to-dark bevel line over it */}
      <path d={SHIELD} fill={`url(#${id}-r)`} stroke={c.d} stroke-width="2" stroke-linejoin="round" />
      <path d={SHIELD} fill="none" stroke={`url(#${id}-b)`} stroke-width="3.2" stroke-linejoin="round" />
      <path d={MID} fill={`url(#${id}-m)`} stroke={c.d} stroke-opacity=".55" stroke-width="1" />
      {n >= 1 && <path d={MID} fill="none" stroke={c.ink} stroke-opacity=".6" stroke-width=".8" transform="translate(50 55) scale(.975) translate(-50 -55)" />}
      {Array.from({ length: n >= 1 ? 12 : 8 }, (_, i) => { const t = (i / (n >= 1 ? 12 : 8)) * Math.PI * 2; const x = 50 + 35.500 * Math.sin(t) * 1.02, y = 56 - 41 * Math.cos(t); return y < 98 ? <g key={i}><circle cx={x} cy={y + .8} r="2.2" fill={c.d} fill-opacity=".45" /><circle cx={x} cy={y} r="1.9" fill={`url(#${id}-m)`} stroke={c.d} stroke-opacity=".6" stroke-width=".4" /><circle cx={x - .6} cy={y - .6} r=".6" fill="#fff" /></g> : null; })}
      {/* recessed face */}
      <path d={INNER} fill={`url(#${id}-f)`} stroke={`url(#${id}-b)`} stroke-width="2" transform="translate(50 55) scale(1) translate(-50 -55)" />
      <path d={INNER} fill="none" stroke={c.d} stroke-opacity=".6" stroke-width=".9" />
      <g clip-path={`url(#${id}-c)`}>
        {n >= 3 && <g fill="#fff"><path d="M12 17 L50 6 L50 54 Z" fill-opacity=".14" /><path d="M88 17 L50 6 L50 54 Z" fill-opacity=".04" /><path d="M12 55 L50 54 L50 103 C31 95 12 80 12 55Z" fill-opacity=".08" /></g>}
        <path d="M12 8 H88 V44 C70 38 30 40 12 52 Z" fill={`url(#${id}-g)`} fill-opacity=".55" />
      </g>
      {n >= 4 && (
        <g>
          <path d="M50 27 L69 54 L50 86 L31 54 Z" fill="#9fe9ff" fill-opacity=".38" stroke={c.ink} stroke-opacity=".8" stroke-width="1" />
          <path d="M50 27 L50 86 M31 54 H69 M50 27 L40 54 L50 86 M50 27 L60 54 L50 86" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".6" />
        </g>
      )}
      <Laurel side={-1} fill={c.ink} stroke={c.d} />
      <Laurel side={1} fill={c.ink} stroke={c.d} />
      {n >= 1 && (
        <g fill={c.ink} stroke={c.d} stroke-width=".5">
          {Array.from({ length: n }, (_, i) => { const x = 50 + (i - (n - 1) / 2) * 9; return <path key={i} d={`M${x} 28 l1.700 3.600 3.900.4 -2.900 2.600.8 3.800 -3.500 -2 -3.500 2 .8 -3.800 -2.900 -2.600 3.900 -.4z`} />; })}
        </g>
      )}
      <path d="M22 70 Q50 80 78 70 L78 75 Q50 85 22 75 Z" fill={c.d} fill-opacity=".35" />
      <text x="50" y="69" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="900" font-size="44" fill={c.d} fill-opacity=".7" transform="translate(1.3 2.6)">{n + 1}</text>
      <text x="50" y="69" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="900" font-size="44" fill={`url(#${id}-t)`} stroke={c.d} stroke-width="1.2" paint-order="stroke">{n + 1}</text>
      <path d="M24 26 L50 17 L76 26" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.8" stroke-linecap="round" />
      {n >= 3 && <path class="lgsparkle" d="M82 30 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" fill="#fff" />}
    </svg>
  );
}
