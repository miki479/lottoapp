import { useMemo, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { fmtOdds, type MarketRow } from "../lib/format.ts";
import type { LiveDelay, Pick } from "../lib/types.ts";

/** At most this many trains on the board, like the rows of a real one. */
const MAX_ROWS = 6, MAX_ROWS_PHONE = 4;

/** "FR 9516" / "REG 3935": the kind of train from the code in front of the number. */
function kindOf(routeName: unknown, msg: Messages): { short: string; num: string } {
  const [code = "", ...rest] = String(routeName ?? "").trim().split(/\s+/);
  const up = code.toUpperCase();
  const cls = /^(FR|FA|FB|ES|ITA|NTV|EC|EN)/.test(up) ? "hs" : /^(IC|ICN)/.test(up) ? "ic" : "rg";
  return { short: msg.board.short[cls as "hs"], num: rest.join(" ") || code };
}

/**
 * The Italian trains running now, drawn like a station departures board: black panel, amber lights, how late each one is and what each side pays.
 * Built only from what the app already knows (open questions + live delays). Tapping a row opens the bet.
 */
export function TrainBoard(p: { variant?: "full" | "card"; markets: MarketRow[]; live: Record<string, LiveDelay>; msg: Messages; locale: Locale; now: number; onPick: (m: MarketRow, pick: Pick) => void }) {
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
  const sorted = [...rows].sort((a, b) => (tab === "late" ? b.delay - a.delay : Math.max(Number(b.m.odds_yes), Number(b.m.odds_no)) - Math.max(Number(a.m.odds_yes), Number(a.m.odds_no)))).slice(0, p.variant === "card" ? 3 : typeof matchMedia === "function" && matchMedia("(max-width: 720px)").matches ? MAX_ROWS_PHONE : MAX_ROWS);
  const clock = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Rome" }).format(new Date(p.now));
  if (p.variant === "card") {
    // The small version that sits among the featured cards: same width as they are, just the trains, the time and the share of late ones.
    return (
      <>
        <section class="led ledcard" aria-label={msg.board.title}>
          <div class="ledbezel">
            <header class="ledtop"><b>{msg.board.title}</b></header>
            <span class="ledtabs" role="tablist">{(["late", "odds"] as const).map((k) => <button key={k} role="tab" aria-selected={tab === k} class={tab === k ? "on" : ""} onClick={() => setTab(k)}>{msg.board[k]}</button>)}</span>
            <ul class="ledrows">
              {sorted.map(({ m, delay }) => {
                const k = kindOf(m.params.routeName, msg), dir = (String(m.params.headsign ?? "") || String(m.params.stopName ?? "")).toUpperCase(), min = Math.round(delay / 60);
                const best = Math.max(Number(m.odds_yes), Number(m.odds_no));
                return (
                  <li key={m.id} class={`ledrow ${delay > 300 ? "late" : ""}`}>
                    <button class="ledmain" onClick={() => p.onPick(m, "yes")} aria-label={`${k.short} ${k.num} ${dir} ${min} min`}>
                      <span class="ledkind">{k.short}</span><span class="lednum">{k.num}</span><span class="leddest">{dir}</span>
                      <span class="leddelay">{tab === "late" ? (min > 0 ? `${min}’` : "—") : `×${fmtOdds(best, p.locale)}`}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <footer class="ledfoot slim"><span class="ledclock num" aria-label={clock}>{clock}</span><span class="ledstat">{Math.round((late5 / rows.length) * 100)}% {msg.board.over5}</span></footer>
          </div>
        </section>
        <span class="topdiv" aria-hidden="true" />
      </>
    );
  }
  return (
    <section class="led full" aria-label={msg.board.title}>
      <div class="ledbezel">
        <header class="ledtop">
          <b>{msg.board.title}</b>
          <span class="ledtabs" role="tablist">{(["late", "odds"] as const).map((k) => <button key={k} role="tab" aria-selected={tab === k} class={tab === k ? "on" : ""} onClick={() => setTab(k)}>{msg.board[k]}</button>)}</span>
        </header>
        <div class="ledcols" aria-hidden="true"><span>{msg.board.heads.train}</span><span>{msg.board.heads.to}</span><span>{msg.board.heads.delay}</span></div>
        <ul class="ledrows">
          {sorted.map(({ m, delay, trend }) => {
            const k = kindOf(m.params.routeName, msg);
            const dir = (String(m.params.headsign ?? "") || String(m.params.stopName ?? "")).toUpperCase();
            const min = Math.round(delay / 60);
            return (
              <li key={m.id} class={`ledrow ${delay > 300 ? "late" : ""}`}>
                <button class="ledmain" onClick={() => p.onPick(m, "yes")} aria-label={`${k.short} ${k.num} ${dir} ${min} min`}>
                  <span class="ledkind">{k.short}</span><span class="lednum">{k.num}</span>
                  <span class="leddest">{dir}</span>
                  <span class="leddelay">{min > 0 ? `${min}’` : "—"}{trend > 60 && <i class="leddot" title={msg.board.worse} />}</span>
                </button>
                <span class="ledq">
                  <button onClick={() => p.onPick(m, "yes")}><small>{msg.card.late}</small> ×{fmtOdds(Number(m.odds_yes), p.locale)}</button>
                  <button onClick={() => p.onPick(m, "no")}><small>{msg.card.onTime}</small> ×{fmtOdds(Number(m.odds_no), p.locale)}</button>
                </span>
              </li>
            );
          })}
        </ul>
        <footer class="ledfoot">
          <span class="ledclock num" aria-label={clock}>{clock}</span>
          <span class="ledstat">{Math.round((late5 / rows.length) * 100)}% {msg.board.over5} · {avg}’ {msg.board.avg}</span>
          <span class="ledmarq" aria-hidden="true"><span>{msg.board.marquee} · {msg.board.marquee}</span></span>
        </footer>
      </div>
    </section>
  );
}
