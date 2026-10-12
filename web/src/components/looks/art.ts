import { C, Metal, arc, band, f, mix, pt, ramp, sector, star } from "./geo";

/** The material of every decoration. */
const M: Record<string, Metal> = {
  copper: { d: "#4a2112", m: "#a85a32", l: "#e0905c", h: "#ffd0a8" },
  bronze: { d: "#3a2c12", m: "#8a6b2e", l: "#c4a050", h: "#ecd9a0" },
  silver: { d: "#4a5058", m: "#a9b0b8", l: "#e6eaee", h: "#ffffff" },
  gold: { d: "#6b4a05", m: "#d4a017", l: "#ffd95a", h: "#fff7c4" },
  diamond: { d: "#4c93b8", m: "#b8e8f8", l: "#eefcff", h: "#ffffff" },
  amethyst: { d: "#3b1566", m: "#8a4fd0", l: "#c79bff", h: "#f1deff" },
  platinum: { d: "#3b4a5c", m: "#9fb4c9", l: "#dbe8f5", h: "#ffffff" },
  mithril: { d: "#1d4f55", m: "#4fc2c0", l: "#a8f2e8", h: "#ecfffb" },
  orichalcum: { d: "#6b1d0a", m: "#e0501f", l: "#ffa54a", h: "#ffe9a0" },
  adamantium: { d: "#1b1040", m: "#6a3de8", l: "#ff4fd8", h: "#ffe6ff" },
  jade: { d: "#0f4a2e", m: "#2fa66a", l: "#8be0ab", h: "#e0ffe9" },
  ruby: { d: "#4a0510", m: "#c2142f", l: "#ff5a72", h: "#ffd0d8" },
  sapphire: { d: "#0a1f5c", m: "#2a5be0", l: "#6fa0ff", h: "#d6e6ff" },
  obsidian: { d: "#07070c", m: "#1c1a2a", l: "#4a3f78", h: "#b9a8ff" },
  opal: { d: "#6a7f9a", m: "#d8e6f5", l: "#fff4fb", h: "#ffffff" },
};

