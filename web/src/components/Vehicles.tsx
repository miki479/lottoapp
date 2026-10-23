import { Flame } from "./Flame.tsx";

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
      <path d="M3 12H44.500V13.300Q44.500 14 43.800 14H3.700Q3 14 3 13.300Z" fill="#1c212b" /><rect x="7" y="13.300" width="9" height="1.500" rx=".7" fill="#1c212b" /><rect x="30" y="13.300" width="9" height="1.500" rx=".7" fill="#1c212b" />
    </svg>
  );
}

/** Intercity "Blues" hybrid train: white/grey body, blue lower band and nose with a sharp angular front, facing right. Same size contract as TrainSide. */
export function IntercitySide(p: P) {
  const h = p.size ?? 24;
  return (
    <svg width={h * 3} height={h} viewBox="0 0 48 16" class={p.class} style={p.style} aria-hidden="true">
      <path d="M2 4.200Q2 2 4.200 2H31L41 3.600Q44 4.200 45 6.800L46.600 11.400Q46.800 12 46 12H4.200Q2 12 2 9.800Z" fill="#e9edf2" />
      <path d="M2 7.600H30L36 12H4.200Q2 12 2 9.800Z" fill="#1f6fe0" />
      <path d="M30 7.600H38.500L45.600 9.600L46.600 11.400Q46.800 12 46 12H36Z" fill="#1f6fe0" />
      <path d="M33.500 3.400H40.400Q43 3.800 43.800 6.200H34.200Z" fill="#1c212b" />
      <g fill="#1c212b"><rect x="5" y="3.800" width="3.600" height="2.600" rx=".6" /><rect x="10" y="3.800" width="3.600" height="2.600" rx=".6" /><rect x="15" y="3.800" width="3.600" height="2.600" rx=".6" /><rect x="20" y="3.800" width="3.600" height="2.600" rx=".6" /><rect x="25" y="3.800" width="3.600" height="2.600" rx=".6" /></g>
      <path d="M2.600 5.900H31" stroke="#9aa6b5" stroke-width=".8" />
      <path d="M3 12H44.500V13.300Q44.500 14 43.800 14H3.700Q3 14 3 13.300Z" fill="#1c212b" /><rect x="7" y="13.300" width="9" height="1.500" rx=".7" fill="#1c212b" /><rect x="30" y="13.300" width="9" height="1.500" rx=".7" fill="#1c212b" />
    </svg>
  );
}

/** Urban train (S-Bahn / U-Bahn / metro): two short cars joined by a gangway, facing right. Same size contract as TrainSide (`size` is the height, the width is 3x). */
export function MetroSide(p: P) {
  const h = p.size ?? 24;
  return (
    <svg width={h * 3} height={h} viewBox="0 0 48 16" class={p.class} style={p.style} aria-hidden="true">
      <path d="M1.500 4.400Q1.500 2.200 3.700 2.200H21.300Q23.500 2.200 23.500 4.400V11.200H1.500Z" fill="#e2332b" />
      <path d="M25 4.400Q25 2.200 27.200 2.200H37C41.800 2.200 44.600 5.200 46.800 9.600Q47.200 10.600 46.400 11H25Z" fill="#e2332b" />
      <rect x="23.300" y="5" width="2" height="5.600" rx=".6" fill="#1c212b" />
      <g fill="#1c212b"><rect x="3.200" y="4" width="4" height="3.200" rx=".7" /><rect x="8.600" y="4" width="4" height="3.200" rx=".7" /><rect x="14" y="4" width="4" height="3.200" rx=".7" /><rect x="26.700" y="4" width="4" height="3.200" rx=".7" /><rect x="32.100" y="4" width="4" height="3.200" rx=".7" /><path d="M38 4h2.600C42.400 4.400 43.600 6 44.600 7.200H38z" /></g>
      <path d="M1.500 8.600H23.500M25 8.600H46.800" stroke="#fff" stroke-width="1" opacity=".85" />
      <path d="M19.600 4v6.800M30.600 4v6.800" stroke="#9c1f1a" stroke-width=".7" />
      <path d="M2.500 11.200H22.500V12.400Q22.500 13 21.900 13H3.100Q2.500 13 2.500 12.400Z" fill="#1c212b" /><path d="M26 11H45.500V12.400Q45.500 13 44.900 13H26.600Q26 13 26 12.400Z" fill="#1c212b" />
      <rect x="6" y="13" width="7" height="1.300" rx=".6" fill="#1c212b" /><rect x="31" y="13" width="7" height="1.300" rx=".6" fill="#1c212b" />
    </svg>
  );
}

