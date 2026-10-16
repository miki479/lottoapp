/**
 * The change of a quote since this device first saw it: the first quotes of a question are kept for a day, and the arrow on a card is the difference
 * between them and the quotes now (a quote that moved by less than three hundredths shows nothing).
 */
const KEY = "ob1", DAY = 86_400_000;
type Seen = Record<string, [number, number, number]>; // yes, no, when
let seen: Seen | null = null, saving = 0;

function load(): Seen {
  if (seen) return seen;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Seen, now = Date.now();
    seen = Object.fromEntries(Object.entries(raw).filter(([, v]) => Array.isArray(v) && now - v[2] < DAY));
  } catch { seen = {}; }
  return seen;
}

export interface Move { dir: "up" | "down"; delta: number }
/** The move from `first` to `now`, null under three hundredths (pure). */
export function moveOf(first: number, now: number): Move | null {
  const d = Math.round((now - first) * 100) / 100;
  return Math.abs(d) >= 0.03 ? { dir: d > 0 ? "up" : "down", delta: Math.abs(d) } : null;
}

export function oddsMove(id: string, pick: "yes" | "no", yes: number, no: number): Move | null {
  const s = load();
  let e = s[id];
  if (!e) {
    e = [yes, no, Date.now()]; s[id] = e;
    if (!saving) saving = window.setTimeout(() => { saving = 0; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } }, 400);
  }
  return moveOf(pick === "yes" ? e[0] : e[1], pick === "yes" ? yes : no);
}
