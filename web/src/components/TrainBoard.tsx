import { ArrowDownRight, ArrowUpRight, Minus, TrainFront } from "lucide-preact";
import { useMemo, useState } from "preact/hooks";
import { Collapse } from "./Collapse.tsx";
import type { Locale, Messages } from "../i18n/index.ts";
import { fmtOdds, type MarketRow } from "../lib/format.ts";
import type { LiveDelay, Pick } from "../lib/types.ts";

/** "FR 9516" / "REG 3935": the kind of train from the code in front of the number. */
function kindOf(routeName: unknown, msg: Messages): { label: string; cls: string; num: string } {
  const [code = "", ...rest] = String(routeName ?? "").trim().split(/\s+/);
  const num = rest.join(" ") || code;
  const up = code.toUpperCase();
  const cls = /^(FR|FA|FB|ES|ITA|NTV|EC|EN)/.test(up) ? "hs" : /^(IC|ICN)/.test(up) ? "ic" : "rg";
  return { label: msg.board.kinds[cls as "hs"], cls, num };
}

/**
 * A departures-board style table of the Italian trains running now: how late they are, whether it is getting worse, and what each side pays.
 * Built only from what the app already knows (open questions + live delays). Tapping a row opens the bet.
 */
export function TrainBoard(p: { markets: MarketRow[]; live: Record<string, LiveDelay>; msg: Messages; locale: Locale; now: number; open?: boolean; onPick: (m: MarketRow, pick: Pick) => void }) {
  const { msg } = p;
  const [tab, setTab] = useState<"late" | "odds">("late");
  const rows = useMemo(() => {
    const seen = new Set<string>();
    const out: { m: MarketRow; delay: number; trend: number }[] = [];
    for (const m of p.markets) {
      if (m.category !== "train" || m.kind !== "train_delay_gt" || m.params.ladderOf || m.city_id !== "italia" || Date.parse(m.closes_at) <= p.now) continue;
      const l = p.live[m.id];
      if (!l || l.is_forecast) continue;
      const key = String(m.params.tripId ?? m.id);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ m, delay: l.delay_sec, trend: l.prev_delay_sec === null ? 0 : l.delay_sec - l.prev_delay_sec });
    }
    return out;
  }, [p.markets, p.live, Math.floor(p.now / 20_000)]);
  if (rows.length < 3) return null;
  const late5 = rows.filter((r) => r.delay > 300).length;
  const avg = Math.max(0, Math.round(rows.reduce((a, r) => a + Math.max(0, r.delay), 0) / rows.length / 60));
  const sorted = [...rows].sort((a, b) => (tab === "late" ? b.delay - a.delay : Math.max(Number(b.m.odds_yes), Number(b.m.odds_no)) - Math.max(Number(a.m.odds_yes), Number(a.m.odds_no)))).slice(0, 8);
  const mins = (s: number) => (s < 0 ? `${Math.round(s / 60)}` : `+${Math.round(s / 60)}`);
  return (
    <section class="tboard card" aria-label={msg.board.title}>
      <Collapse id="tboard" title={msg.board.title} count={rows.length} open={p.open}>
      <p class="tbsub"><TrainFront size={14} /> {msg.board.following(rows.length)}</p>
      <div class="tbmeter" role="group" aria-label={msg.board.meter}>
        <span><b class="num">{Math.round((late5 / rows.length) * 100)}%</b>{msg.board.over5}</span>
        <span><b class="num">{avg} min</b>{msg.board.avg}</span>
      </div>
      <div class="mkchips" role="tablist">{(["late", "odds"] as const).map((k) => <button key={k} role="tab" aria-selected={tab === k} class={`mkchip ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{msg.board[k]}</button>)}</div>
      <ul class="tbrows">
        {sorted.map(({ m, delay, trend }) => {
          const k = kindOf(m.params.routeName, msg);
          const dir = String(m.params.headsign ?? "") || String(m.params.stopName ?? "");
          const T = trend > 60 ? ArrowUpRight : trend < -60 ? ArrowDownRight : Minus;
          return (
            <li key={m.id} class="tbrow">
              <button class="tbmain" onClick={() => p.onPick(m, "yes")} aria-label={`${k.label} ${k.num} ${dir}`}>
                <span class={`tbkind ${k.cls}`}>{k.label}</span><b class="tbnum">{k.num}</b>
                <span class="tbdir">{dir}</span>
              </button>
              <span class={`tbdelay num ${delay > 300 ? "late" : delay < 60 ? "ok" : ""}`} title={trend > 60 ? msg.board.worse : trend < -60 ? msg.board.better : msg.board.steady}>{mins(delay)}′<T size={14} aria-hidden="true" /></span>
              <span class="tbodds">
                <button class="tbq late" onClick={() => p.onPick(m, "yes")}><small>{msg.card.late}</small><b class="num">{fmtOdds(Number(m.odds_yes), p.locale)}</b></button>
                <button class="tbq ok" onClick={() => p.onPick(m, "no")}><small>{msg.card.onTime}</small><b class="num">{fmtOdds(Number(m.odds_no), p.locale)}</b></button>
              </span>
            </li>
          );
        })}
      </ul>
      </Collapse>
    </section>
  );
}