/** Which train drawing a question gets: the two-car urban train for S/U/M lines (Berlin S7, U9, Helsinki M1…), the long one otherwise. */
export const isIntercityLine = (routeName: unknown) => /^(IC|ICN)\b/i.test(String(routeName ?? "").trim());
export const isMetroLine = (routeName: unknown) => /^[SUM]\d/i.test(String(routeName ?? ""));

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

/* ---- chip pictures: big, see-through, full of detail; each fills the whole chip ---- */

/** Amber city bus on a road, side view. */
export function BusGhost() {
  return (
    <svg viewBox="0 0 80 70" class="gh gh-veh" aria-hidden="true">
      <defs><linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc94d" /><stop offset="1" stop-color="#f59a00" /></linearGradient></defs>
      <rect x="0" y="57" width="80" height="2.500" rx="1.200" fill="#8a96ad" opacity=".7" /><path d="M4 62h12M26 62h12M48 62h12M68 62h8" stroke="#8a96ad" stroke-width="1.400" stroke-linecap="round" opacity=".6" />
      <g class="veh">
      <rect x="22" y="14" width="14" height="5" rx="2" fill="#d98200" />
      <path d="M6 24Q6 17 13 17H62Q70 17 73 26L75 40V51Q75 54 72 54H9Q6 54 6 51Z" fill="url(#gb)" />
      <path d="M6 43H75" stroke="#fff" stroke-width="1.800" opacity=".75" /><path d="M6 47H75" stroke="#d98200" stroke-width="1.200" opacity=".6" />
      <g fill="#1c2a44" opacity=".9"><rect x="10" y="22" width="9" height="11" rx="1.800" /><rect x="21" y="22" width="9" height="11" rx="1.800" /><rect x="32" y="22" width="9" height="11" rx="1.800" /><rect x="43" y="22" width="9" height="11" rx="1.800" /><path d="M55 22h8c4 0 6 3 7 11H55z" /></g>
      <g fill="#fff" opacity=".35"><path d="M11 23l4 0l-5 9h-0z" /><path d="M22 23l4 0l-5 9h0z" /></g>
      <rect x="55" y="34" width="1.600" height="17" fill="#d98200" opacity=".7" />
      <circle cx="73" cy="46" r="2" fill="#fff6c2" /><rect x="6" y="48" width="3" height="3" rx="1" fill="#e5484d" />
      <g fill="#1c212b"><circle cx="22" cy="54" r="7" /><circle cx="58" cy="54" r="7" /></g><g fill="#c9d3e6"><circle cx="22" cy="54" r="3" /><circle cx="58" cy="54" r="3" /></g>
      </g>
    </svg>
  );
}

/** Red high-speed train on rails, side view. */
export function TrainGhost() {
  return (
    <svg viewBox="0 0 80 70" class="gh gh-veh" aria-hidden="true">
      <defs><linearGradient id="gt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0483f" /><stop offset="1" stop-color="#c91f1a" /></linearGradient></defs>
      <rect x="0" y="58" width="80" height="2" fill="#8a96ad" opacity=".75" /><path d="M2 61.500h76" stroke="#8a96ad" stroke-width="1.200" stroke-dasharray="3 3" opacity=".6" />
      <g class="veh">
      <path d="M2 28Q2 21 9 21H46C60 21 70 29 78 42Q79 44 77 44.500V50Q77 53 74 53H6Q2 53 2 49Z" fill="url(#gt)" />
      <path d="M2 41H77" stroke="#fff" stroke-width="2.200" opacity=".85" />
      <g fill="#1c2a44" opacity=".92"><rect x="8" y="26" width="8" height="9" rx="1.800" /><rect x="18" y="26" width="8" height="9" rx="1.800" /><rect x="28" y="26" width="8" height="9" rx="1.800" /><path d="M42 26h8c7 1 13 5 18 12H42z" /></g>
      <path d="M44 22l-5-6h-10" stroke="#8a96ad" stroke-width="1.600" fill="none" stroke-linecap="round" opacity=".8" />
      <g fill="#fff" opacity=".3"><path d="M9 27h4l-5 8h-0z" /><path d="M19 27h4l-5 8h0z" /></g>
      <rect x="73" y="45" width="3" height="3" rx="1" fill="#fff6c2" />
      <path d="M5 50H75V54Q75 56 73 56H7Q5 56 5 54Z" fill="#2a2f3a" /><g fill="#1c212b"><rect x="9" y="54" width="14" height="3" rx="1" /><rect x="52" y="54" width="14" height="3" rx="1" /></g>
      </g>
    </svg>
  );
}

