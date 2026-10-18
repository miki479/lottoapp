import { useEffect, useState } from "preact/hooks";
import { sb } from "./api.ts";

const cache = new Map<string, { n: number; at: number }>();
const TTL = 90_000;

/**
 * How many bets a question has taken (a public count, nothing about who), for the featured GTA VI card and its banner.
 * One read when it shows, then one every ninety seconds while the page is open; the number is shared, so the card and the banner cost one request.
 */
export function useBetCount(marketId: string | undefined): number | null {
  const [n, setN] = useState<number | null>(() => (marketId ? cache.get(marketId)?.n ?? null : null));
  useEffect(() => {
    if (!marketId) return;
    let live = true;
    const load = async () => {
      const hit = cache.get(marketId);
      if (hit && Date.now() - hit.at < TTL) { setN(hit.n); return; }
      if (typeof document !== "undefined" && document.hidden) return;
      const { data, error } = await sb.rpc("market_bet_count", { p_market: marketId });
      if (!live || error || typeof data !== "number") return;
      cache.set(marketId, { n: data, at: Date.now() }); setN(data);
    };
    void load();
    const t = window.setInterval(() => void load(), TTL);
    return () => { live = false; window.clearInterval(t); };
  }, [marketId]);
  return n;
}
