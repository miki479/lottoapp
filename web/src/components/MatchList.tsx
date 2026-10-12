import { ChevronRight } from "lucide-preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { INTL_TAG } from "../i18n/index.ts";
import { fmtOdds, type MarketRow } from "../lib/format.ts";
import type { Pick } from "../lib/types.ts";
import { computeOdds } from "../../../shared/odds.ts";
import { DETAIL_LEAGUES, TWO_WAY_LEAGUES } from "../../../shared/sport.ts";
import { sb } from "../lib/api.ts";
import { Sheet } from "./Sheet.tsx";
import { Users, X } from "lucide-preact";

interface LinePlayer { id: number; name: string; pos: string; side: "home" | "away"; pg: { yes: number; no: number } | null; pa: { yes: number; no: number } | null; ps: { yes: number; no: number } | null }
/** Lineups already seen (an hour before a match they do not change): asked once, not at every tap. */
const LINEUPS = new Map<string, { at: number; v: { players: LinePlayer[]; ready: boolean } }>();
export interface Match { eventId: string; league: string; home: string; away: string; kickoff: number; priors: Record<string, number>; markets: Map<string, MarketRow> }

/** Groups the open football markets by match. */
export function groupMatches(list: MarketRow[]): Match[] {
  const by = new Map<string, Match>();
  for (const m of list) {
    if (m.kind !== "match_bet") continue;
    const id = String(m.params.eventId);
    const e = by.get(id) ?? { eventId: id, league: String(m.params.league), home: String(m.params.home), away: String(m.params.away), kickoff: Number(m.params.kickoff), priors: (m.params.priors ?? {}) as Record<string, number>, markets: new Map<string, MarketRow>() };
    e.markets.set(String(m.params.bet), m); by.set(id, e);
  }
  return [...by.values()].sort((a, b) => a.kickoff - b.kickoff);
}

const sum = (mt: Match, a: string, b: string) => (typeof mt.priors[a] === "number" && typeof mt.priors[b] === "number" ? (mt.priors[a]! + mt.priors[b]!) : undefined);

/** The odds shown on a button: the real market's, or what the market would pay if it were opened now. */
const oddsOf = (mt: Match, bet: string, side: "yes" | "no"): number | null => {
  const m = mt.markets.get(bet);
  if (m) return Number(side === "yes" ? m.odds_yes : m.odds_no);
  const pr = mt.priors[bet] ?? (bet === "dc_1x" ? sum(mt, "home_win", "draw") : bet === "dc_x2" ? sum(mt, "draw", "away_win") : bet === "dc_12" ? sum(mt, "home_win", "away_win") : undefined);
  if (typeof pr !== "number") return null;
  const o = computeOdds(Math.min(0.9, Math.max(0.1, pr)));
  return side === "yes" ? o.yes : o.no;
};

/** Opens (or creates, once) the market for one reason of one match, then hands it over to the bet slip. */
async function ensure(mt: Match, bet: string): Promise<MarketRow | null> {
  const have = mt.markets.get(bet);
  if (have) return have;
  const { data } = await sb.functions.invoke("market-offer", { body: { type: "match", eventId: mt.eventId, bet } });
  return (data?.market as MarketRow | undefined) ?? null;
}

function OddsBtn(p: { label: string; odds: number | null; locale: Locale; onClick: () => void; busy?: boolean }) {
  return <button class="oddsbtn" disabled={p.odds === null || p.busy} onClick={p.onClick}><span>{p.label}</span><b class="num">{p.odds === null ? "–" : fmtOdds(p.odds, p.locale)}</b></button>;
}