/** Layered rain clouds with a peeking sun. Drops fall on hover or tap; a bolt flashes once on tap. */
export function CloudRainGhost() {
  return (
    <svg viewBox="0 0 80 70" class="gh gh-cloud" aria-hidden="true">
      <defs><linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9db6ee" /><stop offset="1" stop-color="#6f8fd8" /></linearGradient></defs>
      <circle cx="58" cy="16" r="10" fill="#ffd23f" opacity=".85" /><path d="M58 1v3M72 8l-2 2M76 22h-3M44 8l2 2" stroke="#ffd23f" stroke-width="2" stroke-linecap="round" opacity=".7" />
      <g fill="#b9c9f2"><circle cx="24" cy="26" r="9" /><circle cx="35" cy="20" r="11" /><circle cx="48" cy="26" r="8" /><rect x="16" y="26" width="39" height="9" rx="4.500" /></g>
      <g fill="url(#gc)"><circle cx="18" cy="36" r="10" /><circle cx="31" cy="29" r="13" /><circle cx="46" cy="35" r="10" /><circle cx="58" cy="38" r="7" /><rect x="10" y="36" width="54" height="11" rx="5.500" /></g>
      <g class="gh-drops" stroke="#3f66c0" stroke-width="2.400" stroke-linecap="round"><path d="M16 52v7" /><path d="M25 52v8" /><path d="M34 52v7" /><path d="M43 52v8" /><path d="M52 52v7" /><path d="M60 52v6" /><path d="M20 60v6" /><path d="M38 61v6" /><path d="M56 60v6" /></g>
      <path class="gh-bolt" d="M37 34l-9 15h7l-4 15 13-19h-8z" fill="#ffd23f" stroke="#fff4b0" stroke-width=".8" />
    </svg>
  );
}

/** A little wood: two trees, a bush and a hill. The wind sways the trees and takes leaves with it. */
export function TreeGhost() {
  return (
    <svg viewBox="0 0 80 70" class="gh gh-tree" aria-hidden="true">
      <defs><radialGradient id="gtree" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#6fcf6a" /><stop offset="1" stop-color="#2f8f43" /></radialGradient></defs>
      <path d="M0 62Q22 50 44 58T80 54V70H0Z" fill="#6fae5b" opacity=".8" /><path d="M0 66Q30 58 80 64V70H0Z" fill="#8a5a36" opacity=".6" />
      <g class="gh-sway">
        <rect x="21" y="34" width="5" height="26" rx="2.500" fill="#8a5a36" /><path d="M23 48l-7-6M23 44l8-7" stroke="#8a5a36" stroke-width="2.400" stroke-linecap="round" />
        <g fill="url(#gtree)"><circle cx="23" cy="22" r="14" /><circle cx="11" cy="31" r="9" /><circle cx="35" cy="31" r="9" /></g>
        <g fill="#a8e68f" opacity=".5"><circle cx="18" cy="17" r="4" /><circle cx="29" cy="25" r="3" /></g>
      </g>
      <g class="gh-sway gh-sway2">
        <rect x="55" y="42" width="4" height="18" rx="2" fill="#8a5a36" />
        <g fill="url(#gtree)"><circle cx="57" cy="34" r="10" /><circle cx="48" cy="41" r="7" /><circle cx="66" cy="41" r="7" /></g>
      </g>
      <g fill="#3f9a4f"><circle cx="40" cy="60" r="5" /><circle cx="46" cy="61" r="4" /><circle cx="74" cy="59" r="4.500" /></g>
      <g class="gh-leaves" fill="#8fd47a"><ellipse class="l1" cx="23" cy="24" rx="2.800" ry="1.600" /><ellipse class="l2" cx="34" cy="30" rx="2.800" ry="1.600" /><ellipse class="l3" cx="14" cy="28" rx="2.800" ry="1.600" /><ellipse class="l4" cx="57" cy="34" rx="2.800" ry="1.600" /><ellipse class="l5" cx="48" cy="40" rx="2.800" ry="1.600" /><ellipse class="l6" cx="28" cy="18" rx="2.800" ry="1.600" /><ellipse class="l7" cx="63" cy="38" rx="2.800" ry="1.600" /></g>
    </svg>
  );
}

