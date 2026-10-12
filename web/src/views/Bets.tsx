import { Q } from "../components/Q.tsx";
import { Check, RotateCcw, Ticket, X } from "lucide-preact";
import { useState } from "preact/hooks";
import { Empty } from "../components/Empty.tsx";
import type { Locale, Messages } from "../i18n/index.ts";
import { cityName, cityOf } from "../lib/cities.ts";
import { countdown, fmtOdds, isYesNo, money, question } from "../lib/format.ts";
import type { MyBet, ParlayRow } from "../lib/types.ts";

export function Bets({ parlays, bets, msg, locale, now, onOpen, onHome }: { parlays: ParlayRow[]; bets: MyBet[]; msg: Messages; locale: Locale; now: number; onOpen: (b: MyBet) => void; onHome: () => void }) {
  const [tab, setTab] = useState<"open" | "settled">("open");
  const shown = bets.filter((b) => (tab === "open" ? b.status === "open" : b.status !== "open"));
  const shownP = parlays.filter((x) => (tab === "open" ? x.status === "open" : x.status !== "open"));
  const nOpen = bets.filter((b) => b.status === "open").length + parlays.filter((x) => x.status === "open").length;
  const nDone = bets.length + parlays.length - nOpen;
  return (
    <div class="screen stack">
      <h1>{msg.bets.title}</h1>
      <div class="seg" role="tablist">
        <button role="tab" class={tab === "open" ? "on" : ""} aria-selected={tab === "open"} onClick={() => setTab("open")}>{msg.bets.tabs.open} · {nOpen}</button>
        <button role="tab" class={tab === "settled" ? "on" : ""} aria-selected={tab === "settled"} onClick={() => setTab("settled")}>{msg.bets.tabs.settled} · {nDone}</button>
      </div>
      {shown.length + shownP.length === 0 && <Empty icon={Ticket} title={msg.bets.empty.title} body={msg.bets.empty.body} cta={msg.bets.empty.cta} onCta={onHome} />}
      <div class="betlist">
        {shownP.map((x, i) => {
          const st = x.status, Icon = st === "won" ? Check : st === "lost" ? X : st === "void" ? RotateCcw : Ticket;
          const label = st === "won" ? msg.bets.won : st === "lost" ? msg.bets.lost : st === "void" ? msg.bets.void : msg.bets.open;
          return (
            <div class="card bet parlaycard" key={x.id} style={`--i:${Math.min(i, 10)}`}>
              <div class="row1">
                <span class={`pill ${st === "won" ? "won" : st === "lost" ? "lost" : ""}`}><Icon size={14} strokeWidth={2.6} />{label}</span>
                <span class="detail">{msg.slip.title} · {msg.slip.legs(x.parlay_legs.length)}</span>
                {st === "won" && <span class="amt won num">+{money(x.payout - x.stake, locale)}</span>}
                {st === "lost" && <span class="amt lost num">−{money(x.stake, locale)}</span>}
                {st === "void" && <span class="amt num">{money(x.stake, locale)}</span>}
              </div>
              <ul class="legmini">
                {x.parlay_legs.map((l) => {
                  const c = cityOf(l.markets.city_id), rain = isYesNo(l.markets.kind);
                  const pickLabel = l.pick === "yes" ? (rain ? msg.card.yes : msg.card.late) : (rain ? msg.card.no : msg.card.onTime);
                  return <li key={l.market_id} class={l.status}><span>{(String(l.markets.params.routeName ?? "") || cityName(c, locale))} · {pickLabel}</span><b class="num">{fmtOdds(Number(l.odds), locale)}</b></li>;
                })}
              </ul>
              <div class="info"><span>{msg.slip.odds}</span><span class="num">{money(x.stake, locale)} × {fmtOdds(Number(x.odds), locale)}</span></div>
            </div>
          );
        })}
        {shown.map((b, i) => {
          const m = b.markets, city = cityOf(m.city_id), st = b.status;
          const Icon = st === "won" ? Check : st === "lost" ? X : st === "void" ? RotateCcw : Ticket;
          const label = st === "won" ? msg.bets.won : st === "lost" ? msg.bets.lost : st === "void" ? msg.bets.void : msg.bets.open;
          return (
            <button class="card bet pressable" key={b.id} style={`--i:${Math.min(i, 10)}; text-align:left`} onClick={() => (st !== "open" ? onOpen(b) : undefined)} disabled={st === "open"}>
              <div class="row1">
                <span class={`pill ${st === "won" ? "won" : st === "lost" ? "lost" : ""}`}><Icon size={14} strokeWidth={2.6} />{label}</span>
                {st === "won" && <span class="amt won num">+{money(b.payout - b.stake, locale)}</span>}
                {st === "lost" && <span class="amt lost num">−{money(b.stake, locale)}</span>}
                {st === "void" && <span class="amt num">{money(b.stake, locale)}</span>}
                {st === "open" && <span class="detail">{msg.bets.settles} · {countdown(Date.parse(m.target_at) - now)}</span>}
              </div>
              <p class="q"><Q m={m} msg={msg} locale={locale} city={cityName(city, locale)} tz={city.timezone} now={new Date(now)} /></p>
              <div class="info"><span>{msg.bets.yourPick(b.pick === "yes")}</span><span class="num">{money(b.stake, locale)} × {fmtOdds(Number(b.odds), locale)}</span></div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
