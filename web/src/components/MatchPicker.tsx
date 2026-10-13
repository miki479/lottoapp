import { useEffect, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { INTL_TAG } from "../i18n/index.ts";
import type { MatchBetKey } from "../i18n/types.ts";
import { useBusy } from "../lib/busy.ts";
import { sb } from "../lib/api.ts";
import { fmtOdds, type MarketRow } from "../lib/format.ts";

const BETS: MatchBetKey[] = ["home_win", "draw", "away_win", "over_1_5", "over_2_5", "over_3_5", "btts", "home_clean", "away_clean"];
interface Fx { eventId: string; league: string; home: string; away: string; kickoff: number; km: number | null; have: Set<string>; priors: Record<string, number>; testOnly: boolean }

const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const r = (x: number) => (x * Math.PI) / 180, h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Pick an upcoming match and a "reason" (winner, goals, clean sheet…). A reason that already exists is opened, never made twice. */
export function MatchPicker(p: { msg: Messages; locale: Locale; origin: { lat: number; lon: number } | null; onCreated: (m: MarketRow) => void; registered: boolean }) {
  const t = p.msg.matchmaker, mk = p.msg.maker;
  const [fx, setFx] = useState<Fx[] | null>(null), [sel, setSel] = useState<string | null>(null), [bet, setBet] = useState<MatchBetKey>("home_win");
  const [q, setQ] = useState("");
  const [busy, run] = useBusy(), [err, setErr] = useState<string | null>(null), [odds, setOdds] = useState<{ y: number; n: number } | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const { data } = await sb.from("markets").select("params,lat,lon").eq("kind", "match_bet").eq("status", "open").gt("closes_at", new Date().toISOString()).order("closes_at").limit(400);
      const by = new Map<string, Fx>();
      for (const r of (data ?? []) as { params: Record<string, unknown>; lat: number | null; lon: number | null }[]) {
        const id = String(r.params.eventId);
        const f = by.get(id) ?? { eventId: id, league: String(r.params.league), home: String(r.params.home), away: String(r.params.away), kickoff: Number(r.params.kickoff), km: p.origin && r.lat !== null ? km(p.origin, { lat: Number(r.lat), lon: Number(r.lon) }) : null, have: new Set<string>(), priors: (r.params.priors ?? {}) as Record<string, number>, testOnly: !!r.params.testOnly };
        f.have.add(String(r.params.bet)); by.set(id, f);
      }
      const list = [...by.values()].sort((a, b) => (a.km ?? 1e6) - (b.km ?? 1e6) || a.kickoff - b.kickoff).slice(0, 60);
      if (!live) return;
      setFx(list); if (list[0]) setSel(list[0].eventId);
    })().catch(() => { if (live) setFx([]); });
    return () => { live = false; };
  }, []);
  const cur = fx?.find((f) => f.eventId === sel) ?? null;
  const exists = !!cur?.have.has(bet);
  useEffect(() => {
    setOdds(null); setErr(null);
    if (!cur) return;
    let live = true;
    sb.functions.invoke("market-offer", { body: { type: "match", eventId: cur.eventId, bet, preview: true } }).then(({ data }) => { if (live && data?.preview) setOdds({ y: data.preview.odds_yes, n: data.preview.odds_no }); else if (live) setErr(p.msg.maker.errors.too_certain); });
    return () => { live = false; };
  }, [sel, bet]);
  const when = (e: number) => new Intl.DateTimeFormat(INTL_TAG[p.locale], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(e * 1000));
  const go = () => run(async () => {
    if (!cur) return;
    if (!p.registered) { setErr(mk.needAccount); return; }
    setErr(null);
    const { data, error } = await sb.functions.invoke("market-offer", { body: { type: "match", eventId: cur.eventId, bet } });
    if (data?.market) { p.onCreated(data.market as MarketRow); return; }
    let code = "generic";
    try { code = (await (error as { context?: Response })?.context?.json())?.error ?? "generic"; } catch { /* none */ }
    setErr(mk.errors[code as "generic"] ?? mk.errors.generic);
  }, () => setErr(mk.errors.generic));
  return (
    <>
      <label class="searchbox"><input class="field" type="search" value={q} placeholder={p.msg.teamSearch} onInput={(e) => setQ((e.target as HTMLInputElement).value)} /></label>
      <span class="detail">{t.pick}</span>
      {fx === null && <div class="sk s" />}
      {fx && fx.length === 0 && <p class="hint">{t.none}</p>}
      <div class="mkchips" style="flex-direction:column;align-items:stretch">
        {fx?.filter((f) => !q.trim() || `${f.home} ${f.away} ${f.league}`.toLowerCase().includes(q.trim().toLowerCase())).map((f) => <button key={f.eventId} class={`mkchip ${sel === f.eventId ? "on" : ""}`} style="text-align:left" aria-pressed={sel === f.eventId} onClick={() => setSel(f.eventId)}><b>{f.home} – {f.away}</b><br /><small>{f.league} · {when(f.kickoff)}{f.km !== null ? ` · ${Math.round(f.km)} km` : ""}</small></button>)}
      </div>
      {cur && <>
        <span class="detail">{t.reason}</span>
        <div class="mkchips">{BETS.map((b) => <button key={b} class={`mkchip ${bet === b ? "on" : ""}`} aria-pressed={bet === b} onClick={() => setBet(b)}>{t.bets[b]}{cur.have.has(b) ? " ✓" : ""}</button>)}</div>
        {odds && <p class="hint num">{mk.odds}: {fmtOdds(odds.y, p.locale)} / {fmtOdds(odds.n, p.locale)}</p>}
        {exists && <p class="hint">{t.exists}</p>}
      </>}
      {err && <p class="formerr" role="alert">{err}</p>}
      <button class="btn primary wide" disabled={busy || !cur || (!odds && !exists)} aria-busy={busy} onClick={go}>{busy ? mk.creating : exists ? t.open : mk.create}</button>
    </>
  );
}