/** A small crowd on strike: flags and a placard. The flags wave and the placard bobs on hover or tap. */
export function StrikeGhost() {
  return (
    <svg viewBox="0 0 80 70" class="gh gh-strike" aria-hidden="true">
      <path d="M0 62Q22 54 44 60T80 57V70H0Z" fill="#6fae5b" opacity=".75" /><path d="M0 67Q30 61 80 66V70H0Z" fill="#8a5a36" opacity=".55" />
      <g class="gh-p1">
        <rect x="17.500" y="8" width="2" height="38" rx="1" fill="#8a5a36" />
        <path class="gh-flag" d="M19.500 9h22q-5 6 0 12h-22z" fill="#e5484d" />
        <path d="M14 36l5 -4l4 -10" stroke="#f1c9a5" stroke-width="3.200" stroke-linecap="round" fill="none" />
        <rect x="11" y="38" width="16" height="22" rx="7" fill="#3b6fd4" /><circle cx="19" cy="31" r="6.500" fill="#f1c9a5" /><path d="M13 29q6-8 12 0" fill="#5a3b24" />
      </g>
      <g class="gh-p2">
        <g class="gh-sign"><rect x="31" y="6" width="22" height="16" rx="2" fill="#fff" stroke="#8a96ad" stroke-width="1.200" /><path d="M35 12h14M35 17h9" stroke="#d8322b" stroke-width="2.400" stroke-linecap="round" /><rect x="41.200" y="22" width="1.800" height="14" fill="#8a5a36" /></g>
        <path d="M36 42l5 -6l2 -3" stroke="#e8b48c" stroke-width="3.200" stroke-linecap="round" fill="none" />
        <rect x="32" y="40" width="17" height="21" rx="7" fill="#f59a00" /><circle cx="40.500" cy="34" r="6.500" fill="#e8b48c" /><path d="M34 32q6.500-8 13 0" fill="#2a2f3a" />
      </g>
      <g class="gh-p3">
        <rect x="62.500" y="10" width="2" height="36" rx="1" fill="#8a5a36" />
        <path class="gh-flag gh-flag2" d="M64.500 11h-17q4 6 0 12h17z" fill="#d8322b" />
        <path d="M68 38l-4 -4l-1 -12" stroke="#f1c9a5" stroke-width="3.200" stroke-linecap="round" fill="none" />
        <rect x="56" y="40" width="16" height="20" rx="7" fill="#3f9a4f" /><circle cx="64" cy="33" r="6.500" fill="#f1c9a5" /><path d="M58 31q6-8 12 0" fill="#c98a3a" />
      </g>
    </svg>
  );
}

/** Cripto: a gold coin and a chart that climbs. The coin spins and the line draws itself on hover or tap. */
export function CryptoGhost() {
  return (
    <svg viewBox="0 0 80 70" class="gh gh-crypto" aria-hidden="true">
      <path d="M0 62Q22 56 44 61T80 59V70H0Z" fill="#c98f1e" opacity=".35" />
      <g class="gh-bars"><rect x="10" y="44" width="9" height="16" rx="2" fill="#f2b01e" opacity=".7" /><rect x="22" y="36" width="9" height="24" rx="2" fill="#f2b01e" opacity=".8" /><rect x="34" y="40" width="9" height="20" rx="2" fill="#f2b01e" opacity=".7" /></g>
      <path class="gh-line" d="M8 46L24 34L36 40L56 16L68 20" stroke="#2e9e6b" stroke-width="3.400" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      <path class="gh-arrow" d="M60 14L69 19L62 26" stroke="#2e9e6b" stroke-width="3.400" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      <g class="gh-coin"><circle cx="58" cy="46" r="13" fill="#f7b733" stroke="#c98f1e" stroke-width="2.200" /><circle cx="58" cy="46" r="9" fill="none" stroke="#c98f1e" stroke-width="1.400" opacity=".7" /><path d="M54 40h6a3.600 3.600 0 0 1 0 7h-6zm0 7h7a3.600 3.600 0 0 1 0 7h-7zM57 38v2M60 38v2M57 54v2M60 54v2" stroke="#8a5d0a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" /></g>
    </svg>
  );
}

/** Games: a see-through console pad and a chess pawn. The buttons blink in turn and the pawn hops on hover or tap. */
export function GamesGhost() {
  return (
    <svg viewBox="0 0 80 70" class="gh gh-games" aria-hidden="true">
      <path d="M0 62Q22 56 44 61T80 59V70H0Z" fill="#e0527a" opacity=".22" />
      <g class="gh-pad" transform="translate(22 14) scale(1.350)"><path d="M6 2h24c4 0 6 2 8 8l3 9c1 4-1 6-4 6-3 0-4-2-6-5H9c-2 3-3 5-6 5-3 0-5-2-4-6l3-9c2-6 4-8 8-8z" fill="#3a4152" stroke="#fff" stroke-width="1.100" stroke-opacity=".55" /><path d="M10 9v7M6.500 12.500h7" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".9" /><circle class="gh-btn b1" cx="30" cy="9" r="1.800" fill="#5ad07a" /><circle class="gh-btn b2" cx="34" cy="12.500" r="1.800" fill="#ff5a6a" /><circle class="gh-btn b3" cx="26" cy="12.500" r="1.800" fill="#4aa8ff" /><circle class="gh-btn b4" cx="30" cy="16" r="1.800" fill="#ffd54a" /><circle cx="15" cy="18" r="2.200" fill="#222836" stroke="#fff" stroke-width=".7" stroke-opacity=".5" /><circle cx="25" cy="18" r="2.200" fill="#222836" stroke="#fff" stroke-width=".7" stroke-opacity=".5" /></g>
      <g class="gh-pawn" transform="translate(44 6) scale(1.450)"><circle cx="9" cy="47" r="3.200" fill="#f2f5ff" stroke="#2a2f3a" stroke-width="1.200" /><path d="M6.500 51.500h5c.5 3 2 5 2.500 7H4c.5-2 2-4 2.500-7z" fill="#f2f5ff" stroke="#2a2f3a" stroke-width="1.200" stroke-linejoin="round" /><rect x="2.500" y="58" width="13" height="2.600" rx="1.300" fill="#2a2f3a" /></g>
    </svg>
  );
}

