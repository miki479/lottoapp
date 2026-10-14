import { useEffect, useState } from "preact/hooks";
import { isCrypto } from "../../../shared/ticks.ts";
import { INTL_TAG, type Locale, type Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import type { MarketRow } from "../lib/format.ts";
import { fmtPct } from "../lib/num.ts";
import { impliedYes, trend } from "../lib/trend.ts";
import type { LiveDelay } from "../lib/types.ts";

/** A thin line chart: the values left to right, an optional dashed line for the threshold, a dot on the latest value. One point alone is drawn as a flat line. */
function Spark({ pts, thr, tone }: { pts: number[]; thr?: number; tone: "up" | "down" | "flat" | "warn" }) {
  const W = 200, H = 34, pad = 4, v = pts.length < 2 ? [pts[0] ?? 0, pts[0] ?? 0] : pts;
  const all = thr !== undefined && Number.isFinite(thr) ? [...v, thr] : v, lo = Math.min(...all), hi = Math.max(...all), span = hi - lo || 1;
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (v.length - 1), y = (n: number) => H - pad - ((n - lo) / span) * (H - 2 * pad);
  const d = v.map((n, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(n).toFixed(1)}`).join(" ");
  const last = v[v.length - 1]!;
  return (
    <svg class={`spark ${tone}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      {thr !== undefined && Number.isFinite(thr) && <line class="thr" x1="0" x2={W} y1={y(thr)} y2={y(thr)} />}
      <path class="area" d={`${d} L${x(v.length - 1)} ${H} L${x(0)} ${H} Z`} />
      <path class="ln" d={d} />
      <circle class="dot" cx={x(v.length - 1)} cy={y(last)} r="3" />
    </svg>
  );
}

const nf = (locale: Locale, max = 2) => new Intl.NumberFormat(INTL_TAG[locale], { maximumFractionDigits: max, notation: "compact" });

/**
 * The small live chart under the title of a featured card, by what the card is about: a match that is on shows its score (and the chance behind it), a number
 * question its recent values against the line, a train or bus the delay it has now, and anything else how the chance of "yes" has moved while this phone watched.
 */
export function MiniLive({ m, live, now, locale, msg }: { m: MarketRow; live?: LiveDelay; now: number; locale: Locale; msg: Messages }) {
  const series = String(m.params.series ?? "");
  const isTick = m.kind === "tick_gt" && !series.startsWith("alert:");
  const isDelay = (m.kind === "train_delay_gt" || m.kind === "bus_delay_gt") && !!live && !live.is_forecast;
  const kickoff = Number(m.params.kickoff ?? 0) * 1000, onAir = m.kind === "match_bet" && kickoff > 0 && now >= kickoff - 60_000 && now < kickoff + 4 * 3600_000;
  const [hist, setHist] = useState<number[] | null>(null), [score, setScore] = useState<string | null>(null);
  const [srv, setSrv] = useState<number[] | null>(null);
  const p = impliedYes(Number(m.odds_yes), Number(m.odds_no));
  const local = Number.isFinite(p) ? trend(m.id, p) : [], chance = srv && srv.length >= 2 ? srv : local;
  // numbers: recent history, refreshed every minute
  useEffect(() => {
    if (!isTick) return;
    let alive = true;
    const key = isCrypto(series) ? `px:${series}` : series;
    const go = () => sb.rpc("tick_history", { p_series: key, p_limit: 24 }).then(({ data }: { data: unknown }) => { if (alive) setHist(((data ?? []) as { value: number | string }[]).map((r) => Number(r.value)).filter(Number.isFinite)); });
    go(); const t = setInterval(go, 120_000);
    return () => { alive = false; clearInterval(t); };
  }, [m.id, isTick, series]);
  // a match that is on: the score, every 30 seconds
  useEffect(() => {
    if (!onAir) { setScore(null); return; }
    let alive = true;
    const go = () => sb.from("live_scores").select("home_score,away_score,state,clock").eq("event_id", String(m.params.eventId ?? "")).maybeSingle().then(({ data }: { data: { home_score: number; away_score: number; state: string; clock: string } | null }) => { if (alive) setScore(data ? `${data.home_score} – ${data.away_score}${data.clock ? ` · ${data.clock}` : ""}` : null); });
    go(); const t = setInterval(go, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, [m.id, onAir]);
  // the chance of "yes" as the server has followed it: this market is asked to be followed, then its snapshots are read every minute
  useEffect(() => {
    if (isTick) return;
    let alive = true;
    sb.rpc("track_markets", { p_ids: [m.id] }).then(() => {}, () => {});
    const go = () => sb.from("market_odds_history").select("p_yes").eq("market_id", m.id).order("at", { ascending: false }).limit(60).then(({ data }: { data: { p_yes: number }[] | null }) => { if (alive && data) setSrv(data.map((r) => Number(r.p_yes)).reverse()); });
    const t0 = setTimeout(go, 1500), t = setInterval(go, 120_000);
    return () => { alive = false; clearTimeout(t0); clearInterval(t); };
  }, [m.id, isTick]);
  // trains and buses: the delay each time it was read here
  const delayMin = isDelay ? Math.round(live!.delay_sec / 60) : 0;
  const delays = isDelay ? trend(`d:${m.id}`, delayMin) : [];

  let pts = chance, thr: number | undefined, tone: "up" | "down" | "flat" | "warn" = "flat", cap = "";
  const first = chance[0], lastC = chance[chance.length - 1], dp = first !== undefined && lastC !== undefined ? (lastC - first) * 100 : 0;
  const chanceCap = `${msg.top.prob} ${fmtPct(lastC ?? p, locale)}${Math.abs(dp) >= 0.5 ? ` ${dp > 0 ? "▲" : "▼"} ${Math.abs(Math.round(dp))}` : ""}`;
  const chanceTone = Math.abs(dp) < 0.5 ? "flat" : dp > 0 ? "up" : "down";
  if (isTick && hist && hist.length >= 3) {
    pts = hist; thr = Number(m.params.threshold); tone = "flat";
    cap = `${nf(locale).format(hist[hist.length - 1]!)} / ${nf(locale).format(thr)}`;
  } else if (isDelay) {
    pts = delays; thr = Number(m.params.thresholdSec ?? 180) / 60; tone = "warn";
    cap = `+${delayMin}′ / ${Math.round(thr)}′`;
  } else {
    tone = chanceTone;
    const before = m.kind === "match_bet" && kickoff > now && !score;
    cap = score ? `${score}` : before ? `${new Intl.DateTimeFormat(INTL_TAG[locale], { hour: "2-digit", minute: "2-digit" }).format(new Date(kickoff))} · ${chanceCap}` : chanceCap;
  }
  if (pts.length === 0) return null;
  return (
    <span class="mini" aria-hidden="true">
      <Spark pts={pts} thr={thr} tone={tone} />
      <small class="num">{cap}{score && !isTick && !isDelay ? ` · ${chanceCap}` : ""}</small>
    </span>
  );
}
