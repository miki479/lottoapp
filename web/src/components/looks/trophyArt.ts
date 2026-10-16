import { GLYPHS } from "./glyphs";
import { M } from "./art";
import { Metal, Pt, edgeFacing, f, inset, light, mix, poly, polar, pt, ramp, rad, smooth, star } from "./geo";

/** Rose gold, for the metal that has no entry among the ring materials. */
const ROSE: Metal = { d: "#6b2f2a", m: "#c97b6a", l: "#f2b5a0", h: "#ffe3d6" };
const LOCK: Metal = { d: "#14161c", m: "#262a34", l: "#3d4352", h: "#566074" };
const cl = (v: number) => Math.max(0, Math.min(1, v));

/** A square with concave quarter-circle bites at the corners, like a stamp. */
function stamp(h: number, r: number): Pt[] {
  const out: Pt[] = [];
  const arc = (cx: number, cy: number, from: number, to: number) => { for (let i = 0; i <= 8; i++) { const a = rad(from + ((to - from) * i) / 8); out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  arc(-h, -h, 90, 0); arc(h, -h, 180, 90); arc(h, h, 270, 180); arc(-h, h, 360, 270);
  return out;
}


/** A badge with n pointed lobes (a star with fat points) and a rosette with n soft scallops. */
const starOf = (n: number, rOut: number, rIn: number, pow: number): Pt[] => polar((a) => rIn + (rOut - rIn) * Math.pow(0.5 + 0.5 * Math.cos(rad(n * a)), pow), 240);
const rosetteOf = (n: number, base: number, amp: number): Pt[] => polar((a) => base + amp * Math.cos(rad(n * a)), 240);
const squircleOf = (a0: number): Pt[] => polar((a) => { const x = Math.abs(Math.sin(rad(a))), y = Math.abs(Math.cos(rad(a))); return a0 / Math.pow(Math.pow(x, 4) + Math.pow(y, 4), 0.25); }, 160);
const octagonOf = (r: number): Pt[] => smooth(Array.from({ length: 8 }, (_, i) => [r * Math.sin(rad(22.5 + 45 * i)), -r * Math.cos(rad(22.5 + 45 * i)), 5] as [number, number, number]), 5);

interface Spec { shape: Pt[]; metal: Metal; enamel: [string, string]; dy?: number; stars?: boolean }
/** Each trophy: its own badge shape, the metal of its rarity (silver, gold, then the precious ones), and an enamel colour. */
const SPEC: Record<string, () => Spec> = {
  first_win: () => ({ shape: smooth([[-28, -48.5, 6], [28, -48.5, 6], [56, 0, 6], [28, 48.5, 6], [-28, 48.5, 6], [-56, 0, 6]], 5), metal: M.silver!, enamel: ["#c9f25a", "#5f9a14"] }),
  all_rings: () => ({ shape: smooth([[-44, -52, 10], [44, -52, 10], [46, 0, 10], [30, 34, 18], [0, 54, 12], [-30, 34, 18], [-46, 0, 10]], 5), metal: M.silver!, enamel: ["#2b2f3a", "#0b0d12"], dy: -3 }),
  long_shot: () => ({ shape: smooth(Array.from({ length: 8 }, (_, i) => [57 * Math.sin(rad(22.5 + 45 * i)), -57 * Math.cos(rad(22.5 + 45 * i)), 5] as [number, number, number]), 5), metal: M.gold!, enamel: ["#2a3f8f", "#080d2a"], stars: true }),
  rain_man: () => ({ shape: stamp(50, 11), metal: M.gold!, enamel: ["#6ccaff", "#1763bd"] }),
  streak_7: () => ({ shape: smooth([[0, -56, 6], [48.5, -28, 6], [48.5, 28, 6], [0, 56, 6], [-48.5, 28, 6], [-48.5, -28, 6]], 5), metal: M.gold!, enamel: ["#46d890", "#0c6c41"] }),
  train_whisperer: () => ({ shape: smooth([[-36, -52, 6], [36, -52, 6], [54, -30, 6], [54, 18, 8], [28, 50, 10], [-28, 50, 10], [-54, 18, 8], [-54, -30, 6]], 5), metal: M.platinum!, enamel: ["#ffb866", "#cf4a14"] }),
  high_roller: () => ({ shape: smooth([[-26, -50, 4], [26, -50, 4], [56, -18, 4], [0, 57, 4], [-56, -18, 4]], 5), metal: M.diamond!, enamel: ["#b87aff", "#4c14a8"], dy: -5 }),
  streak_30: () => ({ shape: polar((a) => 53 + 4 * Math.cos(rad(14 * a)), 168), metal: ROSE, enamel: ["#ff7388", "#a30f2b"] }),
  wins_100: () => ({ shape: rosetteOf(12, 52, 4), metal: M.gold!, enamel: ["#3de08f", "#0a6b3d"] }),
  wins_500: () => ({ shape: starOf(16, 59, 49, 2), metal: M.adamantium!, enamel: ["#ff5ad2", "#3b0a66"], stars: true }),
  streak_100: () => ({ shape: smooth([[-46, -46, 6], [-24, -57, 4], [0, -46, 4], [24, -57, 4], [46, -46, 6], [48, 2, 10], [30, 38, 16], [0, 56, 8], [-30, 38, 16], [-48, 2, 10]], 5), metal: M.orichalcum!, enamel: ["#ff9a3d", "#8f1500"], dy: 2 }),
  bets_500: () => ({ shape: smooth([[-28, -48.5, 6], [28, -48.5, 6], [56, 0, 6], [28, 48.5, 6], [-28, 48.5, 6], [-56, 0, 6]], 5), metal: M.platinum!, enamel: ["#7fa8d8", "#223a63"] }),
  all_categories: () => ({ shape: rosetteOf(24, 54, 2.2), metal: M.diamond!, enamel: ["#37d6ff", "#0a4aa0"] }),
  win_row_10: () => ({ shape: starOf(8, 60, 46, 1.5), metal: M.gold!, enamel: ["#4b3300", "#140d00"], stars: true }),
  big_odds: () => ({ shape: smooth([[-26, -50, 4], [26, -50, 4], [56, -18, 4], [0, 57, 4], [-56, -18, 4]], 5), metal: ROSE, enamel: ["#2b2f3a", "#0b0d12"], dy: -5 }),
  parlay_5: () => ({ shape: stamp(50, 11), metal: M.amethyst!, enamel: ["#a77bff", "#321a7a"] }),
  friends_10: () => ({ shape: squircleOf(53), metal: M.mithril!, enamel: ["#ff9ec0", "#b0245f"] }),
  level_25: () => ({ shape: smooth([[-36, -52, 6], [36, -52, 6], [54, -30, 6], [54, 18, 8], [28, 50, 10], [-28, 50, 10], [-54, 18, 8], [-54, -30, 6]], 5), metal: M.platinum!, enamel: ["#2a3350", "#080b18"], stars: true }),
  level_50: () => ({ shape: starOf(12, 60, 48, 2), metal: M.diamond!, enamel: ["#6a3de8", "#150a40"], stars: true }),
  chest_30: () => ({ shape: octagonOf(57), metal: M.gold!, enamel: ["#c97b2d", "#4a2200"] }),
  collector: () => ({ shape: rosetteOf(20, 54, 4), metal: M.opal!, enamel: ["#1b1450", "#05030f"], stars: true }),
  ghost_feed: () => ({ shape: smooth([[-44, -46, 8], [0, -57, 4], [44, -46, 8], [48, 0, 8], [0, 58, 4], [-48, 0, 8]], 5), metal: M.obsidian!, enamel: ["#6a54c4", "#1c1448"], stars: true }),
};
const RINGS = ["#ff4f93", "#b9f53c", "#37e3ff"];

const node = ([tag, a]: [string, Record<string, string>]) => `<${tag} ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(" ")}/>`;
const S = 2.15;
/** The icon drawn as a little tube: a dark edge, the body, and a thin highlight, so it looks pressed into the metal. */
function glyph(id: string, p: Metal, have: boolean, dy: number): string {
  const nodes = GLYPHS[id]!;
  const g = (items: [string, Record<string, string>][], width: number, color: string, dx: number, dyy: number, op = 1) =>
    `<g transform="translate(${f(60 - 12 * S + dx)} ${f(60 - 12 * S + dy + dyy)}) scale(${S})" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${op}">${items.map(node).join("")}</g>`;
  if (!have) return g(nodes, 2.2, "#10121a", 0.5, 0.7, 0.8) + g(nodes, 1.9, "#363c4b", 0, 0);
  if (id === "all_rings") return nodes.map((n, i) => { const col = RINGS[i]!; return g([n], 2.7, "#000", 0.5, 0.8, 0.35) + g([n], 2.6, mix(col, "#000", 0.5), 0, 0) + g([n], 2.0, col, 0, 0) + g([n], 0.8, mix(col, "#fff", 0.65), -0.25, -0.3, 0.9); }).join("");
  return g(nodes, 2.9, "#000", 0.5, 0.8, 0.35) + g(nodes, 2.8, ramp(p, 0.12), 0, 0) + g(nodes, 2.2, ramp(p, 0.64), 0, 0) + g(nodes, 0.9, ramp(p, 0.98), -0.25, -0.3, 0.95);
}

const cache = new Map<string, string>();
/** A trophy as a 3D badge: a bevelled metal rim, a coloured enamel field with a glossy top, and the trophy's icon pressed in metal. */
export function trophySvg(id: string, have: boolean, shines: boolean): string {
  const key = `${id}|${have ? 1 : 0}|${shines ? 1 : 0}`, hit = cache.get(key);
  if (hit) return hit;
  const spec = SPEC[id]?.() ?? SPEC.first_win!(), P = spec.shape, p = have ? spec.metal : LOCK;
  const A = inset(P, 2.6), B = inset(P, 5.6), E = inset(P, 8.2);
  const col = (i: number, shift: number, flip = 0) => ramp(p, cl(light(edgeFacing(P, i) + flip) + shift));
  let out = `<defs><linearGradient id="tre-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${have ? spec.enamel[0] : "#242831"}"/><stop offset="1" stop-color="${have ? spec.enamel[1] : "#0e1015"}"/></linearGradient>`
    + `<linearGradient id="trg-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient>`
    + `<clipPath id="trc-${id}"><path d="${poly(E, 60, 60)}"/></clipPath><clipPath id="tro-${id}"><path d="${poly(P, 60, 60)}"/></clipPath></defs>`;
  out += `<path d="${poly(P, 61.6, 62.8)}" fill="#000" fill-opacity=".32"/>`;
  const quad = (O: Pt[], I: Pt[], i: number, color: string) => { const j = (i + 1) % P.length; return `<path d="M${f(O[i]![0] + 60)} ${f(O[i]![1] + 60)}L${f(O[j]![0] + 60)} ${f(O[j]![1] + 60)}L${f(I[j]![0] + 60)} ${f(I[j]![1] + 60)}L${f(I[i]![0] + 60)} ${f(I[i]![1] + 60)}Z" fill="${color}" stroke="${color}" stroke-width=".3"/>`; };
  for (let i = 0; i < P.length; i++) out += quad(P, A, i, col(i, 0.16));
  for (let i = 0; i < P.length; i++) out += quad(A, B, i, col(i, -0.02));
  for (let i = 0; i < P.length; i++) out += quad(B, E, i, col(i, -0.1, 180));
  out += `<path d="${poly(P, 60, 60)}" fill="none" stroke="${ramp(p, 0.06)}" stroke-width=".8" stroke-opacity=".85" stroke-linejoin="round"/>`;
  out += `<path d="${poly(E, 60, 60)}" fill="url(#tre-${id})"/>`;
  out += `<path d="${poly(inset(P, 8.9), 60, 60)}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="1.8" stroke-linejoin="round"/>`;
  if (have) out += `<g clip-path="url(#trc-${id})"><path d="M0 0H120V54Q60 78 0 54Z" fill="url(#trg-${id})"/></g>`;
  if (have && spec.stars) for (const [x, y, s] of [[34, 38, 2.6], [88, 44, 2], [44, 84, 1.8], [82, 80, 2.4], [60, 26, 1.6]] as [number, number, number][]) out += `<path d="${star(x, y, s)}" fill="#fff" fill-opacity=".85"/>`;
  out += glyph(id, p, have, spec.dy ?? 0);
  if (have && shines) {
    out += `<g clip-path="url(#tro-${id})"><g class="tr-sheen"><path d="M-30 130L-6 130L52 -10L28 -10Z" fill="#fff" fill-opacity=".16"/><path d="M-4 130L6 130L64 -10L54 -10Z" fill="#fff" fill-opacity=".3"/></g></g>`;
  }
  const [hx, hy] = pt(0, 0); void hx; void hy;
  cache.set(key, out);
  return out;
}