/** Space & Earth: a ringed planet, a few stars and a rocket on its pad. The rocket lights up and climbs on hover or tap, then comes back. */
export function SpaceGhost() {
  return (
    <svg viewBox="0 0 80 70" class="gh gh-space" aria-hidden="true">
      <path d="M0 62Q22 57 44 61T80 59V70H0Z" fill="#4a6cf0" opacity=".25" />
      <g fill="#fff" opacity=".85"><circle class="gh-tw a" cx="10" cy="12" r="1.200" /><circle class="gh-tw b" cx="30" cy="6" r="1" /><circle class="gh-tw c" cx="66" cy="10" r="1.200" /><circle class="gh-tw b" cx="72" cy="30" r="1" /><circle class="gh-tw a" cx="16" cy="34" r="1" /></g>
      <g class="gh-p2"><circle cx="13" cy="22" r="4.500" fill="#ff8f6b" /><path d="M10 21q3-2 6 0" stroke="#fff" stroke-width=".9" fill="none" opacity=".4" /></g>
      <g class="gh-p3"><circle cx="46" cy="9" r="2.800" fill="#5fd0b4" /></g>
      <g class="gh-planet"><circle cx="58" cy="26" r="11" fill="#7d6bff" /><path d="M50 22q8-5 16 0" stroke="#fff" stroke-width="1.200" fill="none" opacity=".35" /><ellipse cx="58" cy="28" rx="19" ry="4.500" fill="none" stroke="#ffb86b" stroke-width="2.200" transform="rotate(-18 58 28)" /></g>
      <g class="gh-moon"><circle cx="58" cy="10" r="2" fill="#e8ecf5" /></g>
      <g class="gh-rocket"><path d="M30 14c-6 7-6 21-6 29h12c0-8 0-22-6-29z" fill="#ffffff" stroke="#3b4a8a" stroke-width="1.600" stroke-linejoin="round" /><path d="M30 14c-3 3-5 7-5.500 12h11C35 21 33 17 30 14z" fill="#ff5a4d" /><circle cx="30" cy="31" r="3.200" fill="#4a7bff" /><path d="M24 38l-6 8 6-2zM36 38l6 8-6-2z" fill="#ff5a4d" stroke="#3b4a8a" stroke-width="1.200" stroke-linejoin="round" /><g class="gh-fpos" transform="translate(30 43) scale(.55)"><g class="gh-fire"><Flame /></g></g></g>
      <rect x="20" y="58" width="20" height="3" rx="1.500" fill="#2a2f3a" opacity=".55" />
    </svg>
  );
}

/** Cultura: a clapperboard and a popcorn bucket. The clapper snaps shut on hover or tap. */
export function CultureGhost() {
  return (
    <svg viewBox="0 0 80 70" class="gh gh-culture" aria-hidden="true">
      <path d="M0 62Q22 56 44 61T80 59V70H0Z" fill="#8a5ad8" opacity=".25" />
      <g class="gh-board"><rect x="8" y="30" width="40" height="28" rx="3" fill="#2a2f3a" /><path d="M8 38h40" stroke="#fff" stroke-width="1.600" opacity=".6" /><path d="M14 44h12M14 50h20" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7" /></g>
      <g class="gh-clap"><rect x="8" y="22" width="40" height="9" rx="2" fill="#2a2f3a" /><path d="M12 22l7 9M22 22l7 9M32 22l7 9M42 22l6 8" stroke="#fff" stroke-width="3.600" stroke-linecap="round" opacity=".9" /></g>
      <g class="gh-pop"><path d="M54 36h20l-3 24H57z" fill="#e5484d" /><path d="M58 36l1 24M64 36v24M70 36l-1 24" stroke="#fff" stroke-width="2" opacity=".85" /><g fill="#fff3c4"><circle cx="58" cy="32" r="4.500" /><circle cx="65" cy="29" r="5" /><circle cx="71" cy="33" r="4.200" /><circle cx="62" cy="34" r="4" /></g></g>
    </svg>
  );
}

