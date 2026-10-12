import { useState } from "preact/hooks";
import type { Messages } from "../i18n/index.ts";
import type { MarketRow } from "../lib/format.ts";

const f = (n: number) => String(Math.round(n * 100) / 100);
/** One leaflet: a long pointed blade, widest a little before the middle, with sharp teeth along both edges. Points up from (0, 0). */
function leaflet(len: number, wid: number, teeth: number): string {
  const L: string[] = [], R: string[] = [];
  for (let i = 1; i <= teeth; i++) {
    const t = i / (teeth + 1), y = -len * t;
    const w = wid * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.9) * (1 - 0.15 * t);
    const step = len / (teeth + 1), cut = Math.max(0.5, w * 0.34);
    L.push(`L${f(-w)} ${f(y + step * 0.18)}L${f(-w + cut)} ${f(y - step * 0.42)}`);
    R.unshift(`L${f(w - cut)} ${f(y - step * 0.42)}L${f(w)} ${f(y + step * 0.18)}`);
  }
  return `M0 0${L.join("")}L0 ${f(-len)}${R.join("")}Z`;
}
/** The seven leaflets: the middle one the longest, the others fanning out, the lowest two nearly sideways. */
const FAN: [number, number][] = [[-100, 0.5], [-62, 0.78], [-29, 0.93], [0, 1], [29, 0.93], [62, 0.78], [100, 0.5]];
const BLADE = leaflet(30, 3.6, 9), PATHS = FAN.map(([, l]) => leaflet(30 * l, 3.6 * (0.62 + 0.38 * l), 9));

export function Leaf({ x, y, s, rot = 0, dark = false, cls = "", onClick }: { x: number; y: number; s: number; rot?: number; dark?: boolean; cls?: string; onClick?: () => void }) {
  const fill = dark ? "url(#cn-dark)" : "url(#cn-lite)", edge = dark ? "#0b4d25" : "#10672f";
  // the outer group only places the leaf; the inner one is what animates (an animation would otherwise replace the placement)
  return (
    <g class="cn-pos" transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} onClick={onClick}>
      <g class={`cn-in ${cls}`}>
        <path d="M0 4Q1.5 12 0 20" stroke={edge} stroke-width="1.6" fill="none" stroke-linecap="round" />
        {FAN.map(([a], i) => (
          <g key={i} class="cn-b" transform={`rotate(${a})`}>
            <path d={PATHS[i]!} fill={fill} stroke={edge} stroke-width=".3" stroke-linejoin="round" />
            <path d={`M0 -1V${f(-FAN[i]![1] * 27)}`} stroke="#d4f58a" stroke-width=".5" opacity=".7" />
          </g>
        ))}
      </g>
    </g>
  );
}
void BLADE;

export const DEFS = (
  <defs>
    <linearGradient id="cn-lite" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#d3f04a" /><stop offset=".45" stop-color="#4fbf3f" /><stop offset="1" stop-color="#1c6b2e" /></linearGradient>
    <linearGradient id="cn-dark" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#7fb83a" /><stop offset=".5" stop-color="#2e8a3c" /><stop offset="1" stop-color="#0d4a26" /></linearGradient>
  </defs>
);

/** The chip's picture for "Legalità": a young plant with hand-shaped leaves growing out of a little book of laws. It sways on hover or tap. */
export function LawGhost() {
  return (
    <svg viewBox="0 0 80 70" class="gh gh-law" aria-hidden="true">
      {DEFS}
      <path d="M0 63Q22 58 44 62T80 60V70H0Z" fill="#2fbf5a" opacity=".22" />
      <g class="gh-lawsway">
        <path d="M40 54Q38 46 40 34" stroke="#1f8a3a" stroke-width="2.2" fill="none" stroke-linecap="round" />
        <path d="M40 46Q31 44 24 38" stroke="#1f8a3a" stroke-width="1.5" fill="none" stroke-linecap="round" /><path d="M40 43Q49 41 56 35" stroke="#1f8a3a" stroke-width="1.5" fill="none" stroke-linecap="round" />
        <Leaf x={40} y={35} s={0.74} /><Leaf x={23} y={39} s={0.5} rot={-48} dark /><Leaf x={57} y={36} s={0.5} rot={48} dark />
      </g>
      <rect x="22" y="53" width="36" height="9" rx="1.500" fill="#5b4bd6" /><rect x="22" y="53" width="36" height="2.400" rx="1.200" fill="#8a7bff" /><rect x="25" y="56.500" width="30" height="1.200" fill="#fff" opacity=".55" /><rect x="25" y="59" width="22" height="1.200" fill="#fff" opacity=".4" />
    </svg>
  );
}

/** Three big leaves on a soft green gradient that glows; the leaves wiggle when tapped. */
export function LawScene({ m, hint, msg }: { m: MarketRow; hint: "yes" | "no" | null | undefined; msg: Messages }) {
  const [go, setGo] = useState(0);
  const tap = () => { setGo((n) => n + 1); };
  const cap = String((m.params as { label?: string }).label ?? msg.tabs.law);
  return (
    <div class={`mscene tick house law ${hint === "yes" ? "s-yes" : hint === "no" ? "s-no" : ""}`}>
      <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice" onClick={tap} aria-hidden="true">
        {DEFS}
        <defs>
          <linearGradient id="lw-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d7a45" /><stop offset="1" stop-color="#0f4a2a" /></linearGradient>
          <radialGradient id="lw-glow" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#d8ff7a" stop-opacity=".4" /><stop offset="1" stop-color="#6fe05a" stop-opacity="0" /></radialGradient>
        </defs>
        <rect width="320" height="84" fill="url(#lw-bg)" />
        <rect class="lw-glow" width="320" height="84" fill="url(#lw-glow)" />
        <g class={`lw-front ${go ? "go" : ""}`} key={go}>
          <Leaf x={72} y={62} s={0.8} rot={-14} cls="lw-leaf l1" /><Leaf x={160} y={66} s={0.98} rot={0} cls="lw-leaf l2" /><Leaf x={248} y={62} s={0.8} rot={14} cls="lw-leaf l3" />
        </g>
      </svg>
      <b>{cap}</b>
    </div>
  );
}