/** A faceted spike: two halves, one lit and one in shade, so it reads as solid. */
function spike(a: number, p: Metal, len: number, w: number, r0 = 53): string {
  const [bx, by] = pt(r0, a - w), [cx, cy] = pt(r0, a + w), [tx, ty] = pt(r0 + len, a), [mx, my] = pt(r0 - 1, a);
  const lit = ramp(p, 0.8), sh = ramp(p, 0.3), base = ramp(p, 0.55);
  return `<path d="M${f(bx)} ${f(by)}L${f(tx)} ${f(ty)}L${f(mx)} ${f(my)}Z" fill="${lit}"/><path d="M${f(cx)} ${f(cy)}L${f(tx)} ${f(ty)}L${f(mx)} ${f(my)}Z" fill="${sh}"/><path d="M${f(bx)} ${f(by)}L${f(tx)} ${f(ty)}L${f(cx)} ${f(cy)}" fill="none" stroke="${base}" stroke-width=".4"/>`;
}
/** A cut gem with four facets. */
function gem(a: number, p: Metal, s: number, r = 50): string {
  const [x, y] = pt(r, a);
  const t = [x, y - s], rr = [x + s * 0.8, y], b = [x, y + s * 1.1], l = [x - s * 0.8, y];
  const P = (q: number[]) => `${f(q[0]!)} ${f(q[1]!)}`;
  return `<path d="M${P(t)}L${P(rr)}L${f(x)} ${f(y)}Z" fill="${ramp(p, 0.95)}"/><path d="M${P(t)}L${P(l)}L${f(x)} ${f(y)}Z" fill="${ramp(p, 0.7)}"/><path d="M${P(l)}L${P(b)}L${f(x)} ${f(y)}Z" fill="${ramp(p, 0.4)}"/><path d="M${P(rr)}L${P(b)}L${f(x)} ${f(y)}Z" fill="${ramp(p, 0.15)}"/><path d="M${P(t)}L${P(rr)}L${P(b)}L${P(l)}Z" fill="none" stroke="${ramp(p, 1)}" stroke-width=".35"/>`;
}
const bead = (a: number, p: Metal, rr: number, r = 50) => { const [x, y] = pt(r, a); return `<circle cx="${f(x)}" cy="${f(y)}" r="${rr}" fill="${ramp(p, 0.4)}"/><circle cx="${f(x - rr * 0.2)}" cy="${f(y - rr * 0.2)}" r="${f(rr * 0.78)}" fill="${ramp(p, 0.7)}"/><circle cx="${f(x - rr * 0.35)}" cy="${f(y - rr * 0.4)}" r="${f(rr * 0.3)}" fill="${ramp(p, 1)}"/>`; };
/** A wing feather fan on one side. */
function wing(side: 1 | -1, p: Metal): string {
  let out = "";
  for (let i = 0; i < 5; i++) {
    const a = side * (62 + i * 11), len = 14 - i * 1.6;
    const [x0, y0] = pt(53, a - 4 * side), [x1, y1] = pt(53, a + 4 * side), [tx, ty] = pt(53 + len, a + side * 5);
    out += `<path d="M${f(x0)} ${f(y0)}Q${f(tx)} ${f(ty)} ${f(x1)} ${f(y1)}Z" fill="${ramp(p, 0.85 - i * 0.12)}" stroke="${ramp(p, 0.25)}" stroke-width=".4"/>`;
  }
  return out;
}
/** A flame lick pointing outward. */
function flame(a: number, p: Metal, len: number): string {
  const [x0, y0] = pt(52, a - 5), [x1, y1] = pt(52, a + 5), [tx, ty] = pt(52 + len, a + 6), [cx, cy] = pt(52 + len * 0.55, a - 7), [dx, dy] = pt(52 + len * 0.5, a + 9);
  return `<path d="M${f(x0)} ${f(y0)}Q${f(cx)} ${f(cy)} ${f(tx)} ${f(ty)}Q${f(dx)} ${f(dy)} ${f(x1)} ${f(y1)}Z" fill="${ramp(p, 0.55)}"/><path d="M${f(x0 + (x1 - x0) * 0.25)} ${f(y0 + (y1 - y0) * 0.25)}Q${f(cx)} ${f(cy)} ${f(tx * 0.5 + x0 * 0.5)} ${f(ty * 0.5 + y0 * 0.5)}Q${f(dx)} ${f(dy)} ${f(x1 - (x1 - x0) * 0.25)} ${f(y1 - (y1 - y0) * 0.25)}Z" fill="${ramp(p, 0.95)}"/>`;
}
/** A leaf, for the elven metal. */
function leaf(a: number, p: Metal, len: number): string {
  const [x0, y0] = pt(53, a), [tx, ty] = pt(53 + len, a + 14), [c1x, c1y] = pt(53 + len * 0.6, a - 6), [c2x, c2y] = pt(53 + len * 0.3, a + 14);
  return `<path d="M${f(x0)} ${f(y0)}Q${f(c1x)} ${f(c1y)} ${f(tx)} ${f(ty)}Q${f(c2x)} ${f(c2y)} ${f(x0)} ${f(y0)}Z" fill="${ramp(p, 0.7)}" stroke="${ramp(p, 0.2)}" stroke-width=".4"/><path d="M${f(x0)} ${f(y0)}L${f(tx)} ${f(ty)}" stroke="${ramp(p, 1)}" stroke-width=".4" fill="none"/>`;
}
const every = (n: number, off = 0) => Array.from({ length: n }, (_, i) => off + (360 / n) * i);

/** Ornaments around the ring, per decoration. */
function ornaments(id: string, p: Metal): string {
  switch (id) {
    case "copper": return every(12, 15).map((a) => bead(a, p, 1.5, 49.5)).join("");
    case "bronze": return every(10, 18).map((a) => spike(a, p, 4, 5)).join("");
    case "silver": return every(16, 11).map((a, i) => (i % 2 ? bead(a, p, 1.3, 55) : spike(a, p, 5, 4))).join("");
    case "gold": return [-50, -25, 0, 25, 50].map((a, i) => spike(a, p, i === 2 ? 11 : 8, 6)).join("") + [-37, -12, 12, 37].map((a) => spike(a, p, 4.5, 3)).join("") + gem(0, M.ruby!, 2.6, 56);
    case "diamond": return every(12, 15).map((a, i) => spike(a, p, i % 2 ? 6 : 9, 4.5)).join("") + every(6, 0).map((a) => gem(a, p, 2.4, 49.5)).join("");
    case "amethyst": return every(9, 0).map((a, i) => spike(a, p, 8 + (i % 3) * 2, 5) + spike(a + 9, p, 5, 3)).join("");
    case "platinum": return wing(1, p) + wing(-1, p) + gem(0, M.sapphire!, 2.8, 56);
    case "mithril": return every(12, 0).map((a) => leaf(a, p, 8)).join("") + every(12, 15).map((a) => leaf(a, p, 5)).join("");
    case "orichalcum": return every(10, 0).map((a, i) => flame(a, p, i % 2 ? 9 : 13)).join("");
    case "adamantium": return every(8, 0).map((a) => spike(a, p, 12, 5.5)).join("") + every(8, 22.5).map((a) => spike(a, p, 6, 3.5)).join("") + every(8, 0).map((a) => gem(a, M.ruby!, 2.2, 49.5)).join("");
    case "jade": return every(14, 0).map((a) => bead(a, p, 2.2, 55)).join("");
    case "ruby": return every(8, 0).map((a) => gem(a, p, 3.4, 54)).join("");
    case "sapphire": return every(10, 0).map((a, i) => gem(a, p, i % 2 ? 2.6 : 3.6, 54)).join("");
    case "obsidian": return every(14, 0).map((a, i) => spike(a, p, i % 2 ? 6 : 11, 3.5)).join("");
    case "opal": return every(12, 0).map((a, i) => bead(a, { ...p, d: mix("#c8a0ff", "#8fe0ff", i / 12), m: mix("#ffc0e8", "#a0ffd8", i / 12), l: "#fff8ff", h: "#ffffff" }, 2, 54.5)).join("");
    default: return "";
  }
}