/** Sport: a pitch corner with a goal and a ball. The ball is kicked into the net on hover or tap. */
/** A proper football: shaded sphere, black centre patch, spokes, rim patches clipped by the outline, seams, highlight. Centred on 0,0. */
function SoccerBall({ r }: { r: number }) {
  const pent = (cx: number, cy: number, pr: number, rot: number) => Array.from({ length: 5 }, (_, i) => { const a = rot + (i * 2 * Math.PI) / 5; return [cx + pr * Math.sin(a), cy - pr * Math.cos(a)] as const; });
  const pts = (v: readonly (readonly [number, number])[]) => v.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const centre = pent(0, 0, r * 0.37, 0);
  const rim = Array.from({ length: 5 }, (_, i) => { const a = (i * 2 * Math.PI) / 5; const c: [number, number] = [Math.sin(a) * r * 0.88, -Math.cos(a) * r * 0.88]; return { a, v: pent(c[0], c[1], r * 0.31, a + Math.PI) }; });
  const seams: string[] = [];
  rim.forEach(({ a, v }, i) => {
    seams.push(`M${centre[i]![0].toFixed(2)} ${centre[i]![1].toFixed(2)}L${v[0]![0].toFixed(2)} ${v[0]![1].toFixed(2)}`); // spoke: centre patch to rim patch
    for (const [k, d] of [[2, -1], [3, 1]] as const) { const ang = a + d * (Math.PI / 5); seams.push(`M${v[k]![0].toFixed(2)} ${v[k]![1].toFixed(2)}L${(Math.sin(ang) * r).toFixed(2)} ${(-Math.cos(ang) * r).toFixed(2)}`); }
  });
  return (
    <g>
      <defs>
        <radialGradient id="sg-ball" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="#ffffff" /><stop offset=".55" stop-color="#eef2f8" /><stop offset="1" stop-color="#b9c3d3" /></radialGradient>
        <clipPath id="sg-clip"><circle r={r} /></clipPath>
      </defs>
      <circle r={r} fill="url(#sg-ball)" />
      <g clip-path="url(#sg-clip)">
        <path d={seams.join("")} stroke="#1d2433" stroke-width={r * 0.085} stroke-linecap="round" fill="none" opacity=".8" />
        {rim.map(({ v }, i) => <polygon key={i} points={pts(v)} fill="#1d2433" stroke="#1d2433" stroke-width=".3" stroke-linejoin="round" />)}
        <polygon points={pts(centre)} fill="#1d2433" stroke="#1d2433" stroke-width=".3" stroke-linejoin="round" />
        <ellipse cx={-r * 0.32} cy={-r * 0.4} rx={r * 0.3} ry={r * 0.17} fill="#fff" opacity=".7" transform={`rotate(-35 ${-r * 0.32} ${-r * 0.4})`} />
      </g>
      <circle r={r} fill="none" stroke="#1d2433" stroke-width={r * 0.11} />
    </g>
  );
}

/** Calcio: a detailed ball on striped grass in front of a goal with a net in perspective. The ball is kicked into the net on hover or tap. */
export function SportGhost() {
  const mesh = [];
  for (let x = 52.5; x <= 71; x += 3.1) mesh.push(`M${x.toFixed(1)} 26.5V53`);
  for (let y = 26.5; y <= 53; y += 3.5) mesh.push(`M50.5 ${y.toFixed(1)}H73`);
  return (
    <svg viewBox="0 0 80 70" class="gh gh-sport" aria-hidden="true">
      <path d="M0 58Q20 54 40 56T80 55V70H0Z" fill="#2e9e6b" opacity=".75" />
      <path d="M0 62Q22 59 44 61T80 60V70H0Z" fill="#3cb07a" opacity=".75" />
      <path d="M0 66Q26 64 52 65T80 64.500V70H0Z" fill="#2e9e6b" opacity=".85" />
      <path d="M6 57Q40 52 74 56" stroke="#f4f7fb" stroke-width="1" fill="none" opacity=".55" />
      <g class="gh-goal">
        <path d="M50.500 26.500H73V53H50.500Z" fill="#0f5c3a" opacity=".22" />
        <path class="gh-net" d={mesh.join("")} stroke="#f4f7fb" stroke-width=".7" opacity=".85" fill="none" />
        <path class="gh-net" d="M45.500 20L50.500 26.500M77 20L73 26.500M45.500 57L50.500 53M77 57L73 53" stroke="#f4f7fb" stroke-width=".7" opacity=".7" fill="none" />
        <path d="M45.500 57V20H77V57" stroke="#1d2433" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".18" />
        <path d="M45.500 57V20H77V57" stroke="#f7f9fc" stroke-width="2.800" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M46.700 22H75.800" stroke="#c4cddb" stroke-width=".8" opacity=".8" />
      </g>
      <ellipse cx="17" cy="63" rx="9" ry="2" fill="#000" opacity=".2" />
      <g class="gh-ball"><g transform="translate(17 54)"><SoccerBall r={9} /></g></g>
    </svg>
  );
}

