import type { Messages } from "../i18n/index.ts";
import type { MarketRow } from "../lib/format.ts";

/** One leaflet of the hand-shaped leaf: a narrow blade with small teeth on both edges, pointing up from (0, 0). */
function leaflet(len: number, wid: number, teeth: number): string {
  const f = (n: number) => String(Math.round(n * 100) / 100);
  const left: string[] = [], right: string[] = [];
  for (let i = 1; i <= teeth; i++) {
    const t = i / (teeth + 1), y = -len * t, w = wid * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - 0.25 * t);
    const tip = len * 0.5 / (teeth + 1);
    left.push(`L${f(-w)} ${f(y + tip * 0.5)}L${f(-w * 0.55)} ${f(y - tip * 0.6)}`);
    right.unshift(`L${f(w * 0.55)} ${f(y - tip * 0.6)}L${f(w)} ${f(y + tip * 0.5)}`);
  }
  return `M0 0${left.join("")}L0 ${f(-len)}${right.join("")}Z`;
}
const BLADES: [number, number][] = [[-78, 0.5], [-52, 0.74], [-26, 0.92], [0, 1], [26, 0.92], [52, 0.74], [78, 0.5]];
/** A whole leaf, seven leaflets from one point. */
function Leaf({ x, y, s, rot = 0, tone = 0 }: { x: number; y: number; s: number; rot?: number; tone?: number }) {
  const body = tone ? "#1f9a4d" : "#2fbf5a", dark = tone ? "#0f6a33" : "#17803c";
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      {BLADES.map(([a, l], i) => <g key={i} transform={`rotate(${a})`}><path d={leaflet(34 * l, 4.6 * (0.7 + l * 0.3), 6)} fill={body} stroke={dark} stroke-width=".35" stroke-linejoin="round" /><path d={`M0 0V${-34 * l * 0.92}`} stroke={dark} stroke-width=".45" opacity=".7" /></g>)}
    </g>
  );
}

/** The chip's picture for "Legalità": a young plant with hand-shaped leaves growing out of a little book of laws. Sways on hover or tap. */
export function LawGhost() {
  return (
    <svg viewBox="0 0 80 70" class="gh gh-law" aria-hidden="true">
      <path d="M0 63Q22 58 44 62T80 60V70H0Z" fill="#2fbf5a" opacity=".22" />
      <g class="gh-sway">
        <path d="M40 54Q38 42 40 22" stroke="#17803c" stroke-width="2" fill="none" stroke-linecap="round" />
        <path d="M40 40Q31 36 25 30" stroke="#17803c" stroke-width="1.4" fill="none" stroke-linecap="round" /><path d="M40 34Q49 30 55 25" stroke="#17803c" stroke-width="1.4" fill="none" stroke-linecap="round" />
        <Leaf x={40} y={26} s={0.5} /><Leaf x={26} y={32} s={0.36} rot={-42} tone={1} /><Leaf x={54} y={28} s={0.36} rot={42} tone={1} />
      </g>
      <rect x="22" y="53" width="36" height="9" rx="1.500" fill="#5b4bd6" /><rect x="22" y="53" width="36" height="2.400" rx="1.200" fill="#8a7bff" /><rect x="25" y="56.500" width="30" height="1.200" fill="#fff" opacity=".55" /><rect x="25" y="59" width="22" height="1.200" fill="#fff" opacity=".4" />
    </svg>
  );
}

/** The scene of a question about the law: a field of leaves swaying behind the caption. */
export function LawScene({ m, hint, msg }: { m: MarketRow; hint: "yes" | "no" | null | undefined; msg: Messages }) {
  const cap = String((m.params as { label?: string }).label ?? msg.tabs.law);
  return (
    <div class={`mscene tick house law ${hint === "yes" ? "s-yes" : hint === "no" ? "s-no" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
        <defs><linearGradient id="lw-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1450" /><stop offset=".6" stop-color="#2a2a7a" /><stop offset="1" stop-color="#14502e" /></linearGradient></defs>
        <rect width="320" height="84" fill="url(#lw-bg)" />
        <g fill="#fff" opacity=".6"><circle cx="40" cy="14" r="1" /><circle cx="120" cy="9" r="1.200" /><circle cx="230" cy="16" r="1" /><circle cx="285" cy="10" r="1.300" /></g>
        <path d="M0 74Q80 66 160 72T320 70V84H0Z" fill="#0d3a22" />
        {[[34, 58, 0.5, -8], [92, 52, 0.66, 6], [160, 60, 0.46, -4], [224, 52, 0.68, -6], [288, 58, 0.54, 8]].map(([x, y, s, r], i) => (
          <g key={i} class={`lw-plant p${i}`}>
            <path d={`M${x} 80Q${x! - 2} ${(y! + 80) / 2} ${x} ${y}`} stroke="#17803c" stroke-width="1.800" fill="none" stroke-linecap="round" />
            <Leaf x={x!} y={y!} s={s!} rot={r!} /><Leaf x={x! - 8 * s!} y={y! + 10 * s!} s={s! * 0.6} rot={-40} tone={1} /><Leaf x={x! + 8 * s!} y={y! + 8 * s!} s={s! * 0.6} rot={40} tone={1} />
          </g>
        ))}
      </svg>
      <b>{cap}</b>
    </div>
  );
}
