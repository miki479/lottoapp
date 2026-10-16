/** Small drawing helpers for the avatar rings: everything is plain SVG strings with presentation attributes only (no style attributes, so the content security policy is happy). */
export const C = 60;
export const rad = (d: number) => (d * Math.PI) / 180;
/** A point at radius r and angle deg (0 = top, clockwise). */
export const pt = (r: number, deg: number): [number, number] => [C + r * Math.sin(rad(deg)), C - r * Math.cos(rad(deg))];
export const f = (n: number) => String(Math.round(n * 100) / 100);

/** A slice of a ring between two radii and two angles. */
export function sector(r1: number, r2: number, a0: number, a1: number): string {
  const [x0, y0] = pt(r2, a0), [x1, y1] = pt(r2, a1), [x2, y2] = pt(r1, a1), [x3, y3] = pt(r1, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${f(x0)} ${f(y0)}A${r2} ${r2} 0 ${large} 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${r1} ${r1} 0 ${large} 0 ${f(x3)} ${f(y3)}Z`;
}
/** An arc line at radius r. */
export function arc(r: number, a0: number, a1: number): string {
  const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a1);
  return `M${f(x0)} ${f(y0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f(x1)} ${f(y1)}`;
}

export const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const toHex = (c: number[]) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
export const mix = (a: string, b: string, t: number) => { const A = hex(a), B = hex(b); return toHex(A.map((v, i) => v + (B[i]! - v) * Math.max(0, Math.min(1, t)))); };

/** The four tones of a material: shadow, body, light, glint. */
export interface Metal { d: string; m: string; l: string; h: string }
export const ramp = (p: Metal, t: number) => (t < 0.38 ? mix(p.d, p.m, t / 0.38) : t < 0.72 ? mix(p.m, p.l, (t - 0.38) / 0.34) : mix(p.l, p.h, (t - 0.72) / 0.28));

/** How much light a surface facing the angle theta catches, 0..1: one main light from the top left, a second softer reflection, and a little ripple. */
export function light(theta: number, phase = 0): number {
  const t = theta - phase;
  const v = 0.5 + 0.3 * Math.cos(rad(t - 315)) + 0.17 * Math.cos(rad(2 * (t - 200))) + 0.07 * Math.cos(rad(3 * t + 30));
  return Math.max(0, Math.min(1, v));
}

/** A band of a ring painted in many small slices whose colour follows the light: this is what makes the metal look turned and polished. */
export function band(r1: number, r2: number, n: number, p: Metal, phase: number, shift: number, tint?: (a: number) => string | null): string {
  let out = "";
  const step = 360 / n;
  for (let i = 0; i < n; i++) {
    const a0 = i * step, mid = a0 + step / 2;
    const col = tint?.(mid) ?? ramp(p, Math.max(0, Math.min(1, light(mid, phase) + shift)));
    out += `<path d="${sector(r1, r2, a0, a0 + step + 0.45)}" fill="${col}" stroke="${col}" stroke-width=".3"/>`;
  }
  return out;
}

/** Four-point sparkle centred at (x, y). */
export const star = (x: number, y: number, s: number) => `M${f(x)} ${f(y - s)}L${f(x + s * 0.28)} ${f(y - s * 0.28)}L${f(x + s)} ${f(y)}L${f(x + s * 0.28)} ${f(y + s * 0.28)}L${f(x)} ${f(y + s)}L${f(x - s * 0.28)} ${f(y + s * 0.28)}L${f(x - s)} ${f(y)}L${f(x - s * 0.28)} ${f(y - s * 0.28)}Z`;

/* ---- Outlines that are not circles: crests, hexagons, leaves ---- */
export type Pt = [number, number];
const norm360 = (d: number) => ((d % 360) + 360) % 360;
const area = (P: Pt[]) => P.reduce((s, [x, y], i) => { const [x2, y2] = P[(i + 1) % P.length]!; return s + x * y2 - x2 * y; }, 0) / 2;
/** Always walk the outline clockwise (the screen's clockwise, y down). */
export const clockwise = (P: Pt[]): Pt[] => (area(P) >= 0 ? P : [...P].reverse());

/** A polygon with a rounding radius at each corner (0 = sharp), centred on (0, 0). */
export function smooth(V: [number, number, number?][], seg = 7): Pt[] {
  const out: Pt[] = [], n = V.length;
  for (let i = 0; i < n; i++) {
    const [x, y, r = 0] = V[i]!, [px, py] = V[(i + n - 1) % n]!, [nx, ny] = V[(i + 1) % n]!;
    if (r <= 0) { out.push([x, y]); continue; }
    const d1 = Math.hypot(px - x, py - y), d2 = Math.hypot(nx - x, ny - y), d = Math.min(r, d1 / 2, d2 / 2);
    const a: Pt = [x + ((px - x) / d1) * d, y + ((py - y) / d1) * d], b: Pt = [x + ((nx - x) / d2) * d, y + ((ny - y) / d2) * d];
    for (let k = 0; k <= seg; k++) { const t = k / seg, u = 1 - t; out.push([u * u * a[0] + 2 * u * t * x + t * t * b[0], u * u * a[1] + 2 * u * t * y + t * t * b[1]]); }
  }
  return clockwise(out);
}
/** An outline given by its radius at every angle. */
export const polar = (R: (deg: number) => number, n: number): Pt[] => clockwise(Array.from({ length: n }, (_, i) => { const a = (360 / n) * i, r = R(a); return [r * Math.sin(rad(a)), -r * Math.cos(rad(a))] as Pt; }));

/** Distance from the centre to the outline along the direction deg (0 = up, clockwise). */
export function rayR(P: Pt[], deg: number): number {
  const dx = Math.sin(rad(deg)), dy = -Math.cos(rad(deg));
  let best = Infinity;
  for (let i = 0; i < P.length; i++) {
    const [ax, ay] = P[i]!, [bx, by] = P[(i + 1) % P.length]!, ex = bx - ax, ey = by - ay;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = (ax * ey - ay * ex) / den, u = (ax * dy - ay * dx) / den;
    if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9 && t < best) best = t;
  }
  return best;
}
/** The outline pulled in by d (mitred corners, so the width stays even). */
export function inset(P: Pt[], d: number): Pt[] {
  const n = P.length;
  const nrm = (i: number): Pt => { const [ax, ay] = P[i]!, [bx, by] = P[(i + 1) % n]!, l = Math.hypot(bx - ax, by - ay) || 1; return [-(by - ay) / l, (bx - ax) / l]; };
  return P.map(([x, y], i) => { const a = nrm((i + n - 1) % n), b = nrm(i), den = Math.max(0.35, 1 + a[0] * b[0] + a[1] * b[1]); return [x + (d * (a[0] + b[0])) / den, y + (d * (a[1] + b[1])) / den] as Pt; });
}
/** Where an edge faces, as an angle (0 = up, clockwise): this is what decides how much light it catches. */
export const edgeFacing = (P: Pt[], i: number): number => { const [ax, ay] = P[i]!, [bx, by] = P[(i + 1) % P.length]!; return norm360((Math.atan2(by - ay, bx - ax) * 180) / Math.PI); };
/** Angles of the sharp corners of an outline. */
export function cornerAngles(P: Pt[]): number[] {
  const out: number[] = [], n = P.length;
  for (let i = 0; i < n; i++) {
    const a = edgeFacing(P, (i + n - 1) % n), b = edgeFacing(P, i), turn = Math.abs(((b - a + 540) % 360) - 180);
    if (turn > 20) out.push(norm360((Math.atan2(P[i]![0], -P[i]![1]) * 180) / Math.PI));
  }
  return [...new Set(out.map((a) => Math.round(a * 100) / 100))].sort((a, b) => a - b);
}
export const poly = (P: Pt[], ox = C, oy = C): string => "M" + P.map(([x, y]) => `${f(x + ox)} ${f(y + oy)}`).join("L") + "Z";

/** The band between a circle of radius r1 and the outline, painted in slices; `color` gets the middle angle of each slice. */
export function ringBody(P: Pt[], r1: number, n: number, color: (mid: number) => string, extra: number[] = []): string {
  const set = new Set<number>();
  for (let i = 0; i < n; i++) set.add(Math.round(((360 * i) / n) * 100) / 100);
  for (const a of extra) set.add(a);
  const A = [...set].sort((a, b) => a - b);
  let out = "";
  for (let i = 0; i < A.length; i++) {
    const a0 = A[i]!, a1 = i + 1 < A.length ? A[i + 1]! : A[0]! + 360, mid = norm360((a0 + a1) / 2);
    const [x0, y0] = pt(rayR(P, a0), a0), [x1, y1] = pt(rayR(P, a1), a1), [x2, y2] = pt(r1, a1), [x3, y3] = pt(r1, a0), col = color(mid);
    out += `<path d="M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}Z" fill="${col}" stroke="${col}" stroke-width=".35"/>`;
  }
  return out;
}
/** A thin line following the outline between two angles. */
export function polyArc(P: Pt[], a0: number, a1: number, steps = 14): string {
  let d = "";
  for (let i = 0; i <= steps; i++) { const a = a0 + ((a1 - a0) * i) / steps, [x, y] = pt(rayR(P, norm360(a)), a); d += `${i ? "L" : "M"}${f(x)} ${f(y)}`; }
  return d;
}
