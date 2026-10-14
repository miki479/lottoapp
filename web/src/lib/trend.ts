/** The chance of a question over time, as this phone has seen it: one point each time the price moved, kept between visits (a few dozen numbers per question). */
const KEY = "tr1:", IDX = "tr1:idx", KEEP = 40, MAX_KEYS = 60;
const mem = new Map<string, number[]>();

function read(id: string): number[] {
  const hit = mem.get(id);
  if (hit) return hit;
  try { const a = JSON.parse(localStorage.getItem(KEY + id) ?? "[]") as unknown; return Array.isArray(a) ? a.filter((x): x is number => typeof x === "number") : []; } catch { return []; }
}

/** Adds `v` when it differs from the last point and returns the series (oldest first). */
export function trend(id: string, v: number): number[] {
  let a = read(id);
  const last = a[a.length - 1];
  if (last === undefined || Math.abs(last - v) > 1e-4) {
    a = [...a, v].slice(-KEEP);
    try {
      localStorage.setItem(KEY + id, JSON.stringify(a));
      const idx = (JSON.parse(localStorage.getItem(IDX) ?? "[]") as string[]).filter((x) => x !== id); idx.push(id);
      while (idx.length > MAX_KEYS) localStorage.removeItem(KEY + idx.shift()!);
      localStorage.setItem(IDX, JSON.stringify(idx));
    } catch { /* storage full or blocked: the chart just lives in memory */ }
  }
  mem.set(id, a);
  return a;
}

/** The yes-chance implied by the two odds, with the margin taken out. */
export const impliedYes = (oddsYes: number, oddsNo: number): number => { const y = 1 / oddsYes, n = 1 / oddsNo; return y / (y + n); };
