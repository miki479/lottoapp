/** A short, readable label for a tile row: "Sneltrein RE6" -> "RE6", "Intercity direct" -> "Intercit". */
export function shortLabel(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if ([...t].length <= max) return t;
  const parts = t.split(" ");
  const code = [...parts].reverse().find((w) => /\d/.test(w) && [...w].length <= max);
  return code ?? [...parts[0]!].slice(0, max).join("");
}

/** Split-flap style label: each character sits in its own tile and flips in, one after the other. */
export function Flap({ text, max = 8 }: { text: string; max?: number }) {
  const chars = [...shortLabel(text, max)];
  return (
    <span class="flap" aria-label={text}>
      {chars.map((c, i) => <b key={`${i}${c}`} style={`animation-delay:${i * 70}ms`}>{c === " " ? "\u00a0" : c}</b>)}
    </span>
  );
}
