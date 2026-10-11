/** Flags as tiny SVGs: emoji flags show up as plain letters on Windows. */
export function Flag({ cc, size = 16 }: { cc: string; size?: number }) {
  const base = { width: Math.round(size * 1.4), height: size, viewBox: "0 0 28 20", class: "flag", "aria-hidden": true } as const;
  switch (cc.toUpperCase()) {
    case "IT": return <svg {...base}><rect width="9.4" height="20" fill="#009246" /><rect x="9.4" width="9.2" height="20" fill="#fff" /><rect x="18.6" width="9.4" height="20" fill="#ce2b37" /></svg>;
    case "NL": return <svg {...base}><rect width="28" height="6.7" fill="#ae1c28" /><rect y="6.7" width="28" height="6.6" fill="#fff" /><rect y="13.3" width="28" height="6.7" fill="#21468b" /></svg>;
    case "JP": return <svg {...base}><rect width="28" height="20" fill="#fff" /><circle cx="14" cy="10" r="5.6" fill="#bc002d" /></svg>;
    default: return <svg {...base}><rect width="28" height="20" rx="2" fill="#2a3040" /><text x="14" y="14" text-anchor="middle" font-size="9" font-family="sans-serif" fill="#cfd5e0">{cc.toUpperCase()}</text></svg>;
  }
}