/** One detailed little car seen from the side, facing right: two-tone body, window pillars, door and handle, mirror, lights, arches, hubcaps. */
function SideCar({ x, col, kind, k }: { x: number; col: string; kind: "sedan" | "hatch" | "taxi"; k: number }) {
  const r0 = kind === "hatch" ? 6.5 : 9, r1 = kind === "hatch" ? 21 : 20.5, rY = kind === "hatch" ? 31.6 : 32.4, mid = (r0 + r1) / 2 + 0.6;
  const body = `M1 48V43.5Q1 41.4 3.200 40.900L${r0 - 2} 40L${r0} ${rY + 1.500}Q${r0 + 0.800} ${rY} ${r0 + 2.200} ${rY}H${r1 - 2}Q${r1 - 0.400} ${rY} ${r1 + 0.800} ${rY + 1.200}L${r1 + 3} 40L23.400 40.800Q26 41.500 26 43.800V48Z`;
  const glass = `M${r0 + 1.400} 39.400L${r0 + 2.600} ${rY + 2}Q${r0 + 3} ${rY + 1.200} ${r0 + 3.800} ${rY + 1.200}H${r1 - 3}Q${r1 - 2} ${rY + 1.200} ${r1 - 1.400} ${rY + 2.200}L${r1 + 0.400} 39.400Z`;
  return (
    <g class={`gh-car c${k}`} transform={`translate(${x} 3) scale(.9)`}>
      <ellipse cx="13.500" cy="52.500" rx="12.500" ry="1.800" fill="#000" opacity=".16" />
      <path d={body} fill={col} /><path d="M1 44.600H26V48H1Z" fill="#000" opacity=".16" />
      <path d={glass} fill="#cfe6fa" /><path d={glass} fill="#1c2a44" opacity=".25" />
      <path d={`M${mid} ${rY + 1.200}V39.600`} stroke={col} stroke-width="1.500" />
      <path d={`M${mid + 0.800} 40.600V46.400`} stroke="#000" stroke-width=".7" opacity=".3" /><rect x={mid + 1.400} y="42" width="3" height="1" rx=".5" fill="#fff" opacity=".8" />
      <rect x={r1 + 1} y="38.400" width="1.800" height="1.300" rx=".5" fill={col} /><rect x="1" y="42" width="1.300" height="2.400" rx=".5" fill="#ff3b30" /><rect class="gh-brake" x="0.600" y="42.200" width="1.700" height="2.200" rx=".6" fill="#ff3b30" />
      <path d="M24.600 42.200Q26 42.400 26 43.800V44.600H24.600Z" fill="#fff6c2" /><rect x="0.800" y="46.600" width="25.200" height="1.600" rx=".8" fill="#2a2f3a" opacity=".55" />
      {kind === "taxi" && <g><rect x={(r0 + r1) / 2 - 1.800} y={rY - 2.400} width="5.200" height="2.400" rx=".6" fill="#ffe36a" stroke="#2a2f3a" stroke-width=".5" /></g>}
      <g><path d="M3.600 48.500A3.700 3.700 0 0 1 11 48.500Z" fill="#15121f" /><path d="M16.200 48.500A3.700 3.700 0 0 1 23.600 48.500Z" fill="#15121f" /></g>
      <circle cx="7.300" cy="49" r="3.300" fill="#1a1c25" /><circle cx="7.300" cy="49" r="1.600" fill="#c9d0de" /><circle cx="19.900" cy="49" r="3.300" fill="#1a1c25" /><circle cx="19.900" cy="49" r="1.600" fill="#c9d0de" />
    </g>
  );
}

/** Traffico: a short queue of detailed cars with brake lights. The cars creep forward and the lights blink on hover or tap. */
export function TrafficGhost() {
  return (
    <svg viewBox="0 0 80 70" class="gh gh-traffic" aria-hidden="true">
      <g fill="#8a96ad" opacity=".5"><rect x="4" y="8" width="10" height="26" /><rect x="17" y="2" width="12" height="32" /><rect x="33" y="12" width="10" height="22" /><rect x="48" y="4" width="12" height="30" /><rect x="64" y="14" width="10" height="20" /></g>
      <g fill="#fff" opacity=".35"><rect x="6" y="12" width="2" height="2" /><rect x="10" y="12" width="2" height="2" /><rect x="19" y="8" width="2" height="2" /><rect x="24" y="8" width="2" height="2" /><rect x="50" y="10" width="2" height="2" /><rect x="55" y="10" width="2" height="2" /></g>
      <rect x="0" y="54" width="80" height="14" fill="#5f6675" opacity=".6" /><rect x="0" y="54" width="80" height="1.600" fill="#8e96a8" opacity=".7" /><path d="M0 61H80" stroke="#fff" stroke-width="2" stroke-dasharray="7 6" opacity=".7" />
      <g class="gh-cars"><SideCar x={1} col="#e5484d" kind="sedan" k={0} /><SideCar x={27} col="#3b6fd4" kind="hatch" k={1} /><SideCar x={53} col="#f2b01e" kind="taxi" k={2} /></g>
    </svg>
  );
}

