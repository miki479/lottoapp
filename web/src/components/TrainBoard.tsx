import { useMemo, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { fmtOdds, type MarketRow } from "../lib/format.ts";
import type { LiveDelay, Pick } from "../lib/types.ts";
import { fmtMult, fmtPct } from "../lib/num.ts";

const CLOCK = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Rome" });
/** At most this many trains on the board, like the rows of a real one. */
const MAX_ROWS = 6, MAX_ROWS_PHONE = 4;

/** The long station names of the board in their usual short forms (TORINO PORTA NUOVA → TORINO P. NUOVA), never cut in the middle of a word. */
const SHORT: [RegExp, string][] = [[/\bSTAZIONE\b/g, "STAZ."], [/\bCENTRALE\b/g, "C.LE"], [/\bPORTA\b/g, "P."], [/\bSANT'?\s/g, "S. "], [/\bSANTA\b/g, "S."], [/\bSAN\b/g, "S."]];
const shortStation = (s: string) => SHORT.reduce((t, [re, to]) => t.replace(re, to), s);

/** "FR 9516" / "REG 3935": the kind of train from the code in front of the number. */
function kindOf(routeName: unknown, msg: Messages): { short: string; num: string; cls: "hs" | "ic" | "rg" } {
  const [code = "", ...rest] = String(routeName ?? "").trim().split(/\s+/);
  const up = code.toUpperCase();
  const cls = /^(FR|FA|FB|ES|ITA|NTV|EC|EN)/.test(up) ? "hs" : /^(IC|ICN)/.test(up) ? "ic" : "rg";
  return { short: msg.board.short[cls as "hs"], num: rest.join(" ") || code, cls: cls as "hs" | "ic" | "rg" };
}

/**
 * The Italian trains running now, drawn like a station departures board: black panel, amber lights, how late each one is and what each side pays.
 * Built only from what the app already knows (open questions + live delays). Tapping a row opens the bet.
 */
export function TrainBoard(p: { variant?: "full" | "card"; markets: MarketRow[]; live: Record<string, LiveDelay>; msg: Messages; locale: Locale; now: number; onPick: (m: MarketRow, pick: Pick) => void }) {
  const { msg } = p;
  const [tab, setTab] = useState<"late" | "odds">("late");
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const seen = new Set<string>();
    const out: { m: MarketRow; delay: number; trend: number }[] = [], spare: { m: MarketRow; delay: number; trend: number }[] = [];
    for (const m of p.markets) {
      if (m.category !== "train" || m.kind !== "train_delay_gt" || m.params.ladderOf || m.city_id !== "italia" || Date.parse(m.closes_at) <= p.now) continue;
      const l = p.live[m.id];
      const key = String(m.params.tripId ?? m.id);
      if (seen.has(key)) continue;
      if (l && !l.is_forecast) { seen.add(key); out.push({ m, delay: l.delay_sec, trend: l.prev_delay_sec === null ? 0 : l.delay_sec - l.prev_delay_sec }); }
      else if (p.variant !== "card") spare.push({ m, delay: 0, trend: 0 });
    }
    // The full board is always there: if too few trains have a reading yet it is filled with the next departures.
    for (const r of spare.sort((a, b) => Date.parse(a.m.target_at) - Date.parse(b.m.target_at))) {
      if (out.length >= 8) break;
      const key = String(r.m.params.tripId ?? r.m.id);
      if (seen.has(key)) continue;
      seen.add(key); out.push(r);
    }
    return out;
  }, [p.markets, p.live, Math.floor(p.now / 20_000)]);
  if (p.variant === "card" ? rows.length < 3 : rows.length === 0) return p.variant === "card" ? null : <section class="led full" aria-label={msg.board.title}><div class="ledbezel"><header class="ledtop"><b>{msg.board.title}</b></header><p class="hint" style="padding:14px">{msg.board.marquee}</p></div></section>;
  const late5 = rows.filter((r) => r.delay > 300).length;
  const avg = Math.max(0, Math.round(rows.reduce((a, r) => a + Math.max(0, r.delay), 0) / rows.length / 60));
  const needle = q.trim().toLowerCase();
  const matches = needle ? rows.filter((r) => `${r.m.params.routeName ?? ""} ${r.m.params.headsign ?? ""} ${r.m.params.stopName ?? ""}`.toLowerCase().includes(needle)) : rows;
  const sorted = [...matches].sort((a, b) => (tab === "late" ? b.delay - a.delay : Math.max(Number(b.m.odds_yes), Number(b.m.odds_no)) - Math.max(Number(a.m.odds_yes), Number(a.m.odds_no)))).slice(0, p.variant === "card" ? 3 : needle ? 30 : 12);
  const clock = CLOCK.format(new Date(p.now));
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
                const k = kindOf(m.params.routeName, msg), dir = shortStation((String(m.params.headsign ?? "") || String(m.params.stopName ?? "")).toUpperCase()), min = Math.round(delay / 60);
                const best = Math.max(Number(m.odds_yes), Number(m.odds_no));
                return (
                  <li key={m.id} class={`ledrow ${delay > 300 ? "late" : ""}`}>
                    <button class="ledmain" onClick={() => p.onPick(m, "yes")} aria-label={`${k.short} ${k.num} ${dir} ${min} min`}>
                      <span class={`ledkind k-${k.cls}`}>{k.short}</span><span class="lednum">{k.num}</span><span class="leddest">{dir}</span>
                      <span class="leddelay">{tab === "late" ? (min > 0 ? `${min}’` : "—") : fmtMult(best, p.locale)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <footer class="ledfoot slim"><span class="ledclock num" aria-label={clock}>{clock}</span><span class="ledstat">{fmtPct(late5 / rows.length, p.locale)} {msg.board.over5}</span></footer>
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
        <input class="ledsearch" type="search" value={q} placeholder="🔍 ·" aria-label={msg.board.heads.train} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <div class="ledcols" aria-hidden="true"><span>{msg.board.heads.train}</span><span>{msg.board.heads.to}</span><span>{msg.board.heads.delay}</span><span /></div>
        <ul class="ledrows">
          {sorted.map(({ m, delay, trend }) => {
            const k = kindOf(m.params.routeName, msg);
            const dir = (String(m.params.headsign ?? "") || String(m.params.stopName ?? "")).toUpperCase();
            const min = Math.round(delay / 60);
            return (
              <li key={m.id} class={`ledrow ${delay > 300 ? "late" : ""}`}>
                <button class="ledmain" onClick={() => p.onPick(m, "yes")} aria-label={`${k.short} ${k.num} ${dir} ${min} min`}>
                  <span class={`ledkind k-${k.cls}`}>{k.short}</span><span class="lednum">{k.num}</span>
                  <span class="leddest">{dir}</span>
                  <span class="leddelay">{min > 0 ? `${min}’` : "—"}</span>
                  <span class={`ledtrend ${trend > 60 ? "worse" : trend < -60 ? "better" : "steady"}`} title={trend > 60 ? msg.board.worse : trend < -60 ? msg.board.better : msg.board.steady}>{trend > 60 ? "▲" : trend < -60 ? "▼" : "•"} {Math.abs(Math.round(trend / 60)) > 0 ? `${trend > 0 ? "+" : "−"}${Math.abs(Math.round(trend / 60))}’` : ""}</span>
                </button>
                <span class="ledq">
                  <button onClick={() => p.onPick(m, "yes")}><small>{msg.card.late}</small> {fmtMult(Number(m.odds_yes), p.locale)}</button>
                  <button onClick={() => p.onPick(m, "no")}><small>{msg.card.onTime}</small> {fmtMult(Number(m.odds_no), p.locale)}</button>
                </span>
              </li>
            );
          })}
        </ul>
        <footer class="ledfoot">
          <span class="ledclock num" aria-label={clock}>{clock}</span>
          <span class="ledstat">{fmtPct(late5 / rows.length, p.locale)} {msg.board.over5} · {avg}’ {msg.board.avg}</span>
          <span class="ledmarq" aria-hidden="true"><span>{msg.board.marquee} · {msg.board.marquee}</span></span>
        </footer>
      </div>
    </section>
  );
}