/** Football the way betting sites show it: one row per match with 1-X-2, and "all markets" for goals, double chance, clean sheets. */
export function MatchList(p: { matches: Match[]; msg: Messages; locale: Locale; onPick: (m: MarketRow, pick: Pick) => void; registered: boolean; onAuth: () => void; details: boolean; friendBets?: Record<string, number> }) {
  const u = p.msg.sportui;
  const [open, setOpen] = useState<Match | null>(null), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const [adv, setAdv] = useState(() => { try { return localStorage.getItem("sportadv") === "1"; } catch { return false; } });
  const setMode = (v: boolean) => { setAdv(v); try { localStorage.setItem("sportadv", v ? "1" : "0"); } catch { /* */ } };
  const [tab, setTab] = useState<"main" | "half" | "corners" | "cards" | "players">("main");
  const [lineup, setLineup] = useState<{ players: LinePlayer[]; ready: boolean } | null | undefined>(undefined);
  useEffect(() => {
    if (tab !== "players" || !open) return;
    const hit = LINEUPS.get(open.eventId);
    if (hit && Date.now() - hit.at < 5 * 60_000 && hit.v.ready) { setLineup(hit.v); return; }
    let live = true; setLineup(undefined);
    sb.functions.invoke("market-offer", { body: { type: "lineup", eventId: open.eventId } }).then(({ data }) => { const v = (data as { players: LinePlayer[]; ready: boolean } | null) ?? null; if (v) LINEUPS.set(open.eventId, { at: Date.now(), v }); if (live) setLineup(v); });
    return () => { live = false; };
  }, [tab, open?.eventId]);
  const hasDetails = !!open && p.details && DETAIL_LEAGUES.includes(open.league);
  const line = (l: string) => (p.locale === "it" ? l.replace("_", ",") : l.replace("_", "."));
  const leagues = useMemo(() => [...new Set(p.matches.map((m) => m.league))], [p.matches]);
  const [league, setLeague] = useState("");
  const when = (e: number) => new Intl.DateTimeFormat(INTL_TAG[p.locale], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(e * 1000));
  const go = async (mt: Match, bet: string, pick: Pick) => {
    setErr(null);
    const have = mt.markets.get(bet);
    if (!have && !p.registered) { setErr(u.needAccount); p.onAuth(); return; }
    setBusy(true);
    const m = await ensure(mt, bet);
    setBusy(false);
    if (!m) { setErr(u.unavailable); return; }
    mt.markets.set(bet, m);
    setOpen(null);
    p.onPick(m, pick);
  };
  const shown = p.matches.filter((m) => !league || m.league === league);
  const fr = (mt: Match) => Math.max(0, ...[...mt.markets.values()].map((x) => p.friendBets?.[x.id] ?? 0));
  const Row = (mt: Match) => {
    const two = TWO_WAY_LEAGUES.includes(mt.league);
    if (!adv) return (
      <article class={`card matchrow simple ${fr(mt) > 0 ? "has-friends" : ""}`} key={mt.eventId}>
        {fr(mt) > 0 && <span class="frbadge" title={p.msg.frd.friendsOn(fr(mt))} aria-label={p.msg.frd.friendsOn(fr(mt))}><Users size={13} />{fr(mt)}</span>}
        <div class="mhead"><span class="detail">{mt.league} · {when(mt.kickoff)}</span></div>
        <b class="teams">{p.msg.question.match({ bet: "home_win", home: mt.home, away: mt.away, time: "" }).replace(/\?.*$/, "?")}</b>
        <div class="oddsrow two">
          <OddsBtn label={u.yes} odds={oddsOf(mt, "home_win", "yes")} locale={p.locale} busy={busy} onClick={() => go(mt, "home_win", "yes")} />
          <OddsBtn label={u.no} odds={oddsOf(mt, "home_win", "no")} locale={p.locale} busy={busy} onClick={() => go(mt, "home_win", "no")} />
        </div>
      </article>
    );
    return (
      <article class={`card matchrow ${fr(mt) > 0 ? "has-friends" : ""}`} key={mt.eventId}>
        {fr(mt) > 0 && <span class="frbadge" title={p.msg.frd.friendsOn(fr(mt))} aria-label={p.msg.frd.friendsOn(fr(mt))}><Users size={13} />{fr(mt)}</span>}
        <div class="mhead"><span class="detail">{mt.league} · {when(mt.kickoff)}</span>{!two && <button class="more" onClick={() => { setTab("main"); setOpen(mt); }}>{u.allMarkets}<ChevronRight size={14} /></button>}</div>
        <b class="teams">{mt.home} – {mt.away}</b>
        <div class={`oddsrow ${two ? "two" : ""}`}>
          <OddsBtn label="1" odds={oddsOf(mt, "home_win", "yes")} locale={p.locale} busy={busy} onClick={() => go(mt, "home_win", "yes")} />
          {!two && <OddsBtn label="X" odds={oddsOf(mt, "draw", "yes")} locale={p.locale} busy={busy} onClick={() => go(mt, "draw", "yes")} />}
          <OddsBtn label="2" odds={oddsOf(mt, "away_win", "yes")} locale={p.locale} busy={busy} onClick={() => go(mt, "away_win", "yes")} />
        </div>
      </article>
    );
  };
  const group = (title: string, children: preact.ComponentChildren) => <section class="mgroup"><span class="detail">{title}</span><div class="oddsrow">{children}</div></section>;
  const t = p.msg.matchmaker.bets;
  return (
    <>
      <div class="mkchips modes" role="tablist">{([false, true] as const).map((v) => <button key={String(v)} role="tab" aria-selected={adv === v} class={`mkchip ${adv === v ? "on" : ""}`} onClick={() => setMode(v)}>{v ? u.advanced : u.simple}</button>)}</div>
      {leagues.length > 1 && <div class="mkchips"><button class={`mkchip ${league === "" ? "on" : ""}`} onClick={() => setLeague("")}>{u.all}</button>{leagues.map((l) => <button key={l} class={`mkchip ${league === l ? "on" : ""}`} onClick={() => setLeague(l)}>{l}</button>)}</div>}
      {err && <p class="formerr" role="alert">{err}</p>}
      {shown.length === 0 && <p class="hint">{u.noMatches}</p>}
      <div class="matchlist">{shown.slice(0, 60).map(Row)}</div>
      {open && (
        <Sheet onClose={() => setOpen(null)} label={`${open.home} – ${open.away}`}>
          <div class="shead"><h2>{open.home} – {open.away}</h2><button class="iconbtn" onClick={() => setOpen(null)} aria-label={p.msg.common.close}><X size={22} /></button></div>
          <span class="byline">{open.league} · {when(open.kickoff)}</span>
          {err && <p class="formerr" role="alert">{err}</p>}
          {hasDetails && <div class="mkchips">{([["main", u.finalT], ["half", u.halves], ["corners", u.cornersT], ["cards", u.cardsT], ["players", u.players]] as const).map(([k, l]) => <button key={k} class={`mkchip ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{l}</button>)}</div>}
          {(tab === "main" || !hasDetails) && <>
          {group(u.result, <>
            <OddsBtn label="1" odds={oddsOf(open, "home_win", "yes")} locale={p.locale} busy={busy} onClick={() => go(open, "home_win", "yes")} />
            <OddsBtn label="X" odds={oddsOf(open, "draw", "yes")} locale={p.locale} busy={busy} onClick={() => go(open, "draw", "yes")} />
            <OddsBtn label="2" odds={oddsOf(open, "away_win", "yes")} locale={p.locale} busy={busy} onClick={() => go(open, "away_win", "yes")} />
          </>)}
          {group(u.double, (["dc_1x", "dc_x2", "dc_12"] as const).map((b) => <OddsBtn key={b} label={b === "dc_1x" ? "1X" : b === "dc_x2" ? "X2" : "12"} odds={oddsOf(open, b, "yes")} locale={p.locale} busy={busy} onClick={() => go(open, b, "yes")} />))}
          {([["over_1_5", "1,5"], ["over_2_5", "2,5"], ["over_3_5", "3,5"]] as const).map(([b, line]) => group(`${u.goals} ${p.locale === "it" ? line : line.replace(",", ".")}`, <>
            <OddsBtn label={u.over} odds={oddsOf(open, b, "yes")} locale={p.locale} busy={busy} onClick={() => go(open, b, "yes")} />
            <OddsBtn label={u.under} odds={oddsOf(open, b, "no")} locale={p.locale} busy={busy} onClick={() => go(open, b, "no")} />
          </>))}
          {group(u.goalNo, <>
            <OddsBtn label={u.goal} odds={oddsOf(open, "btts", "yes")} locale={p.locale} busy={busy} onClick={() => go(open, "btts", "yes")} />
            <OddsBtn label={u.noGoal} odds={oddsOf(open, "btts", "no")} locale={p.locale} busy={busy} onClick={() => go(open, "btts", "no")} />
          </>)}
          {group(u.clean, <>
            <OddsBtn label={`${u.cleanHome} ${open.home}`} odds={oddsOf(open, "home_clean", "yes")} locale={p.locale} busy={busy} onClick={() => go(open, "home_clean", "yes")} />
            <OddsBtn label={`${u.cleanAway} ${open.away}`} odds={oddsOf(open, "away_clean", "yes")} locale={p.locale} busy={busy} onClick={() => go(open, "away_clean", "yes")} />
          </>)}
          </>}
          {tab === "half" && hasDetails && <>
            {group(u.firstHalf, <><OddsBtn label="1" odds={oddsOf(open, "ht_home", "yes")} locale={p.locale} busy={busy} onClick={() => go(open, "ht_home", "yes")} /> <OddsBtn label="X" odds={oddsOf(open, "ht_draw", "yes")} locale={p.locale} busy={busy} onClick={() => go(open, "ht_draw", "yes")} /> <OddsBtn label="2" odds={oddsOf(open, "ht_away", "yes")} locale={p.locale} busy={busy} onClick={() => go(open, "ht_away", "yes")} /></>)}
            {group(`${u.firstHalf} · ${u.halfGoal}`, <>
            <OddsBtn label={u.yes} odds={oddsOf(open, "ht_goal", "yes")} locale={p.locale} busy={busy} onClick={() => go(open, "ht_goal", "yes")} />
            <OddsBtn label={u.no} odds={oddsOf(open, "ht_goal", "no")} locale={p.locale} busy={busy} onClick={() => go(open, "ht_goal", "no")} />
            </>)}
            {group(u.secondHalf, <><OddsBtn label="1" odds={oddsOf(open, "st_home", "yes")} locale={p.locale} busy={busy} onClick={() => go(open, "st_home", "yes")} /> <OddsBtn label="X" odds={oddsOf(open, "st_draw", "yes")} locale={p.locale} busy={busy} onClick={() => go(open, "st_draw", "yes")} /> <OddsBtn label="2" odds={oddsOf(open, "st_away", "yes")} locale={p.locale} busy={busy} onClick={() => go(open, "st_away", "yes")} /></>)}
            {group(`${u.secondHalf} · ${u.halfGoal}`, <>
            <OddsBtn label={u.yes} odds={oddsOf(open, "st_goal", "yes")} locale={p.locale} busy={busy} onClick={() => go(open, "st_goal", "yes")} />
            <OddsBtn label={u.no} odds={oddsOf(open, "st_goal", "no")} locale={p.locale} busy={busy} onClick={() => go(open, "st_goal", "no")} />
            </>)}
          </>}
          {tab === "corners" && hasDetails && <>
            {group(`${u.cornersT} ${line("8_5")}`, <>
              <OddsBtn label={u.over} odds={oddsOf(open, "corners_8_5", "yes")} locale={p.locale} busy={busy} onClick={() => go(open, "corners_8_5", "yes")} />
              <OddsBtn label={u.under} odds={oddsOf(open, "corners_8_5", "no")} locale={p.locale} busy={busy} onClick={() => go(open, "corners_8_5", "no")} />
            </>)}
            {group(`${u.cornersT} ${line("9_5")}`, <>
              <OddsBtn label={u.over} odds={oddsOf(open, "corners_9_5", "yes")} locale={p.locale} busy={busy} onClick={() => go(open, "corners_9_5", "yes")} />
              <OddsBtn label={u.under} odds={oddsOf(open, "corners_9_5", "no")} locale={p.locale} busy={busy} onClick={() => go(open, "corners_9_5", "no")} />
            </>)}
            {group(`${u.cornersT} ${line("10_5")}`, <>
              <OddsBtn label={u.over} odds={oddsOf(open, "corners_10_5", "yes")} locale={p.locale} busy={busy} onClick={() => go(open, "corners_10_5", "yes")} />
              <OddsBtn label={u.under} odds={oddsOf(open, "corners_10_5", "no")} locale={p.locale} busy={busy} onClick={() => go(open, "corners_10_5", "no")} />
            </>)}
            {group(`${u.cornersT} ${line("11_5")}`, <>
              <OddsBtn label={u.over} odds={oddsOf(open, "corners_11_5", "yes")} locale={p.locale} busy={busy} onClick={() => go(open, "corners_11_5", "yes")} />
              <OddsBtn label={u.under} odds={oddsOf(open, "corners_11_5", "no")} locale={p.locale} busy={busy} onClick={() => go(open, "corners_11_5", "no")} />
            </>)}
          </>}
          {tab === "players" && hasDetails && <>
            {lineup === undefined && <div class="sk s" />}
            {lineup !== undefined && !(lineup?.ready) && <p class="hint">{u.noLineup}</p>}
            {lineup?.ready && (["home", "away"] as const).map((side) => (
              <section key={side} class="stack plteam" style="gap:6px">
                <span class="detail">{side === "home" ? open.home : open.away}</span>
                {lineup.players.filter((x) => x.side === side).map((x) => (
                  <div class="plrow" key={x.id}>
                    <span class="plname"><b>{x.name}</b><em>{x.pos}</em></span>
                    <span class="pls">
                      {([["pg", u.pgL], ["pa", u.paL], ["ps", u.psL]] as const).map(([k, l]) => x[k] ? <button key={k} class="oddsbtn mini" disabled={busy} onClick={() => go(open, `${k}:${x.id}`, "yes")}><span>{l}</span><b class="num">{fmtOdds(x[k]!.yes, p.locale)}</b></button> : <span key={k} />)}
                    </span>
                  </div>
                ))}
              </section>
            ))}
          </>}
          {tab === "cards" && hasDetails && <>
            {group(`${u.cardsT} ${line("3_5")}`, <>
              <OddsBtn label={u.over} odds={oddsOf(open, "cards_3_5", "yes")} locale={p.locale} busy={busy} onClick={() => go(open, "cards_3_5", "yes")} />
              <OddsBtn label={u.under} odds={oddsOf(open, "cards_3_5", "no")} locale={p.locale} busy={busy} onClick={() => go(open, "cards_3_5", "no")} />
            </>)}
            {group(`${u.cardsT} ${line("4_5")}`, <>
              <OddsBtn label={u.over} odds={oddsOf(open, "cards_4_5", "yes")} locale={p.locale} busy={busy} onClick={() => go(open, "cards_4_5", "yes")} />
              <OddsBtn label={u.under} odds={oddsOf(open, "cards_4_5", "no")} locale={p.locale} busy={busy} onClick={() => go(open, "cards_4_5", "no")} />
            </>)}
            {group(`${u.cardsT} ${line("5_5")}`, <>
              <OddsBtn label={u.over} odds={oddsOf(open, "cards_5_5", "yes")} locale={p.locale} busy={busy} onClick={() => go(open, "cards_5_5", "yes")} />
              <OddsBtn label={u.under} odds={oddsOf(open, "cards_5_5", "no")} locale={p.locale} busy={busy} onClick={() => go(open, "cards_5_5", "no")} />
            </>)}
            {group(u.redT, <>
            <OddsBtn label={u.yes} odds={oddsOf(open, "red_card", "yes")} locale={p.locale} busy={busy} onClick={() => go(open, "red_card", "yes")} />
            <OddsBtn label={u.no} odds={oddsOf(open, "red_card", "no")} locale={p.locale} busy={busy} onClick={() => go(open, "red_card", "no")} />
            </>)}
          </>}
          <p class="hint">{t.home_win}: 1 · {t.draw}: X · {t.away_win}: 2</p>
        </Sheet>
      )}
    </>
  );
}
