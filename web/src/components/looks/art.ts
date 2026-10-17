import { DARK_AVATARS } from "./avatarsDark";
import { C, Metal, band, cornerAngles, edgeFacing, f, inset, light, mix, poly, polyArc, pt, ramp, rayR, ringBody, sector, star } from "./geo";
import { frameOf } from "./frames";

/** The material of every decoration. */
export const M: Record<string, Metal> = {
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

const cl = (v: number) => Math.max(0, Math.min(1, v));
const norm360 = (d: number) => ((d % 360) + 360) % 360;
/** What an ornament needs to know: how far the outline is at each angle, and the material. */
interface Ctx { R: (a: number) => number; p: Metal }
/** Ornaments stay inside the picture: the farthest a tip may go in each direction. */
const MAXC = 70;
const reach = (a: number, r: number) => Math.min(r, MAXC / Math.max(Math.abs(Math.sin((a * Math.PI) / 180)), Math.abs(Math.cos((a * Math.PI) / 180)), 0.01));

/** A faceted spike: two halves, one lit and one in shade, so it reads as solid. */
function spike(c: Ctx, a: number, len: number, w: number, ball = false): string {
  const R = c.R(a), r0 = R - 3, tipR = reach(a, R + len), p = c.p;
  const [bx, by] = pt(r0, a - w), [cx, cy] = pt(r0, a + w), [tx, ty] = pt(tipR, a), [mx, my] = pt(r0 - 1, a);
  let out = `<path d="M${f(bx)} ${f(by)}L${f(tx)} ${f(ty)}L${f(mx)} ${f(my)}Z" fill="${ramp(p, 0.8)}"/><path d="M${f(cx)} ${f(cy)}L${f(tx)} ${f(ty)}L${f(mx)} ${f(my)}Z" fill="${ramp(p, 0.3)}"/><path d="M${f(bx)} ${f(by)}L${f(tx)} ${f(ty)}L${f(cx)} ${f(cy)}" fill="none" stroke="${ramp(p, 0.55)}" stroke-width=".4"/>`;
  if (ball) out += `<circle cx="${f(tx)}" cy="${f(ty)}" r="1.7" fill="${ramp(p, 0.55)}"/><circle cx="${f(tx - 0.5)}" cy="${f(ty - 0.5)}" r=".7" fill="${ramp(p, 1)}"/>`;
  return out;
}
/** A cut gem with four facets, set into the body of the ring. */
function gem(c: Ctx, a: number, s: number, depth: number, p: Metal = c.p): string {
  const [x, y] = pt(c.R(a) - depth, a);
  const t = [x, y - s], rr = [x + s * 0.8, y], b = [x, y + s * 1.1], l = [x - s * 0.8, y];
  const P = (q: number[]) => `${f(q[0]!)} ${f(q[1]!)}`;
  return `<path d="M${P(t)}L${P(rr)}L${f(x)} ${f(y)}Z" fill="${ramp(p, 0.95)}"/><path d="M${P(t)}L${P(l)}L${f(x)} ${f(y)}Z" fill="${ramp(p, 0.7)}"/><path d="M${P(l)}L${P(b)}L${f(x)} ${f(y)}Z" fill="${ramp(p, 0.4)}"/><path d="M${P(rr)}L${P(b)}L${f(x)} ${f(y)}Z" fill="${ramp(p, 0.15)}"/><path d="M${P(t)}L${P(rr)}L${P(b)}L${P(l)}Z" fill="none" stroke="${ramp(p, 1)}" stroke-width=".35"/>`;
}
const bead = (c: Ctx, a: number, rr: number, off: number, p: Metal = c.p) => { const [x, y] = pt(c.R(a) + off, a); return `<circle cx="${f(x)}" cy="${f(y)}" r="${rr}" fill="${ramp(p, 0.4)}"/><circle cx="${f(x - rr * 0.2)}" cy="${f(y - rr * 0.2)}" r="${f(rr * 0.78)}" fill="${ramp(p, 0.7)}"/><circle cx="${f(x - rr * 0.35)}" cy="${f(y - rr * 0.4)}" r="${f(rr * 0.3)}" fill="${ramp(p, 1)}"/>`; };
/** A feather: a curved blade from the edge, lit on one side. */
function feather(c: Ctx, a: number, dir: number, len: number, w: number): string {
  const [bx, by] = pt(c.R(a) - 3, a), d = (dir * Math.PI) / 180, dx = Math.sin(d), dy = -Math.cos(d), px = Math.cos(d), py = Math.sin(d);
  const t0x = bx + dx * len, t0y = by + dy * len, k = Math.min(1, reach(a, c.R(a) + 1) / 1);
  void k;
  const tx = Math.max(-MAXC, Math.min(MAXC, t0x - 60)) + 60, ty = Math.max(-MAXC, Math.min(MAXC, t0y - 60)) + 60;
  const mx = bx + (tx - bx) * 0.55, my = by + (ty - by) * 0.55, p = c.p;
  const l = [bx - px * w, by - py * w], r = [bx + px * w, by + py * w], c1 = [mx - px * w * 1.6, my - py * w * 1.6], c2 = [mx + px * w * 1.6, my + py * w * 1.6];
  return `<path d="M${f(l[0]!)} ${f(l[1]!)}Q${f(c1[0]!)} ${f(c1[1]!)} ${f(tx)} ${f(ty)}L${f(bx)} ${f(by)}Z" fill="${ramp(p, 0.88)}"/><path d="M${f(r[0]!)} ${f(r[1]!)}Q${f(c2[0]!)} ${f(c2[1]!)} ${f(tx)} ${f(ty)}L${f(bx)} ${f(by)}Z" fill="${ramp(p, 0.42)}"/><path d="M${f(bx)} ${f(by)}L${f(tx)} ${f(ty)}" stroke="${ramp(p, 1)}" stroke-width=".4" fill="none"/>`;
}
/** A wing: a fan of feathers, longest on top. */
function wing(c: Ctx, side: 1 | -1, scale: number): string {
  const rows: [number, number, number, number][] = [[42, 18, 26, 5.5], [56, 36, 26, 5.5], [70, 54, 23, 5], [84, 70, 20, 4.6], [98, 86, 17, 4.2], [112, 102, 14, 3.8], [126, 118, 11, 3.4]];
  return rows.map(([a, dir, len, w]) => feather(c, side * a, side * dir, len * scale, w)).join("");
}
/** A flame lick pointing outward. */
function flame(c: Ctx, a: number, len: number): string {
  const R = c.R(a) - 3, tipR = reach(a, R + 3 + len) - 3, p = c.p;
  const [x0, y0] = pt(R, a - 5), [x1, y1] = pt(R, a + 5), [tx, ty] = pt(tipR, a + 6), [cx, cy] = pt(R + (tipR - R) * 0.55, a - 7), [dx, dy] = pt(R + (tipR - R) * 0.5, a + 9);
  return `<path d="M${f(x0)} ${f(y0)}Q${f(cx)} ${f(cy)} ${f(tx)} ${f(ty)}Q${f(dx)} ${f(dy)} ${f(x1)} ${f(y1)}Z" fill="${ramp(p, 0.55)}"/><path d="M${f(x0 + (x1 - x0) * 0.25)} ${f(y0 + (y1 - y0) * 0.25)}Q${f(cx)} ${f(cy)} ${f(tx * 0.5 + x0 * 0.5)} ${f(ty * 0.5 + y0 * 0.5)}Q${f(dx)} ${f(dy)} ${f(x1 - (x1 - x0) * 0.25)} ${f(y1 - (y1 - y0) * 0.25)}Z" fill="${ramp(p, 0.95)}"/>`;
}
/** A leaf, for the elven metal. */
function leaf(c: Ctx, a: number, len: number): string {
  const R = c.R(a), tipR = reach(a + 14, R + len), p = c.p;
  const [x0, y0] = pt(R - 2, a), [tx, ty] = pt(tipR, a + 14), [c1x, c1y] = pt(R + (tipR - R) * 0.6, a - 6), [c2x, c2y] = pt(R + (tipR - R) * 0.3, a + 14);
  return `<path d="M${f(x0)} ${f(y0)}Q${f(c1x)} ${f(c1y)} ${f(tx)} ${f(ty)}Q${f(c2x)} ${f(c2y)} ${f(x0)} ${f(y0)}Z" fill="${ramp(p, 0.7)}" stroke="${ramp(p, 0.2)}" stroke-width=".4"/><path d="M${f(x0)} ${f(y0)}L${f(tx)} ${f(ty)}" stroke="${ramp(p, 1)}" stroke-width=".4" fill="none"/>`;
}
const every = (n: number, off = 0) => Array.from({ length: n }, (_, i) => off + (360 / n) * i);
const range = (a: number, b: number, step: number) => { const out: number[] = []; for (let x = a; x <= b + 1e-6; x += step) out.push(x); return out; };

/**
 * Ornaments of each decoration. The higher the level, the bigger and wilder they get: beads and studs on the first rings,
 * a crown on gold, wings on platinum, vines on mithril, flames on orichalcum, and heavy blades on adamantium.
 */
function ornaments(id: string, c: Ctx): string {
  const p = c.p;
  switch (id) {
    case "copper": return every(12, 15).map((a) => bead(c, a, 1.5, -5.4)).join("");
    case "bronze": return every(10, 18).map((a) => spike(c, a, 4, 5)).join("");
    case "silver": return every(16, 11).map((a, i) => (i % 2 ? bead(c, a, 1.3, 1) : spike(c, a, 5, 4))).join("");
    case "gold": return ([[-42, 7], [-21, 10], [0, 15], [21, 10], [42, 7]] as [number, number][]).map(([a, l]) => spike(c, a, l, 6.5, true)).join("") + [-31, -10, 10, 31].map((a) => spike(c, a, 4.5, 3)).join("") + gem(c, 180, 3.2, 7, M.ruby);
    case "diamond": return every(6, 0).map((a) => spike(c, a, 10, 5.5)).join("") + every(6, 30).map((a) => spike(c, a, 5, 3.5)).join("") + every(6, 0).map((a) => gem(c, a, 2.6, 8)).join("");
    case "amethyst": return [0, 180].map((a) => spike(c, a, 14, 6)).join("") + [-60.6, 60.6, -119.4, 119.4].map((a) => spike(c, a, 11, 5.5)).join("") + [-30, 30, -150, 150].map((a) => spike(c, a, 7, 4)).join("") + [-90, 90].map((a) => spike(c, a, 6, 4)).join("");
    case "platinum": return wing(c, 1, 1) + wing(c, -1, 1) + gem(c, 0, 3.4, 8, M.sapphire) + gem(c, 180, 3, 8, M.sapphire);
    case "mithril": return every(16, 0).map((a) => leaf(c, a, 14)).join("") + every(16, 11.25).map((a) => leaf(c, a, 7)).join("");
    case "orichalcum": return range(-98, 98, 14).map((a, i) => flame(c, a, i % 2 ? 17 : 24)).join("") + [-126, -112, 112, 126, -146, 146].map((a) => flame(c, a, 10)).join("");
    case "adamantium": return every(8, 22.5).map((a) => spike(c, a, 17, 6.5)).join("") + every(8, 0).map((a) => spike(c, a, 10, 4.5)).join("") + every(8, 22.5).map((a) => gem(c, a, 2.6, 8, M.ruby)).join("");
    case "jade": return every(16, 0).map((a) => bead(c, a, 2.3, 0.5)).join("");
    case "ruby": return [-14, 0, 14].map((a, i) => spike(c, a, i === 1 ? 9 : 5, 4)).join("") + [-38, 38].map((a) => gem(c, a, 3, 8)).join("") + gem(c, 180, 4.2, 9);
    case "sapphire": return every(10, 18).map((a, i) => gem(c, a, i % 2 ? 2.6 : 3.4, 7)).join("") + gem(c, 180, 4, 9);
    case "obsidian": return every(14, 0).map((a, i) => spike(c, a, i % 2 ? 7 : 13, 3.6)).join("");
    case "opal": return every(12, 0).map((a, i) => bead(c, a, 2.5, 0.2, { ...p, d: mix("#c8a0ff", "#8fe0ff", i / 12), m: mix("#ffc0e8", "#a0ffd8", i / 12), l: "#fff8ff", h: "#ffffff" })).join("");
    default: return "";
  }
}

/** Colour of the body for an iridescent material. */
const opalTint = (a: number) => mix(mix("#ff9ad5", "#9be8ff", (Math.sin((a * Math.PI) / 90) + 1) / 2), "#fff2a8", (Math.sin((a * Math.PI) / 60 + 1) + 1) / 4);
/** Decorations that are cut like gems: the body is made of flat facets. */
const FACETED = new Set(["diamond", "amethyst", "adamantium", "ruby", "obsidian"]);

const cache = new Map<string, string>();
/**
 * The ring: a shadow, ornaments, a bevelled rim lit edge by edge, the body, and an inner rim lit from the opposite side so the band looks solid.
 * `hi` is for big sizes: more slices, smoother curves.
 */
/** Rings that are a rendered picture (web/public/decorations/<id>.webp) instead of drawn shapes. */
const PICTURED_RINGS = new Set(["cinder", "rosegold", "starlight", "aurum", "glacier", "crimson", "azure", "vortex", "onyx"]);
export function decorationSvg(id: string, shines: boolean, hi: boolean): string {
  if (PICTURED_RINGS.has(id)) {
    // the picture, with the same light as the drawn rings: a sweeping sheen clipped to the metal and four twinkling stars
    const img = `<image href="/decorations/${id}.webp" x="-12" y="-12" width="144" height="144"/>`;
    const [x1, y1] = pt(90, -5), [x2, y2] = pt(90, 5), [x3, y3] = pt(90, -11), [x4, y4] = pt(90, 11);
    const sheen = `<g class="lk-sheen"><path d="M${C} ${C}L${f(x3)} ${f(y3)}L${f(x4)} ${f(y4)}Z" fill="#fff" fill-opacity=".14"/><path d="M${C} ${C}L${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}Z" fill="#fff" fill-opacity=".4"/></g>`;
    const sparks = [40, 140, 230, 320].map((a, i) => { const [x, y] = pt(55, a); return `<path class="lk-spk lk-d${i}" d="${star(x, y, 3.6)}" fill="#fff"/>`; }).join("");
    return `<defs><mask id="lkm-${id}" style="mask-type:alpha">${img}</mask></defs>${img}<g mask="url(#lkm-${id})">${sheen}</g>${sparks}`;
  }
  const key = `${id}|${shines ? 1 : 0}|${hi ? 1 : 0}`, hit = cache.get(key);
  if (hit) return hit;
  const p = M[id] ?? M.copper!, P = frameOf(id, hi), R = (a: number) => rayR(P, norm360(a)), c: Ctx = { R, p };
  const rimW = 3.4, n = hi ? 72 : 36, Q = inset(P, rimW), tint = id === "opal" ? opalTint : undefined;
  const faceted = FACETED.has(id), corners = faceted ? cornerAngles(Q) : [];
  const facetIdx = (m: number) => { let k = corners.length - 1; for (let i = 0; i < corners.length; i++) if (corners[i]! <= m) k = i; return k; };
  const facetMid = (k: number) => { const a = corners[k]!, b0 = corners[(k + 1) % corners.length]!, b = b0 <= a ? b0 + 360 : b0; return norm360((a + b) / 2); };
  const body = (m: number) => { if (tint) return tint(m); if (!faceted || corners.length < 3) return ramp(p, cl(light(m) - 0.04)); const k = facetIdx(m); return ramp(p, cl(light(facetMid(k)) + (k % 2 ? 0.1 : -0.07))); };
  let out = `<path d="${poly(P, C + 1.6, C + 2.6)}" fill="#000" fill-opacity=".3"/>`;
  if (shines) out += `<path d="${poly(P)}" fill="none" stroke="${p.l}" stroke-opacity=".26" stroke-width="7" stroke-linejoin="round"/>`;
  out += ornaments(id, c);
  for (let i = 0; i < P.length; i++) {
    const j = (i + 1) % P.length, col = id === "opal" ? tint!(norm360((Math.atan2(P[i]![0], -P[i]![1]) * 180) / Math.PI)) : ramp(p, cl(light(edgeFacing(P, i)) + 0.14));
    out += `<path d="M${f(P[i]![0] + C)} ${f(P[i]![1] + C)}L${f(P[j]![0] + C)} ${f(P[j]![1] + C)}L${f(Q[j]![0] + C)} ${f(Q[j]![1] + C)}L${f(Q[i]![0] + C)} ${f(Q[i]![1] + C)}Z" fill="${col}" stroke="${col}" stroke-width=".3"/>`;
  }
  out += `<path d="${poly(P)}" fill="none" stroke="${ramp(p, 0.08)}" stroke-width=".7" stroke-opacity=".8" stroke-linejoin="round"/>`;
  out += ringBody(Q, 46.8, n, body, corners);
  out += band(44.2, 46.8, n, p, 180, -0.1, tint);
  out += `<path d="${poly(inset(P, rimW + 1.7))}" fill="none" stroke="${ramp(p, 0.12)}" stroke-width=".5" stroke-opacity=".5" stroke-linejoin="round"/>`;
  out += `<circle cx="${C}" cy="${C}" r="44.2" fill="none" stroke="${ramp(p, 0.05)}" stroke-width=".8" stroke-opacity=".8"/>`;
  out += `<path d="${polyArc(inset(P, rimW + 2.4), 292, 352)}" fill="none" stroke="${p.h}" stroke-opacity=".55" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (shines) {
    const [x1, y1] = pt(90, -5), [x2, y2] = pt(90, 5), [x3, y3] = pt(90, -11), [x4, y4] = pt(90, 11);
    out += `<defs><clipPath id="lkc-${id}"><path clip-rule="evenodd" d="${poly(P)}M${C} ${C - 44.2}A44.2 44.2 0 1 0 ${C} ${C + 44.2}A44.2 44.2 0 1 0 ${C} ${C - 44.2}Z"/></clipPath></defs>`;
    out += `<g clip-path="url(#lkc-${id})"><g class="lk-sheen"><path d="M${C} ${C}L${f(x3)} ${f(y3)}L${f(x4)} ${f(y4)}Z" fill="#fff" fill-opacity=".12"/><path d="M${C} ${C}L${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}Z" fill="#fff" fill-opacity=".34"/></g></g>`;
    for (const [i, a] of [40, 140, 230, 320].entries()) { const [x, y] = pt(R(a) - 3, a); out += `<path class="lk-spk lk-d${i}" d="${star(x, y, 3.4)}" fill="#fff"/>`; }
  }
  // luxury finish: a fine engraved line on the band, a thin bright outline and a diagonal sheen over the whole ring
  out += `<circle cx="${C}" cy="${C}" r="45.6" fill="none" stroke="${p.h}" stroke-opacity=".38" stroke-width=".5" stroke-dasharray=".9 1.5" stroke-linecap="round"/>`;
  out += `<path d="${poly(inset(P, 0.9))}" fill="none" stroke="${p.h}" stroke-opacity=".5" stroke-width=".45" stroke-linejoin="round"/>`;
  out += `<defs><linearGradient id="lkg-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".38" stop-color="#fff" stop-opacity=".05"/><stop offset=".62" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#fff" stop-opacity=".22"/></linearGradient><clipPath id="lkr-${id}"><path clip-rule="evenodd" d="${poly(P)}M${C} ${C - 44.2}A44.2 44.2 0 1 0 ${C} ${C + 44.2}A44.2 44.2 0 1 0 ${C} ${C - 44.2}Z"/></clipPath></defs><g clip-path="url(#lkr-${id})"><rect x="-12" y="-12" width="144" height="144" fill="url(#lkg-${id})"/></g>`;
  cache.set(key, out);
  return out;
}

/** The ten cartoon characters, each drawn inside a disc of radius 43. */
const AV0: Record<string, { bg: string; art: string }> = {
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
  robot: { bg: "#2a5d8f", art: `<rect x="58.4" y="20" width="3.2" height="16" rx="1.6" fill="#8fa0b4"/><circle cx="60" cy="19" r="4.4" fill="#ff5a5a"/><circle cx="58.6" cy="17.6" r="1.4" fill="#fff" fill-opacity=".8"/><rect x="33" y="34" width="54" height="50" rx="14" fill="#9fb0c4"/><rect x="34.5" y="35.5" width="51" height="46" rx="12.5" fill="#dfe7f0"/><rect x="34.5" y="64" width="51" height="17.5" rx="9" fill="#b9c6d6"/><rect x="41" y="46" width="38" height="20" rx="8" fill="#0f1c33"/><rect x="41" y="46" width="38" height="9" rx="8" fill="#fff" fill-opacity=".08"/><circle cx="51" cy="56" r="5.4" fill="#7fe3ff"/><circle cx="69" cy="56" r="5.4" fill="#7fe3ff"/><circle cx="51" cy="56" r="2.4" fill="#e9fdff"/><circle cx="69" cy="56" r="2.4" fill="#e9fdff"/><circle cx="49.6" cy="54.4" r="1.2" fill="#fff"/><circle cx="67.6" cy="54.4" r="1.2" fill="#fff"/><path d="M48 73H72M50 77H70" stroke="#6b7c92" stroke-width="2" stroke-linecap="round"/><path d="M54 73V77M60 73V77M66 73V77" stroke="#6b7c92" stroke-width="1.4"/><circle cx="31" cy="58" r="5" fill="#8fa0b4"/><circle cx="89" cy="58" r="5" fill="#8fa0b4"/><circle cx="30" cy="57" r="1.6" fill="#e6edf5"/><circle cx="88" cy="57" r="1.6" fill="#e6edf5"/><path d="M40 40Q60 34 80 40" stroke="#fff" stroke-opacity=".7" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="40" cy="80" r="1.4" fill="#8fa0b4"/><circle cx="80" cy="80" r="1.4" fill="#8fa0b4"/>` },
  panda: { bg: "#4f8f5a", art: `<path d="M20 100Q40 84 60 88Q80 84 100 100V120H20Z" fill="#2f6b3d"/><path d="M82 96L96 60M90 92L104 70" stroke="#7bc77e" stroke-width="3" stroke-linecap="round"/><circle cx="40" cy="38" r="11" fill="#1b1b22"/><circle cx="80" cy="38" r="11" fill="#1b1b22"/><circle cx="40" cy="38" r="5.4" fill="#4a3a4a"/><circle cx="80" cy="38" r="5.4" fill="#4a3a4a"/><ellipse cx="60" cy="62" rx="29" ry="26" fill="#f7f7f4"/><ellipse cx="60" cy="72" rx="22" ry="14" fill="#e9e9e4"/><ellipse cx="47" cy="58" rx="8" ry="10.5" transform="rotate(24 47 58)" fill="#1b1b22"/><ellipse cx="73" cy="58" rx="8" ry="10.5" transform="rotate(-24 73 58)" fill="#1b1b22"/><circle cx="48.4" cy="58.4" r="3.4" fill="#fff"/><circle cx="71.6" cy="58.4" r="3.4" fill="#fff"/><circle cx="48.8" cy="58.8" r="1.8" fill="#111"/><circle cx="71.2" cy="58.8" r="1.8" fill="#111"/><circle cx="48" cy="57.6" r=".8" fill="#fff"/><circle cx="71" cy="57.6" r=".8" fill="#fff"/><ellipse cx="60" cy="69" rx="5" ry="3.6" fill="#1b1b22"/><ellipse cx="59" cy="68" rx="1.8" ry="1" fill="#fff" fill-opacity=".5"/><path d="M60 72.6V76M60 76Q54 80 50 76M60 76Q66 80 70 76" stroke="#1b1b22" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="42" cy="72" r="4" fill="#ffb3c1" fill-opacity=".6"/><circle cx="78" cy="72" r="4" fill="#ffb3c1" fill-opacity=".6"/>` },
  wizard: { bg: "#1b1250", art: `<circle cx="24" cy="30" r="1.6" fill="#fff"/><circle cx="96" cy="44" r="1.3" fill="#fff"/><circle cx="30" cy="84" r="1.2" fill="#ffd34a"/><path d="M92 26l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" fill="#ffd34a"/><path d="M60 8L86 62H34Z" fill="#6b46d8"/><path d="M60 8L72 34 60 62H34Z" fill="#8a66f0" fill-opacity=".55"/><path d="M60 8Q70 14 66 20Q74 18 78 28" stroke="#4a2fb0" stroke-width="2.4" fill="none" stroke-linecap="round"/><ellipse cx="60" cy="62" rx="33" ry="7.5" fill="#4a2fb0"/><ellipse cx="60" cy="60.4" rx="33" ry="6.4" fill="#6b46d8"/><path d="M38 58Q60 66 82 58" stroke="#ffd34a" stroke-width="3" fill="none"/><path d="M60 30l2.2 5.6 6 .4-4.6 3.8 1.5 5.8-5.1-3.2-5.1 3.2 1.5-5.8-4.6-3.8 6-.4z" fill="#ffd34a"/><circle cx="60" cy="76" r="16" fill="#f3c9a0"/><path d="M44 78Q46 100 60 106Q74 100 76 78Q68 90 60 90Q52 90 44 78Z" fill="#f4f4f6"/><path d="M50 84Q60 94 70 84" stroke="#d6d6de" stroke-width="1.6" fill="none"/><circle cx="53" cy="74" r="2.2" fill="#2a2140"/><circle cx="67" cy="74" r="2.2" fill="#2a2140"/><circle cx="52.4" cy="73.2" r=".8" fill="#fff"/><circle cx="66.4" cy="73.2" r=".8" fill="#fff"/><path d="M47 70Q53 67 58 70M62 70Q67 67 73 70" stroke="#f4f4f6" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M57 80Q60 82 63 80" stroke="#b9805a" stroke-width="1.6" fill="none" stroke-linecap="round"/>` },
  samurai: { bg: "#7a1c24", art: `<circle cx="60" cy="60" r="42" fill="#c8323a" fill-opacity=".35"/><path d="M26 60Q26 28 60 26Q94 28 94 60Z" fill="#23262f"/><path d="M26 60Q26 36 44 30Q36 44 38 60Z" fill="#3a3f4c"/><path d="M30 56H90" stroke="#ffd34a" stroke-width="3"/><path d="M40 28Q60 4 80 28Q60 20 40 28Z" fill="#ffd34a"/><path d="M44 27Q60 12 76 27Q60 21 44 27Z" fill="#fff3b0" fill-opacity=".6"/><path d="M26 60L20 76Q26 80 34 74L38 62Z" fill="#23262f"/><path d="M94 60L100 76Q94 80 86 74L82 62Z" fill="#23262f"/><rect x="38" y="56" width="44" height="14" rx="3" fill="#f0c9a0"/><path d="M42 62L54 60M78 62L66 60" stroke="#23262f" stroke-width="3" stroke-linecap="round"/><path d="M36 68H84Q86 90 60 98Q34 90 36 68Z" fill="#b3202a"/><path d="M36 68H84Q84 74 82 78Q60 84 38 78Q36 74 36 68Z" fill="#d6404a"/><path d="M46 80Q60 86 74 80M48 86Q60 92 72 86" stroke="#7a1019" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="60" cy="38" r="3.6" fill="#c8323a"/><circle cx="59" cy="37" r="1.2" fill="#fff" fill-opacity=".8"/>` },
  dragon: { bg: "#10321f", art: `<path d="M30 100Q20 70 34 48Q40 36 60 34Q80 36 86 48Q100 70 90 100Z" fill="#1e7a45"/><path d="M60 34L52 20 60 28 68 20Z" fill="#ffd34a"/><path d="M38 44L26 24 46 38Z" fill="#f3e3b8"/><path d="M82 44L94 24 74 38Z" fill="#f3e3b8"/><path d="M38 44L30 30 44 40Z" fill="#cdb98a"/><path d="M82 44L90 30 76 40Z" fill="#cdb98a"/><ellipse cx="60" cy="62" rx="27" ry="24" fill="#34b56a"/><ellipse cx="60" cy="66" rx="27" ry="16" fill="#52d48a" fill-opacity=".35"/><path d="M40 52Q48 46 56 54Q48 60 40 56Z" fill="#fff6a8"/><path d="M80 52Q72 46 64 54Q72 60 80 56Z" fill="#fff6a8"/><ellipse cx="48" cy="54" rx="1.8" ry="5" fill="#1a1208"/><ellipse cx="72" cy="54" rx="1.8" ry="5" fill="#1a1208"/><circle cx="47.4" cy="52" r=".9" fill="#fff"/><circle cx="71.4" cy="52" r=".9" fill="#fff"/><path d="M40 74Q60 92 80 74Q60 84 40 74Z" fill="#1a3d2a"/><path d="M46 77L48 82 51 78M56 80L58 85 61 80M66 80L69 85 71 79M72 77L74 82 77 76" stroke="none" fill="#fff"/><ellipse cx="54" cy="66" rx="2.2" ry="1.6" fill="#0f2a1a"/><ellipse cx="66" cy="66" rx="2.2" ry="1.6" fill="#0f2a1a"/><path d="M44 72Q40 68 36 70M76 72Q80 68 84 70" stroke="#8be0ab" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M52 100Q60 108 68 100Q64 94 60 96Q56 94 52 100Z" fill="#ff8a2a"/><path d="M55 100Q60 104 65 100Q62 98 60 99Q58 98 55 100Z" fill="#ffd34a"/>` },
  lion: { bg: "#2a1740", art: `<circle cx="60" cy="62" r="34" fill="#b5651a"/><circle cx="60" cy="62" r="34" fill="none" stroke="#7a3f0c" stroke-width="2.5" stroke-dasharray="6 3"/><circle cx="60" cy="62" r="29" fill="#d98a2a"/><circle cx="43" cy="42" r="8" fill="#f3b04a"/><circle cx="60" cy="38" r="8" fill="#f3b04a" fill-opacity="0"/><circle cx="72" cy="42" r="3" fill="#ffd77a" fill-opacity=".5"/><circle cx="60" cy="64" r="21" fill="#f6cf7a"/><circle cx="43" cy="48" r="7" fill="#e7a53c"/><circle cx="77" cy="48" r="7" fill="#e7a53c"/><circle cx="43" cy="48" r="3.4" fill="#f3b8b0"/><circle cx="77" cy="48" r="3.4" fill="#f3b8b0"/><ellipse cx="60" cy="72" rx="12" ry="9" fill="#fff0cf"/><circle cx="52" cy="60" r="3" fill="#2a1a10"/><circle cx="68" cy="60" r="3" fill="#2a1a10"/><circle cx="51" cy="59" r="1" fill="#fff"/><circle cx="67" cy="59" r="1" fill="#fff"/><path d="M55 67H65L60 73Z" fill="#c25a52"/><path d="M60 73V77M60 77Q55 81 51 77M60 77Q65 81 69 77" stroke="#7a3f0c" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M38 24L44 38 52 28 60 40 68 28 76 38 82 24 80 42H40Z" fill="#ffd34a" stroke="#c98a00" stroke-width="1.2" stroke-linejoin="round"/><rect x="40" y="38" width="40" height="5" rx="2" fill="#e6a800"/><circle cx="60" cy="31" r="2.6" fill="#e53935"/><circle cx="48" cy="33" r="2" fill="#1e88e5"/><circle cx="72" cy="33" r="2" fill="#43a047"/><circle cx="59.4" cy="30.2" r=".8" fill="#fff"/>` },
};
const AV: Record<string, { bg: string; art: string }> = { ...AV0, ...DARK_AVATARS };

/** Every character gets the same finish: a lit gradient disc, a soft vignette and a glossy highlight, so they look like enamelled badges. */
export const avatarSvg = (id: string): string => {
  const a = AV[id] ?? AV.conductor!, k = `lkav-${AV[id] ? id : "conductor"}`;
  const defs = `<defs><radialGradient id="${k}-g" cx=".34" cy=".26" r=".95"><stop offset="0" stop-color="${mix(a.bg, "#ffffff", 0.34)}"/><stop offset=".55" stop-color="${a.bg}"/><stop offset="1" stop-color="${mix(a.bg, "#000000", 0.5)}"/></radialGradient><radialGradient id="${k}-v" cx=".5" cy=".5" r=".5"><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></radialGradient><linearGradient id="${k}-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>`;
  return `${defs}<circle cx="${C}" cy="${C}" r="43.5" fill="url(#${k}-g)"/><g clip-path="url(#lk-clip)">${a.art}<circle cx="${C}" cy="${C}" r="43.5" fill="url(#${k}-v)"/><path d="M22 52Q26 22 60 18Q94 22 98 52Q60 40 22 52Z" fill="url(#${k}-s)" opacity=".7"/></g><circle cx="${C}" cy="${C}" r="43.5" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="1"/><circle cx="${C}" cy="${C}" r="42.4" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width=".8"/>`;
};