/** Colour of the body for an iridescent material. */
const opalTint = (a: number) => mix(mix("#ff9ad5", "#9be8ff", (Math.sin((a * Math.PI) / 90) + 1) / 2), "#fff2a8", (Math.sin((a * Math.PI) / 60 + 1) + 1) / 4);

/** The ring: an outer rim, a body and an inner rim lit from the opposite side so the band looks bevelled and solid. */
export function decorationSvg(id: string, shines: boolean, hi: boolean): string {
  const p = M[id] ?? M.copper!;
  const n = hi ? 72 : 36;
  const tint = id === "opal" ? opalTint : undefined;
  let out = "";
  if (shines) out += `<circle cx="${C}" cy="${C}" r="56" fill="none" stroke="${p.l}" stroke-opacity=".28" stroke-width="7"/>`;
  out += ornaments(id, p);
  out += band(52.2, 55, n, p, 0, 0.12, tint);
  out += band(46.8, 52.2, n, p, 0, -0.04, tint);
  out += band(44.2, 46.8, n, p, 180, -0.1, tint);
  out += `<circle cx="${C}" cy="${C}" r="52.2" fill="none" stroke="${ramp(p, 0.15)}" stroke-width=".5" stroke-opacity=".7"/>`;
  out += `<circle cx="${C}" cy="${C}" r="44.2" fill="none" stroke="${ramp(p, 0.05)}" stroke-width=".8" stroke-opacity=".8"/>`;
  out += `<path d="${arc(49.5, 290, 350)}" fill="none" stroke="${p.h}" stroke-opacity=".55" stroke-width="1.1" stroke-linecap="round"/>`;
  if (shines) {
    out += `<g class="lk-sheen"><path d="${sector(47.5, 54.5, 0, 7)}" fill="#fff" fill-opacity=".38"/></g>`;
    for (const [i, a] of [40, 140, 230, 320].entries()) { const [x, y] = pt(51, a); out += `<path class="lk-spk lk-d${i}" d="${star(x, y, 3.2)}" fill="#fff"/>`; }
  }
  return out;
}

