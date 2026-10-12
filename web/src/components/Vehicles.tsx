
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
