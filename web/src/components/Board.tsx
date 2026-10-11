import { formatWhen, type MarketRow } from "../lib/format.ts";
import { cityOf } from "../lib/cities.ts";
import type { Locale, Messages } from "../i18n/index.ts";
import type { LiveDelay } from "../lib/types.ts";
import { Flap } from "./Flap.tsx";

/** Amber departure board listing what is running late right now. */
export function Board({ rows, msg, locale, now }: { rows: { m: MarketRow; live: LiveDelay }[]; msg: Messages; locale: Locale; now: number }) {
  return (
    <section class="board">
      <header><h3>{msg.board.title}</h3><span>{formatWhen(new Date(now).toISOString(), locale, Intl.DateTimeFormat().resolvedOptions().timeZone)}</span></header>
      <p class="sub">{msg.board.sub}</p>
      {rows.length === 0 && <p class="none">{msg.board.none}</p>}
      {rows.map(({ m, live }, i) => {
        const min = Math.round(live.delay_sec / 60);
        const tone = live.delay_sec > Number(m.params.thresholdSec ?? 180) ? "bad" : live.delay_sec > 60 ? "warn" : "good";
        return (
          <div class="brow" key={m.id} style={`--i:${i}`}>
            <span class="t">{formatWhen(String(m.target_at), locale, cityOf(m.city_id).timezone, new Date(now))}</span>
            <Flap text={String(m.params.routeName ?? "")} max={6} />
            <span class="st">{String(m.params.stopName ?? "").toUpperCase()}<small><i class="dot" />{live.is_forecast ? msg.card.forecast : msg.card.live}</small></span>
            <b class={`d ${tone}`}>{min > 0 ? "+" : ""}{min}'</b>
          </div>
        );
      })}
    </section>
  );
}
