import { cityName, cityOf } from "../lib/cities.ts";
import { countdown, fmtOdds, question } from "../lib/format.ts";
import type { Locale, Messages } from "../i18n/index.ts";
import type { MyBet } from "../lib/types.ts";

export function Mine({ bets, msg, locale, now }: { bets: MyBet[]; msg: Messages; locale: Locale; now: number }) {
  if (bets.length === 0) return <div class="view"><p class="muted empty">{msg.empty.mine}</p></div>;
  return (
    <div class="view">
      {bets.map((b, i) => {
        const m = b.markets, city = cityOf(m.city_id);
        const stamp = b.status === "won" ? msg.mine.stamp.won : b.status === "lost" ? msg.mine.stamp.lost : msg.mine.stamp.void;
        return (
          <article class={`card static bet ${b.status}`} key={b.id} style={`--i:${Math.min(i, 10)}`}>
            {b.status !== "open" && <span class={`stamp ${b.status}`}>{stamp}</span>}
            <p class="q">{question(m, msg, locale, cityName(city, locale), city.timezone, new Date(now))}</p>
            <div class="meta">
              <span>{msg.mine.yourPick(b.pick === "yes")}</span>
              <span class="mono">{b.stake} × {fmtOdds(Number(b.odds), locale)}</span>
              {b.status === "open" && <span class="timer"><small>{msg.mine.settles}</small> <b>{countdown(Date.parse(m.target_at) - now)}</b></span>}
              {b.status === "won" && <b class="good">{msg.mine.won(b.payout - b.stake)}</b>}
            </div>
            {b.status === "void" && m.void_reason && <small class="muted">{msg.mine.voidReason[m.void_reason] ?? ""}</small>}
          </article>
        );
      })}
    </div>
  );
}