/** Governo: a columned building with a flag. The flag waves on hover or tap. */
export function GovGhost() {
  return (
    <svg viewBox="0 0 80 70" class="gh gh-gov" aria-hidden="true">
      <path d="M0 62Q22 56 44 61T80 59V70H0Z" fill="#5b6b8a" opacity=".3" />
      <path d="M12 30L40 14L68 30z" fill="#5b6b8a" /><rect x="14" y="30" width="52" height="4" fill="#8a96ad" />
      <g fill="#cfd6e4"><rect x="18" y="35" width="6" height="22" /><rect x="29" y="35" width="6" height="22" /><rect x="45" y="35" width="6" height="22" /><rect x="56" y="35" width="6" height="22" /></g>
      <rect x="12" y="57" width="56" height="5" rx="1" fill="#8a96ad" />
      <rect x="21" y="8" width="2" height="14" fill="#8a5a36" /><path class="gh-flag" d="M23 9h14q-3 4 0 8H23z" fill="#e5484d" />
    </svg>
  );
}

/** Aerei: a passenger jet seen from the side (windows, cockpit, engine under a swept wing, blue tail) over a runway and a few clouds. It banks and crosses on hover or tap, then comes back. */
export function PlaneGhost() {
  return (
    <svg viewBox="0 0 80 70" class="gh gh-flights" aria-hidden="true">
      <defs>
        <linearGradient id="gpf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" /><stop offset="1" stop-color="#cdd9ee" /></linearGradient>
        <linearGradient id="gpt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d8cf0" /><stop offset="1" stop-color="#2459c4" /></linearGradient>
      </defs>
      <rect x="0" y="62" width="80" height="2" fill="#8a96ad" opacity=".75" /><path d="M2 65.500h76" stroke="#8a96ad" stroke-width="1.200" stroke-dasharray="4 3" opacity=".6" />
      <g class="gh-cloud" fill="#fff" opacity=".92"><ellipse cx="14" cy="52" rx="10" ry="4" /><ellipse cx="23" cy="50" rx="8" ry="4.500" /><ellipse cx="64" cy="12" rx="9" ry="3.600" /><ellipse cx="71" cy="10.500" rx="6" ry="4" /></g>
      <g class="gh-plane" transform="translate(3 6)">
        <path d="M-2 30H8M-4 33H6M0 36H9" stroke="#fff" stroke-width="1.400" stroke-linecap="round" opacity=".55" />
        <path d="M10 28L8 12h7l13 17z" fill="url(#gpt)" stroke="#1c3f8f" stroke-width=".8" stroke-linejoin="round" /><path d="M10 21h4" stroke="#fff" stroke-width="1.600" stroke-linecap="round" opacity=".85" />
        <path d="M14 33l-9 4h12l9-3z" fill="#aebfdc" stroke="#7d94bd" stroke-width=".8" stroke-linejoin="round" />
        <path d="M9 29H62Q74 29 75 34Q73 40 62 40H18Q9 40 8 33Q8 30 9 29z" fill="url(#gpf)" stroke="#8aa2c8" stroke-width="1" stroke-linejoin="round" />
        <path d="M12 38H64Q70 38 73 37.500Q70 40 62 40H18Q10 40 9 37z" fill="#5d7299" opacity=".18" />
        <path d="M11 34.500H71" stroke="#2f7de1" stroke-width="1.800" stroke-linecap="round" />
        <g fill="#3b5a8c">{Array.from({ length: 9 }, (_, i) => <rect key={i} x={18 + i * 4.300} y="31" width="2.400" height="2.800" rx=".9" />)}</g>
        <path d="M64 30.500Q69 30.500 72 33H64z" fill="#243d6b" />
        <path d="M31 38.500H49L36 57H27z" fill="#e3ebf8" stroke="#8aa2c8" stroke-width="1" stroke-linejoin="round" /><path d="M34 41h12" stroke="#9db2d6" stroke-width="1" opacity=".7" />
        <rect x="32" y="45.500" width="12" height="5.400" rx="2.700" fill="#bcc9e2" stroke="#7d94bd" stroke-width=".9" /><ellipse cx="43.200" cy="48.200" rx="1.300" ry="2.300" fill="#26365a" />
        <circle cx="8.500" cy="12.600" r="1.200" fill="#ff4d4d" /><circle cx="74" cy="34.500" r="1" fill="#fff3b0" />
      </g>
    </svg>
  );
}
