import { useEffect, useState } from "preact/hooks";

/** One quiet line that swaps between recent results and tips. Text comes and goes, nothing scrolls. */
export function LiveLine({ items, label }: { items: string[]; label: string }) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => x + 1), 4500); return () => clearInterval(t); }, []);
  if (items.length === 0) return null;
  return <div class="liveline" aria-live="off"><i class="dot" /><span class="detail">{label}</span><span key={i % items.length}>{items[i % items.length]}</span></div>;
}