/** The ten cartoon characters, each drawn inside a disc of radius 43. */
const AV: Record<string, { bg: string; art: string }> = {
  conductor: { bg: "#3b6ea8", art: `<path d="M30 92Q60 70 90 92V104H30Z" fill="#c8402f"/><circle cx="60" cy="58" r="20" fill="#f6c9a0"/><path d="M38 52Q60 22 82 52Z" fill="#1f2b4d"/><rect x="36" y="48" width="48" height="7" rx="3" fill="#2d3d6e"/><circle cx="60" cy="40" r="3.5" fill="#ffd34a"/><circle cx="52" cy="62" r="2.4" fill="#222"/><circle cx="68" cy="62" r="2.4" fill="#222"/><path d="M52 71Q60 77 68 71" stroke="#8a3b2a" stroke-width="2" fill="none" stroke-linecap="round"/>` },
  busbot: { bg: "#e8a02c", art: `<rect x="32" y="38" width="56" height="44" rx="10" fill="#f4f0e6"/><rect x="38" y="46" width="44" height="20" rx="6" fill="#26405f"/><circle cx="50" cy="56" r="4" fill="#7fe3ff"/><circle cx="70" cy="56" r="4" fill="#7fe3ff"/><rect x="42" y="72" width="36" height="4" rx="2" fill="#c8402f"/><circle cx="44" cy="86" r="6" fill="#222"/><circle cx="76" cy="86" r="6" fill="#222"/><path d="M60 38V28" stroke="#f4f0e6" stroke-width="3"/><circle cx="60" cy="26" r="3.5" fill="#c8402f"/>` },
  cloud: { bg: "#4aa3df", art: `<path d="M36 74Q26 74 28 63Q30 54 40 56Q42 42 56 42Q68 40 72 52Q86 50 88 64Q90 74 78 74Z" fill="#fff"/><circle cx="52" cy="62" r="2.6" fill="#33405a"/><circle cx="68" cy="62" r="2.6" fill="#33405a"/><path d="M54 68Q60 73 66 68" stroke="#33405a" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="46" cy="67" r="3" fill="#ffb3c1" fill-opacity=".7"/><circle cx="74" cy="67" r="3" fill="#ffb3c1" fill-opacity=".7"/><path d="M48 80l-3 8M60 80l-3 8M72 80l-3 8" stroke="#bfe6ff" stroke-width="2.4" stroke-linecap="round"/>` },
  fox: { bg: "#5a8f5a", art: `<path d="M34 34L48 50L72 50L86 34L88 64Q88 86 60 90Q32 86 32 64Z" fill="#e8742c"/><path d="M48 66Q60 62 72 66Q70 84 60 88Q50 84 48 66Z" fill="#fff2e0"/><path d="M34 34L44 52L36 56Z" fill="#3a2a22"/><path d="M86 34L76 52L84 56Z" fill="#3a2a22"/><circle cx="50" cy="60" r="2.8" fill="#222"/><circle cx="70" cy="60" r="2.8" fill="#222"/><ellipse cx="60" cy="72" rx="3.6" ry="2.6" fill="#222"/>` },
  ball: { bg: "#2f8f4e", art: `<circle cx="60" cy="60" r="26" fill="#fff"/><path d="M60 46L72 55L67 69H53L48 55Z" fill="#222"/><path d="M60 46V35M72 55L82 50M67 69L74 79M53 69L46 79M48 55L38 50" stroke="#222" stroke-width="2.4" stroke-linecap="round"/><circle cx="60" cy="60" r="26" fill="none" stroke="#c9cfd6" stroke-width="1.5"/>` },
  bolt: { bg: "#5b3fc2", art: `<path d="M68 26L44 62H58L50 94L78 54H62Z" fill="#ffd93a" stroke="#ffb100" stroke-width="2" stroke-linejoin="round"/><path d="M66 32L50 58" stroke="#fff6c2" stroke-width="2.4" stroke-linecap="round"/>` },
  alien: { bg: "#202a5a", art: `<path d="M60 30Q86 30 86 58Q86 84 60 92Q34 84 34 58Q34 30 60 30Z" fill="#7be08a"/><path d="M42 54Q48 50 54 60Q48 66 42 60Z" fill="#14231a"/><path d="M78 54Q72 50 66 60Q72 66 78 60Z" fill="#14231a"/><path d="M54 76Q60 80 66 76" stroke="#1d5a30" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="30" cy="30" r="1.8" fill="#fff"/><circle cx="92" cy="40" r="1.4" fill="#fff"/><circle cx="88" cy="88" r="1.6" fill="#fff"/>` },
  astro: { bg: "#0f1c3f", art: `<circle cx="60" cy="58" r="28" fill="#eef2f7"/><circle cx="60" cy="58" r="21" fill="#26405f"/><path d="M44 52Q56 42 70 50" stroke="#fff" stroke-opacity=".5" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="54" cy="62" r="2.4" fill="#7fe3ff"/><circle cx="66" cy="62" r="2.4" fill="#7fe3ff"/><rect x="48" y="86" width="24" height="8" rx="3" fill="#c8402f"/><circle cx="30" cy="34" r="1.8" fill="#fff"/><circle cx="92" cy="44" r="1.4" fill="#fff"/>` },
  clock: { bg: "#8a4b2d", art: `<circle cx="60" cy="60" r="28" fill="#f7efe0" stroke="#3a2a22" stroke-width="3"/><path d="M60 60V42M60 60L74 66" stroke="#3a2a22" stroke-width="3.4" stroke-linecap="round"/><path d="M60 36V40M60 80V84M36 60H40M80 60H84" stroke="#3a2a22" stroke-width="2.2" stroke-linecap="round"/><circle cx="60" cy="60" r="3" fill="#c8402f"/><path d="M40 34Q34 38 34 44M80 34Q86 38 86 44" stroke="#ffd34a" stroke-width="3" fill="none" stroke-linecap="round"/>` },
  kandinsky: { bg: "#f3e9d2", art: `<circle cx="50" cy="52" r="20" fill="#e53935"/><path d="M60 34L96 80H34Z" fill="#fdd835" fill-opacity=".9"/><circle cx="70" cy="64" r="10" fill="#1e88e5"/><path d="M26 44Q48 70 70 40T100 76" stroke="#111" stroke-width="2.4" fill="none"/><rect x="40" y="70" width="26" height="6" transform="rotate(-20 53 73)" fill="#111"/><circle cx="84" cy="40" r="4" fill="#43a047"/>` },
};

export const avatarSvg = (id: string): string => { const a = AV[id] ?? AV.conductor!; return `<circle cx="${C}" cy="${C}" r="43.5" fill="${a.bg}"/><g clip-path="url(#lk-clip)">${a.art}</g><circle cx="${C}" cy="${C}" r="43.5" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="1"/>`; };
