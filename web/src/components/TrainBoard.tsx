import { RefreshCw } from "lucide-preact";
import { useMemo, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import type { MarketRow } from "../lib/format.ts";
import type { LiveDelay, Pick } from "../lib/types.ts";
import { bestOdds, bestSide, boardRows, boardStats, LATE_SEC, sortBoard, type BoardRow, type BoardTab } from "../lib/board.ts";
import { fmtMin, fmtMult, fmtPct, fmtSigned } from "../lib/num.ts";

const CLOCK = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Rome" });
/** How many trains each version shows: the strip at the top of the home like the rows of a real board, the full one for searching. */
const STRIP_ROWS = 4, FULL_ROWS = 12, SEARCH_ROWS = 30;

/** The long station names of the board in their usual short forms (TORINO PORTA NUOVA → TORINO P. NUOVA). */
const SHORT: [RegExp, string][] = [[/\bSTAZIONE\b/g, "STAZ."], [/\bCENTRALE\b/g, "C.LE"], [/\bPORTA\b/g, "P."], [/\bSANT'?\s/g, "S. "], [/\bSANTA\b/g, "S."], [/\bSAN\b/g, "S."]];
const shortStation = (s: string) => SHORT.reduce((t, [re, to]) => t.replace(re, to), s);

/** "FR 9516" / "REG 3935": the kind of train from the code in front of the number. */
function kindOf(routeName: unknown, msg: Messages): { short: string; num: string; cls: "hs" | "ic" | "rg" } {
  const [code = "", ...rest] = String(routeName ?? "").trim().split(/\s+/);
  const up = code.toUpperCase();
  const cls = /^(FR|FA|FB|ES|ITA|NTV|EC|EN)/.test(up) ? "hs" : /^(IC|ICN)/.test(up) ? "ic" : "rg";
  return { short: msg.board.short[cls as "hs"], num: rest.join(" ") || code, cls: cls as "hs" | "ic" | "rg" };
}

function Line(p: { r: BoardRow; tab: BoardTab; full: boolean; msg: Messages; locale: Locale; onPick: (m: MarketRow, pick: Pick) => void }) {
  const { r, tab, full, msg, locale } = p, { m } = r;
  const k = kindOf(m.params.routeName, msg), dir = shortStation((String(m.params.headsign ?? "") || String(m.params.stopName ?? "")).toUpperCase());
  const min = Math.round(r.delay / 60), late = r.delay > LATE_SEC;
  const side = tab === "odds" ? bestSide(m) : "yes";
  const figure = tab === "odds" ? fmtMult(bestOdds(m), locale) : r.live && min > 0 ? `${fmtSigned(min, locale)}′` : "—";
  const t = Math.round(r.trend / 60);
  return (
    <li class={`ledrow ${late ? "late" : ""}`}>
      <button class="ledmain" onClick={() => p.onPick(m, side)} aria-label={`${k.short} ${k.num}, ${dir}${r.live ? `, ${fmtMin(min, locale, true)}` : ""}`}>
        <span class={`ledkind k-${k.cls}`}>{k.short}</span>
        <span class="lednum num">{k.num}</span>
        <span class="leddest">{dir}</span>
        <span class="leddelay num">{figure}</span>
        {full && <span class={`ledtrend num ${t > 1 ? "worse" : t < -1 ? "better" : "steady"}`} title={t > 1 ? msg.board.worse : t < -1 ? msg.board.better : msg.board.steady}>{r.live && Math.abs(t) > 1 ? `${t > 0 ? "▲" : "▼"} ${fmtSigned(t, locale)}′` : ""}</span>}
      </button>
    </li>
  );
}

/**
 * The Italian trains running now, drawn like a station departures board: black panel, amber lights, how late each one is. Built only from what the app
 * already knows (open questions + live delays). Tapping a row opens the bet. "strip" is the short version at the top of the home, "full" the one in the
 * trains category, with a search box and the change since the last reading.
 */
export function TrainBoard(p: { variant?: "full" | "strip"; markets: MarketRow[]; live: Record<string, LiveDelay>; msg: Messages; locale: Locale; now: number; onRefresh?: () => void; onPick: (m: MarketRow, pick: Pick) => void }) {
  const { msg, locale } = p, full = p.variant === "full";
  const [tab, setTab] = useState<BoardTab>("late");
  const [q, setQ] = useState(""), [spin, setSpin] = useState(false);
  const refresh = () => { setSpin(true); p.onRefresh?.(); setTimeout(() => setSpin(false), 900); };
  const rows = useMemo(() => boardRows(p.markets, p.live, p.now, full ? 8 : STRIP_ROWS), [p.markets, p.live, full, Math.floor(p.now / 20_000)]);
  if (rows.length === 0) return full ? <section class="led full" aria-label={msg.board.title}><div class="ledbezel"><header class="ledtop"><b>{msg.board.title}</b></header><p class="ledfine">{msg.board.marquee}</p></div></section> : null;
  const stats = boardStats(rows), needle = q.trim().toLowerCase();
  const matches = needle ? rows.filter((r) => `${r.m.params.routeName ?? ""} ${r.m.params.headsign ?? ""} ${r.m.params.stopName ?? ""}`.toLowerCase().includes(needle)) : rows;
  const sorted = sortBoard(matches, tab).slice(0, full ? (needle ? SEARCH_ROWS : FULL_ROWS) : STRIP_ROWS);
  const tabs = <span class="ledtabs" role="tablist">{(["late", "odds"] as const).map((k) => <button key={k} role="tab" aria-selected={tab === k} class={tab === k ? "on" : ""} onClick={() => setTab(k)}>{msg.board[k]}</button>)}</span>;
  return (
    <section class={`led ${full ? "full" : "strip"}`} aria-label={msg.board.title}>
      <div class="ledbezel">
        <header class="ledtop"><b><i class="ledlamp" aria-hidden="true" />{msg.board.title}</b>{tabs}{p.onRefresh && <button type="button" class={`ledrefresh ${spin ? "spin" : ""}`} onClick={refresh} aria-label={msg.board.refresh} title={msg.board.refresh}><RefreshCw size={16} aria-hidden="true" /></button>}</header>
        {full && <input class="ledsearch" type="search" value={q} placeholder={msg.board.search} aria-label={msg.board.search} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />}
        {full && <div class="ledcols" aria-hidden="true"><span>{msg.board.heads.train}</span><span>{msg.board.heads.to}</span><span>{tab === "odds" ? msg.board.heads.odds : msg.board.heads.delay}</span><span /></div>}
        <ul class="ledrows">{sorted.map((r) => <Line key={r.m.id} r={r} tab={tab} full={full} msg={msg} locale={locale} onPick={p.onPick} />)}</ul>
        <footer class="ledfoot">
          {stats.lateShare !== null && <span class="ledstat num">{fmtPct(stats.lateShare, locale)} {msg.board.over5}{full && stats.avgMin !== null ? ` · ${stats.avgMin}′ ${msg.board.avg}` : ""}</span>}
          {stats.updatedAt !== null && <span class="ledupd num">{msg.board.updated(CLOCK.format(new Date(stats.updatedAt)))}</span>}
        </footer>
        {full && <p class="ledfine">{msg.board.marquee}</p>}
      </div>
    </section>
  );
}
