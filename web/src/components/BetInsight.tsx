import { Activity, ChevronDown } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import type { Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { every } from "../lib/poll.ts";
import { countdown, type MarketRow } from "../lib/format.ts";
import { fmtMin } from "../lib/num.ts";

interface Pt { observed_at: string; delay_sec: number; is_forecast: boolean }
interface Game { kickoff: string; home: string; away: string; hg: number; ag: number }
type M = Pick<MarketRow, "id" | "kind" | "category" | "params" | "target_at">;

/** Delay readings of the vehicle behind a bet against the line of the question: a small chart and the one number that matters. */
function DelayInsight({ m, pick, msg, now }: { m: M; pick: "yes" | "no"; msg: Messages; now: number }) {
  const t = msg.insight, [pts, setPts] = useState<Pt[] | null>(null);
  useEffect(() => {
    const go = () => sb.rpc("bet_delay_series", { p_market: m.id }).then(({ data }) => setPts(((data ?? []) as Pt[]).slice().reverse()));
    go();
    return every(go, 30_000);
  }, [m.id]);
  const lineMin = Number(m.params.thresholdSec ?? 300) / 60;
  if (pts === null) return <div class="sk s" />;
  if (pts.length === 0) return <p class="hint">{t.noReadings}</p>;
  const last = pts[pts.length - 1]!, cur = Math.round(last.delay_sec / 60), over = last.delay_sec / 60 > lineMin;
  const W = 300, H = 90, P = 6, t0 = Date.parse(pts[0]!.observed_at), t1 = Math.max(Date.parse(last.observed_at), t0 + 60_000);
  const vals = pts.map((x) => x.delay_sec / 60), lo = Math.min(0, ...vals), hi = Math.max(lineMin * 1.4, ...vals, 1);
  const X = (ms: number) => P + ((ms - t0) / (t1 - t0)) * (W - 2 * P), Y = (v: number) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P);
  const path = pts.map((x, i) => `${i ? "L" : "M"}${X(Date.parse(x.observed_at)).toFixed(1)} ${Y(x.delay_sec / 60).toFixed(1)}`).join("");
  const winning = (pick === "yes") === over;
  return (
    <div class="insight">
      <div class="insrow"><span class="detail">{t.delayNow}</span><b class={`num ${winning ? "pos" : "neg"}`}>{fmtMin(cur, undefined, true)}</b></div>
      <svg viewBox={`0 0 ${W} ${H}`} class="inschart" role="img" aria-label={t.chartLabel}>
        <line x1={P} x2={W - P} y1={Y(lineMin)} y2={Y(lineMin)} class="insline" />
        <text x={W - P} y={Y(lineMin) - 3} text-anchor="end" class="inslabel">{t.line(Math.round(lineMin))}</text>
        <path d={path} class="inspath" fill="none" />
        {pts.map((x, i) => <circle key={i} cx={X(Date.parse(x.observed_at))} cy={Y(x.delay_sec / 60)} r={i === pts.length - 1 ? 3.4 : 1.8} class={x.is_forecast ? "inspt fc" : "inspt"} />)}
      </svg>
      <p class="hint">{winning ? t.goingWell : t.goingBad} · {t.updated(Math.max(0, Math.round((now - Date.parse(last.observed_at)) / 60_000)))}{last.is_forecast ? ` · ${t.forecast}` : ""}</p>
    </div>
  );
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : 0);
function Form({ team, games, msg }: { team: string; games: Game[]; msg: Messages }) {
  const t = msg.insight, rows = games.slice(0, 5).map((g) => { const home = g.home === team, f = home ? g.hg : g.ag, a = home ? g.ag : g.hg; return { f, a, r: f > a ? "w" : f < a ? "l" : "d" }; });
  const pts = rows.length > 0 && avg(rows.map((r) => r.f)) > 15;
  return (
    <div class="insteam">
      <b class="insname">{team}</b>
      {rows.length === 0 ? <span class="hint">{t.noForm}</span> : <>
        <span class="insform">{rows.map((r, i) => <i key={i} class={`res ${r.r}`} title={`${r.f}-${r.a}`}>{t.res[r.r as "w" | "d" | "l"]}</i>)}</span>
        <span class="detail">{pts ? t.pointsFor : t.goalsFor}: <b class="num">{avg(rows.map((r) => r.f))}</b></span>
        <span class="detail">{pts ? t.pointsAgainst : t.goalsAgainst}: <b class="num">{avg(rows.map((r) => r.a))}</b></span>
      </>}
    </div>
  );
}

