import { Q } from "../components/Q.tsx";
import { ArrowDownToLine, Check, Clock, Flame, RotateCcw, Ticket, TrendingDown, X } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { sb } from "../lib/api.ts";
import { INTL_TAG } from "../i18n/index.ts";
import { summarize, type DayNet } from "../lib/summary.ts";
import { MarketVs, reasonOf } from "../components/MatchVs.tsx";
import { BetInsight } from "../components/BetInsight.tsx";
import { StopsBoard } from "../components/StopsBoard.tsx";
import { Collapse } from "../components/Collapse.tsx";
import { Empty } from "../components/Empty.tsx";
import type { Locale, Messages } from "../i18n/index.ts";
import { cityName, cityOf } from "../lib/cities.ts";
import { countdown, fmtOdds, isYesNo, money, potentialWin, question, trainLabel } from "../lib/format.ts";
import type { Challenge } from "../components/ChallengeSheet.tsx";
import { TWO_WAY_LEAGUES } from "../../../shared/sport.ts";
import type { MyBet, ParlayRow } from "../lib/types.ts";
import type { MarketRow } from "../lib/format.ts";
import { moneySigned } from "../lib/num.ts";
import { subjectOf } from "../lib/names.ts";
import { WhyBlock } from "../components/WhyBlock.tsx";

/** The days the figures at the top are counted over. */
const SUMMARY_DAYS = 30;

/** "Result in 16m 28s", brighter when it is close; once the time has passed, a line that says it is waiting for the data. */
function Due({ at, now, msg, seed }: { at: number; now: number; msg: Messages; seed: string }) {
  const left = at - now;
  return <span class={`due ${left > 0 && left < 300_000 ? "soon" : ""}`}><Clock size={14} aria-hidden="true" />{left > 0 ? <>{msg.bets.settles} <b class="num">{countdown(left)}</b></> : msg.bets.waiting[(Math.floor(now / 6000) + seed.charCodeAt(0)) % msg.bets.waiting.length]}</span>;
}

