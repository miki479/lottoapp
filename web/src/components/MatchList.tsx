import { ChevronRight } from "lucide-preact";
import { useMemo, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { INTL_TAG } from "../i18n/index.ts";
import { fmtOdds, type MarketRow } from "../lib/format.ts";
import type { Pick } from "../lib/types.ts";
import { computeOdds } from "../../../shared/odds.ts";
import { sb } from "../lib/api.ts";
import { Sheet } from "./Sheet.tsx";
import { X } from "lucide-preact";

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
export function MatchList(p: { matches: Match[]; msg: Messages; locale: Locale; onPick: (m: MarketRow, pick: Pick) => void; registered: boolean; onAuth: () => void }) {
  const u = p.msg.sportui;
  const [open, setOpen] = useState<Match | null>(null), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
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
    if (!m) { setErr(p.msg.maker.errors.generic); return; }
    mt.markets.set(bet, m);
    setOpen(null);
    p.onPick(m, pick);
  };
  const shown = p.matches.filter((m) => !league || m.league === league);
  const Row = (mt: Match) => (
    <article class="card matchrow" key={mt.eventId}>
      <div class="mhead"><span class="detail">{mt.league} · {when(mt.kickoff)}</span><button class="more" onClick={() => setOpen(mt)}>{u.allMarkets}<ChevronRight size={14} /></button></div>
      <b class="teams">{mt.home} – {mt.away}</b>
      <div class="oddsrow">
        <OddsBtn label="1" odds={oddsOf(mt, "home_win", "yes")} locale={p.locale} busy={busy} onClick={() => go(mt, "home_win", "yes")} />
        <OddsBtn label="X" odds={oddsOf(mt, "draw", "yes")} locale={p.locale} busy={busy} onClick={() => go(mt, "draw", "yes")} />
        <OddsBtn label="2" odds={oddsOf(mt, "away_win", "yes")} locale={p.locale} busy={busy} onClick={() => go(mt, "away_win", "yes")} />
      </div>
    </article>
  );
  const group = (title: string, children: preact.ComponentChildren) => <section class="mgroup"><span class="detail">{title}</span><div class="oddsrow">{children}</div></section>;
  const t = p.msg.matchmaker.bets;
  return (
    <>
      {leagues.length > 1 && <div class="mkchips"><button class={`mkchip ${league === "" ? "on" : ""}`} onClick={() => setLeague("")}>{u.all}</button>{leagues.map((l) => <button key={l} class={`mkchip ${league === l ? "on" : ""}`} onClick={() => setLeague(l)}>{l}</button>)}</div>}
      {err && <p class="formerr" role="alert">{err}</p>}
      {shown.length === 0 && <p class="hint">{u.noMatches}</p>}
      <div class="matchlist">{shown.slice(0, 60).map(Row)}</div>
      {open && (
        <Sheet onClose={() => setOpen(null)} label={`${open.home} – ${open.away}`}>
          <div class="shead"><h2>{open.home} – {open.away}</h2><button class="iconbtn" onClick={() => setOpen(null)} aria-label={p.msg.common.close}><X size={22} /></button></div>
          <span class="byline">{open.league} · {when(open.kickoff)}</span>
          {err && <p class="formerr" role="alert">{err}</p>}
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
          <p class="hint">{t.home_win}: 1 · {t.draw}: X · {t.away_win}: 2</p>
        </Sheet>
      )}
    </>
  );
}
