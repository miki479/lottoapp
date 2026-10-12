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
