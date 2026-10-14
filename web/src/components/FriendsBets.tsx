import { ChevronRight, Users } from "lucide-preact";
import type { Locale, Messages } from "../i18n/index.ts";
import { cityName, cityOf } from "../lib/cities.ts";
import { friendRows } from "../lib/feed.ts";
import type { MarketRow } from "../lib/format.ts";
import type { Pick } from "../lib/types.ts";
import { Q } from "./Q.tsx";

/** "Gli amici puntano": the few open questions friends are on, with how many of them. Nothing when there are none. */
export function FriendsBets(p: { msg: Messages; locale: Locale; now: number; markets: MarketRow[] | null; bets: Record<string, number>; onPick: (m: MarketRow, pick: Pick) => void }) {
  const rows = friendRows(p.markets, p.bets, p.now);
  if (!rows.length) return null;
  return (
    <section class="friendsblock stack" aria-label={p.msg.frd.hot}>
      <div class="sectionhead"><h2>{p.msg.frd.hot}</h2></div>
      <ul class="frlist">
        {rows.map(({ m, n }) => {
          const c = cityOf(m.city_id);
          return (
            <li key={m.id}>
              <button class="frrow" onClick={() => p.onPick(m, "yes")}>
                <span class="frn"><Users size={16} aria-hidden="true" /><b class="num">{n}</b></span>
                <span class="frq"><span class="frt"><Q m={m} msg={p.msg} locale={p.locale} city={cityName(c, p.locale)} tz={c.timezone} now={new Date(p.now)} /></span><small>{p.msg.frd.friendsOn(n)}</small></span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