export function Bets({ streak, canMore, onMore, invites, challenges, onChallenge, parlays, bets, msg, locale, now, onOpen, onHome }: { streak: number; canMore: boolean; onMore: () => void; invites: (Challenge & { invited_by: string })[]; challenges: Challenge[]; onChallenge: (code: string) => void; parlays: ParlayRow[]; bets: MyBet[]; msg: Messages; locale: Locale; now: number; onOpen: (b: MyBet) => void; onHome: () => void }) {
  const [tab, setTab] = useState<"open" | "settled">("open");
  const [st, setSt] = useState<"all" | "won" | "lost" | "void">("all"), [cat, setCat] = useState("all");
  // football apart from the other sports (basketball, American football, hockey, baseball…): the leagues played to a winner are the "two-way" ones
  const keyOf = (b: MyBet) => (b.markets.category === "sport" ? (TWO_WAY_LEAGUES.includes(String(b.markets.params.league ?? "")) ? "othersport" : "football") : b.markets.category);
  const inTab = (status: string) => (tab === "open") === (status === "open");
  const cats = [...new Set(bets.filter((b) => inTab(b.status)).map((b) => keyOf(b)))];
  const catNow = (cats as string[]).includes(cat) ? cat : "all";
  const shown = bets.filter((b) => inTab(b.status) && (tab === "open" || st === "all" || b.status === st) && (catNow === "all" || keyOf(b) === catNow));
  const shownP = parlays.filter((x) => inTab(x.status) && (tab === "open" || st === "all" || x.status === st) && catNow === "all");
  const nOpen = bets.filter((b) => b.status === "open").length + parlays.filter((x) => x.status === "open").length;
  const nDone = bets.length + parlays.length - nOpen;
  // the results by day behind the three figures at the top: asked again whenever something has been settled
  const [series, setSeries] = useState<DayNet[] | null>(null);
  useEffect(() => { let live = true; sb.rpc("my_balance_series", { p_days: SUMMARY_DAYS }).then(({ data, error }) => { if (live) setSeries(error ? [] : ((data ?? []) as DayNet[]).map((d) => ({ day: String(d.day), net: Number(d.net), bets: Number(d.bets) }))); }); return () => { live = false; }; }, [nDone]);
  const sum = series ? summarize(series) : null, sm = msg.bets.summary;
  const dayFmt = new Intl.DateTimeFormat(INTL_TAG[locale], { day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <div class="screen stack">
      <h1>{msg.bets.title}</h1>
      {bets.length + parlays.length > 0 && (
        <section class="betsum" aria-label={msg.bets.title}>
          <div class="bsc"><span class="bsi"><Flame size={16} /></span><span class="bsl">{sm.streak}</span><b class="num">{msg.streak.days(streak)}</b></div>
          <div class="bsc"><span class="bsi"><TrendingDown size={16} /></span><span class="bsl">{sm.worst}</span>
            {sum?.worstDay ? <><b class="num neg">{moneySigned(sum.worstDay.net, locale)}</b><small>{dayFmt.format(new Date(`${sum.worstDay.day}T12:00:00Z`))}</small></>
              : sum && sum.days > 0 ? <><b class="bsempty">{sm.noLoss}</b><small>{sm.window(SUMMARY_DAYS)}</small></>
              : <><b class="bsempty">{series ? sm.noData : "…"}</b><small>{series ? sm.needData : ""}</small></>}</div>
          <div class="bsc"><span class="bsi"><ArrowDownToLine size={16} /></span><span class="bsl">{sm.drawdown}</span>
            {sum && sum.drawdown > 0 ? <><b class="num neg">{moneySigned(-sum.drawdown, locale)}</b><small>{sm.window(SUMMARY_DAYS)}</small></>
              : sum && sum.days > 0 ? <><b class="bsempty">{sm.atPeak}</b><small>{sm.window(SUMMARY_DAYS)}</small></>
              : <><b class="bsempty">{series ? sm.noData : "…"}</b><small>{series ? sm.needData : ""}</small></>}</div>
        </section>
      )}
      <div class="seg" role="tablist">
        <button role="tab" class={tab === "open" ? "on" : ""} aria-selected={tab === "open"} onClick={() => setTab("open")}>{msg.bets.tabs.open} · {nOpen}</button>
        <button role="tab" class={tab === "settled" ? "on" : ""} aria-selected={tab === "settled"} onClick={() => setTab("settled")}>{msg.bets.tabs.settled} · {nDone}</button>
      </div>
      <div class="stack" style="gap:6px">
        {tab === "settled" && <div class="mkchips">{(["all", "won", "lost", "void"] as const).map((k) => <button key={k} class={`mkchip ${st === k ? "on" : ""}`} aria-pressed={st === k} onClick={() => setSt(k)}>{msg.hist[k]}</button>)}</div>}
        {cats.length > 1 && <div class="mkchips"><button class={`mkchip ${catNow === "all" ? "on" : ""}`} aria-pressed={catNow === "all"} onClick={() => setCat("all")}>{msg.hist.all}</button>{cats.map((c) => <button key={c} class={`mkchip ${catNow === c ? "on" : ""}`} aria-pressed={catNow === c} onClick={() => setCat(c)}>{msg.tabs[c as keyof typeof msg.tabs] ?? c} · {bets.filter((b) => inTab(b.status) && keyOf(b) === c).length}</button>)}</div>}
      </div>
      {tab === "open" && invites.length > 0 && <Collapse id="inbox" class="inbox" title={msg.frd.inboxTitle} count={invites.length}>
        {invites.map((c) => <button key={c.id} class="card pressable chrow invite" onClick={() => onChallenge(c.code)}><span class="byline">{msg.frd.inboxFrom(c.invited_by)} · {countdown(Math.max(0, Date.parse(c.closes_at) - now))}</span><b>{c.title}</b><span class="invopen">{msg.frd.inboxOpen}</span></button>)}
      </Collapse>}
      {challenges.filter((c) => (tab === "open") === (c.status === "open")).length > 0 && <Collapse id="mychallenges" title={msg.friends.mine} count={challenges.filter((c) => (tab === "open") === (c.status === "open")).length} open={challenges.length <= 3}>
        {challenges.filter((c) => (tab === "open") === (c.status === "open")).map((c) => <button key={c.id} class="card pressable chrow" onClick={() => onChallenge(c.code)}><b>{c.title}</b><span class="byline">{msg.friends.cats[c.category]} · {c.status === "open" ? countdown(Math.max(0, Date.parse(c.closes_at) - now)) : c.status === "void" ? msg.friends.voided : c.outcome === "yes" ? msg.friends.resolvedYes : msg.friends.resolvedNo}</span></button>)}
      </Collapse>}
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
                {st === "open" && (() => { const last = Math.max(...x.parlay_legs.map((l) => Date.parse(String(l.markets.target_at ?? "")) || 0)); return last > 0 ? <Due at={last} now={now} msg={msg} seed={x.id} /> : null; })()}
                {st === "won" && <span class="amt won num">{moneySigned(x.payout - x.stake, locale)}</span>}
                {st === "lost" && <span class="amt lost num">−{money(x.stake, locale)}</span>}
                {st === "void" && <span class="amt num">{money(x.stake, locale)}</span>}
              </div>
              <ul class="legmini">
                {x.parlay_legs.map((l) => {
                  const c = cityOf(l.markets.city_id), rain = isYesNo(l.markets.kind);
                  const pickLabel = l.pick === "yes" ? (rain ? msg.card.yes : msg.card.late) : (rain ? msg.card.no : msg.card.onTime);
                  const text = l.markets.target_at ? question(l.markets as unknown as MarketRow, msg, locale, cityName(c, locale), c.timezone) : (trainLabel(String(l.markets.params.routeName ?? ""), l.markets.kind, locale) || cityName(c, locale));
                  return <li key={l.market_id} class={l.status}><span class="legq">{text}<em>{pickLabel}</em></span><b class="num">{fmtOdds(Number(l.odds), locale)}</b></li>;
                })}
              </ul>
              <div class="info"><span>{msg.slip.odds}</span><span class="num">{money(x.stake, locale)} × {fmtOdds(Number(x.odds), locale)}</span></div>
              {st === "open" && <div class="info win"><span>{msg.bets.potential}</span><b class="num">{money(potentialWin(x.stake, Number(x.odds), x.boosted), locale)}</b></div>}
            </div>
          );
        })}
        {shown.map((b, i) => {
          const m = b.markets, city = cityOf(m.city_id), st = b.status;
          const Icon = st === "won" ? Check : st === "lost" ? X : st === "void" ? RotateCcw : Ticket;
          const label = st === "won" ? msg.bets.won : st === "lost" ? msg.bets.lost : st === "void" ? msg.bets.void : m.kind === "match_bet" && now < Number(m.params.kickoff ?? 0) * 1000 ? msg.bets.upcoming : msg.bets.open;
          return (
            <div class="betwrap" key={b.id}>
            <button class="card bet pressable" style={`--i:${Math.min(i, 10)}; text-align:left`} onClick={() => (st !== "open" ? onOpen(b) : undefined)} disabled={st === "open"}>
              <div class="row1">
                <span class={`pill ${st === "won" ? "won" : st === "lost" ? "lost" : ""}`}><Icon size={14} strokeWidth={2.6} />{label}</span>
                {st === "won" && <span class="amt won num">{moneySigned(b.payout - b.stake, locale)}</span>}
                {st === "lost" && <span class="amt lost num">−{money(b.stake, locale)}</span>}
                {st === "void" && <span class="amt num">{money(b.stake, locale)}</span>}
                {st === "open" && <Due at={Date.parse(m.target_at)} now={now} msg={msg} seed={b.id} />}
              </div>
              {m.kind === "match_bet" && <div class="vscard"><MarketVs m={m} size={28} />{reasonOf(m, msg) && <span class="reason">{reasonOf(m, msg)}</span>}</div>}
              {m.kind !== "match_bet" && (() => { const sj = ["tick_gt", "bus_delay_gt", "train_delay_gt", "rain_at", "metric_gt"].includes(m.kind) ? subjectOf(m, msg, locale, cityName(city, locale)) : ""; return sj ? <b class="subject">{sj}</b> : null; })()}
              <p class="q"><Q m={m} msg={msg} locale={locale} city={cityName(city, locale)} tz={city.timezone} now={new Date(now)} /></p>
              <div class="info"><span>{msg.bets.yourPick(b.pick === "yes")}</span><span class="num">{money(b.stake, locale)} × {fmtOdds(Number(b.odds), locale)}</span></div>
              {st === "open" && <div class="info win"><span>{msg.bets.potential}</span><b class="num">{money(potentialWin(b.stake, Number(b.odds), b.boosted, b.vice_pct ?? 0), locale)}</b></div>}
              {b.bonus && <p class={`bonusline ${b.bonus_hit ? "hit" : ""}`}>{msg.bonus.line(msg.bonus[b.bonus])}{st !== "open" && st !== "void" ? ` · ${b.bonus_hit === true ? msg.bonus.hit : b.bonus_hit === false ? msg.bonus.miss : msg.bonus.unknown}` : ""}</p>}
            </button>
            {st === "open" && <BetInsight m={m} pick={b.pick} msg={msg} now={now} />}
            {st === "open" && <WhyBlock m={m} msg={msg} locale={locale} />}
            {st === "open" && (m.kind === "bus_delay_gt" || m.kind === "train_delay_gt") && <StopsBoard m={m} locale={locale} now={now} variant="bet" />}
            </div>
          );
        })}
      </div>
      {canMore && tab === "settled" && <button class="btn secondary wide" onClick={onMore}>{msg.hist.more}</button>}
    </div>
  );
}
