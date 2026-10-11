import { ArrowLeft, RefreshCw } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import type { Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";

interface Overview {
  feeds: { id: string; last_ok_at: string | null; last_attempt_at: string | null; last_error: string | null; last_error_at: string | null }[];
  markets: { open: number; resolved_24h: number; void_24h: number; void_reasons: Record<string, number> };
  users: { registered: number; guests: number; bets_24h: number };
  places: { active: number; limit: number };
  moderation?: { blocked_24h: number; recent: { text: string; matched: string; source: string; at: string }[] };
  reports: { id: string; kind: string; note: string; created_at: string; market_id: string | null; market_kind: string | null; city_id: string | null; status: string | null; outcome: string | null; void_reason: string | null; evidence: Record<string, unknown> | null }[];
}

/** Feed freshness, in plain words. A feed with an error newer than its last success is "down". */
function feedState(f: Overview["feeds"][number], now: number): "ok" | "late" | "down" | "never" {
  if (!f.last_ok_at) return "never";
  const ok = Date.parse(f.last_ok_at), err = f.last_error_at ? Date.parse(f.last_error_at) : 0;
  const age = (now - ok) / 1000;
  if (err > ok && age > 900) return "down";
  // Hourly feeds (weather, USGS) are not late after a few minutes.
  const hourly = f.id.startsWith("open-meteo") || f.id === "usgs" || f.id === "mit-scioperi";
  return age > (hourly ? 7200 : 300) ? "late" : "ok";
}
const ago = (iso: string | null, now: number) => { if (!iso) return "—"; const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000)); return s < 90 ? `${s}s` : s < 5400 ? `${Math.round(s / 60)}m` : s < 172800 ? `${Math.round(s / 3600)}h` : `${Math.round(s / 86400)}d`; };

/** Owner-only page (a screen of its own, not a popup):  feed health, market outcomes, usage and open reports. The server refuses anyone else. */
export function AdminPage({ msg, onBack }: { msg: Messages; onBack: () => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState(false);
  const load = async () => { const { data: d, error } = await sb.rpc("admin_overview"); if (error) setErr(true); else { setErr(false); setData(d as Overview); } };
  useEffect(() => { load(); }, []);
  const resolve = async (id: string) => { await sb.rpc("admin_resolve_report", { p_id: id }); load(); };
  const now = Date.now(), a = msg.admin;
  return (
    <div class="screen stack adminpage">
      <div class="adminbar"><button class="iconbtn" onClick={onBack} aria-label={msg.common.back}><ArrowLeft size={22} /></button><h1>{a.title}</h1><button class="iconbtn" onClick={load} aria-label={a.refresh}><RefreshCw size={20} /></button></div>
      {err && <p class="formerr" role="alert">{a.forbidden}</p>}
      {data && (<>
        <div class="admingrid">
          <div><span class="detail">{a.opened}</span><b class="num">{data.markets.open}</b></div>
          <div><span class="detail">{a.resolved24}</span><b class="num">{data.markets.resolved_24h}</b></div>
          <div><span class="detail">{a.void24}</span><b class="num">{data.markets.void_24h}</b></div>
          <div><span class="detail">{a.registered}</span><b class="num">{data.users.registered}</b></div>
          <div><span class="detail">{a.guests}</span><b class="num">{data.users.guests}</b></div>
          <div><span class="detail">{a.bets24}</span><b class="num">{data.users.bets_24h}</b></div>
          <div><span class="detail">{a.places}</span><b class="num">{data.places.active}/{data.places.limit}</b></div>
        </div>
        {Object.keys(data.markets.void_reasons).length > 0 && <p class="hint">{Object.entries(data.markets.void_reasons).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>}
        <h3>{a.feeds}</h3>
        <div>{data.feeds.map((f) => { const s = feedState(f, now); return (
          <div class="adminrow" key={f.id}>
            <span class="grow"><b>{f.id}</b>{f.last_error && s !== "ok" ? <small class="hint" style="display:block">{f.last_error.slice(0, 120)}</small> : null}</span>
            <span class="hint">{ago(f.last_ok_at, now)}</span>
            <span class={`pill-${s === "ok" ? "ok" : s === "late" ? "late" : "down"}`}>{a[s]}</span>
          </div>); })}</div>
        <h3>{a.moderation} ({data.moderation?.blocked_24h ?? 0} / 24h)</h3>
        {!data.moderation || data.moderation.recent.length === 0 ? <p class="hint">{a.noModeration}</p> : data.moderation.recent.map((x, i) => (
          <div class="adminrow" key={i}><span class="grow"><b>«{x.text}»</b><small class="hint" style="display:block">{x.matched} · {x.source} · {ago(x.at, now)}</small></span></div>
        ))}
        <h3>{a.reports} ({data.reports.length})</h3>
        {data.reports.length === 0 ? <p class="hint">{a.noReports}</p> : data.reports.map((r) => (
          <div class="adminrow" key={r.id} style="align-items:flex-start">
            <span class="grow"><b>{msg.report.kinds[r.kind as "other"] ?? r.kind}</b> · {r.market_kind ?? "?"} · {r.city_id ?? ""}
              <small class="hint" style="display:block">{r.status ?? "?"}{r.outcome ? ` → ${r.outcome}` : ""}{r.void_reason ? ` (${r.void_reason})` : ""} · {ago(r.created_at, now)}</small>
              {r.evidence ? <small class="hint" style="display:block">{JSON.stringify(r.evidence).slice(0, 140)}</small> : null}
              {r.note ? <small style="display:block">{r.note}</small> : null}</span>
            <button class="btn secondary" onClick={() => resolve(r.id)}>{a.resolve}</button>
          </div>))}
      </>)}
    </div>
  );
}