/** Last results and goals of both teams, and how likely the pick is according to the odds model. */
function MatchInsight({ m, pick, msg, now }: { m: M; pick: "yes" | "no"; msg: Messages; now: number }) {
  const t = msg.insight, home = String(m.params.home ?? ""), away = String(m.params.away ?? "");
  const [h, setH] = useState<Game[] | null>(null), [a, setA] = useState<Game[] | null>(null);
  useEffect(() => {
    let live = true;
    sb.rpc("team_recent", { p_team: home }).then(({ data }) => { if (live) setH((data ?? []) as Game[]); });
    sb.rpc("team_recent", { p_team: away }).then(({ data }) => { if (live) setA((data ?? []) as Game[]); });
    return () => { live = false; };
  }, [home, away]);
  const [live, setLive] = useState<{ home_score: number; away_score: number; state: "in" | "post"; clock: string } | null>(null);
  useEffect(() => {
    const go = () => sb.from("live_scores").select("home_score,away_score,state,clock").eq("event_id", String(m.params.eventId ?? "")).maybeSingle().then(({ data }) => setLive((data as typeof live) ?? null));
    if (!m.params.eventId) return;
    go();
    return every(go, 30_000);
  }, [m.params.eventId]);
  const pr = (m.params.priors as Record<string, number> | undefined)?.[String(m.params.bet)];
  const chance = Number.isFinite(pr) ? Math.round((pick === "yes" ? pr! : 1 - pr!) * 100) : null;
  if (h === null || a === null) return <div class="sk s" />;
  return (
    <div class="insight">
      {Date.parse(m.target_at) > now && <div class="insrow"><span class="detail">{msg.bets.settles}</span><b class="num">{countdown(Date.parse(m.target_at) - now)}</b></div>}
      {live && <div class="inslive"><b class="num">{live.home_score} – {live.away_score}</b><span class="detail">{live.state === "in" ? `${t.liveNow}${live.clock ? ` · ${live.clock}` : ""}` : t.finalScore}</span></div>}
      <div class="insgrid"><Form team={home} games={h} msg={msg} /><Form team={away} games={a} msg={msg} /></div>
      {chance !== null && <div class="insrow"><span class="detail">{t.chance}</span><b class="num">{chance}%</b></div>}
      {!live && <p class="hint">{t.waitMatch}</p>}
    </div>
  );
}

/** Fold-away panel under an open bet: what to look at to see how it is going. */
export function BetInsight({ m, pick, msg, now }: { m: M; pick: "yes" | "no"; msg: Messages; now: number }) {
  const [open, setOpen] = useState(false);
  const delay = (m.kind === "train_delay_gt" || m.kind === "bus_delay_gt") && !!m.params.tripId, match = m.kind === "match_bet" && !!m.params.home && !!m.params.away && !/^(pg|pa|ps):/.test(String(m.params.bet));
  const started = now >= Number(m.params.kickoff ?? 0) * 1000;
  if (!delay && !match) return null;
  return (
    <div class="betinsight">
      <button class="insbtn" aria-expanded={open} onClick={() => setOpen(!open)}><Activity size={15} />{delay || started ? msg.insight.how : msg.insight.howMatch}<ChevronDown size={16} class={open ? "up" : ""} /></button>
      {open && (delay ? <DelayInsight m={m} pick={pick} msg={msg} now={now} /> : <MatchInsight m={m} pick={pick} msg={msg} now={now} />)}
    </div>
  );
}
