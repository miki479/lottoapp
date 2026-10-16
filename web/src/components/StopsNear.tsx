import { Bus, LocateFixed, Search } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { roundCoord } from "../../../shared/geo.ts";
import type { Locale, Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { every } from "../lib/poll.ts";
import type { MarketRow } from "../lib/format.ts";
import type { Pick } from "../lib/types.ts";
import type { Arrival } from "../lib/useIntent.ts";

const timeOf = (epoch: number, locale: Locale) => new Date(epoch * 1000).toLocaleTimeString(locale === "ja" ? "ja-JP" : locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** The buses and trains due at the stops within 250 m of where the player is right now (the position stays on the phone; the profile town is not used). A stop can also be searched by name. */
export function StopsNear(p: { msg: Messages; locale: Locale; fallback: { lat: number; lon: number } | null; onPick: (m: MarketRow, pick: Pick) => void }) {
  const t = p.msg.fy, n = p.msg.nearby;
  const [pos, setPos] = useState<{ lat: number; lon: number } | null>(null), [q, setQ] = useState(""), [query, setQuery] = useState(""), [locating, setLocating] = useState(false);
  // "near me" is the real position; the profile town only centres a search by name when the position is not known
  const at = pos ?? (query ? p.fallback : null);
  const [list, setList] = useState<Arrival[] | null>(null), [busy, setBusy] = useState<string | null>(null), [err, setErr] = useState(false), going = useRef(false);
  useEffect(() => {
    if (!at) { setList(null); return; }
    let live = true;
    const go = async () => {
      const { data, error } = await sb.functions.invoke("nearby", { body: { lat: roundCoord(at.lat), lon: roundCoord(at.lon), radiusM: 250, ...(query ? { q: query } : {}) } });
      if (!live) return;
      if (error) { setList((l) => l ?? []); return; }
      setList(((data as { arrivals?: Arrival[] } | null)?.arrivals ?? []).filter((a) => a.marketId || a.offerable).slice(0, 6));
    };
    go().catch(() => { if (live) setList((l) => l ?? []); });
    const stop = every(() => { go().catch(() => {}); }, 60_000);
    return () => { live = false; stop(); };
  }, [at?.lat, at?.lon, query]);
  // when the phone already allowed the position, take it without asking again
  useEffect(() => { try { (navigator as Navigator & { permissions?: Permissions }).permissions?.query({ name: "geolocation" as PermissionName }).then((s) => { if (s.state === "granted") locate(); }, () => {}); } catch { /* no permissions API */ } }, []);
  const locate = () => { if (!navigator.geolocation) return; setLocating(true); navigator.geolocation.getCurrentPosition((g) => { setQuery(""); setQ(""); setList(null); setPos({ lat: g.coords.latitude, lon: g.coords.longitude }); setLocating(false); }, () => setLocating(false), { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }); };
  const search = (e: Event) => { e.preventDefault(); const v = q.trim(); if (v.length >= 3 || v === "") { setList(null); setQuery(v); } };
  const open = async (a: Arrival) => {
    if (going.current) return;
    going.current = true; setBusy(a.tripId); setErr(false);
    try {
      let row: MarketRow | null = null;
      if (a.marketId) row = ((await sb.from("markets").select("*").eq("id", a.marketId).maybeSingle()).data as MarketRow | null);
      else if (a.offerable) row = ((await sb.functions.invoke("stop-offer", { body: { feedId: a.feedId, tripId: a.tripId, stopId: a.stopId } })).data as { market?: MarketRow } | null)?.market ?? null;
      if (row) p.onPick(row, "yes"); else setErr(true);
    } catch { setErr(true); } finally { going.current = false; setBusy(null); }
  };
  if (list === null && at) return <div class="sk s" />;
  return (
    <div class="stack stopsnear">
      <span class="detail"><Bus size={14} style="vertical-align:-2px" /> {n.passing}</span>
      <form class="stopsearch" onSubmit={search}>
        <input type="search" value={q} placeholder={n.searchStop} aria-label={n.searchStop} maxLength={40} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <button class="iconbtn" type="submit" aria-label={n.searchStop}><Search size={18} /></button>
        <button class="iconbtn" type="button" onClick={locate} disabled={locating} aria-label={n.useMyPos} title={n.useMyPos}><LocateFixed size={18} /></button>
      </form>
      {!at && <p class="hint">{n.askPos}</p>}
      {at && (list ?? []).length === 0 && <p class="hint">{n.passingNone}</p>}
      {(list ?? []).map((a) => (
        <div class="fyrow" key={a.tripId + a.stopId}>
          <div class="grow"><b>{a.routeName || "—"}</b>{a.headsign ? ` → ${a.headsign}` : ""}<span class="detail">{a.stopName} · {t.line(timeOf(a.scheduledAt ?? a.predictedAt, p.locale), a.delaySec === null ? "" : a.delaySec >= 60 ? t.late(Math.round(a.delaySec / 60)) : t.onTime)}</span></div>
          <button class="btn primary" disabled={busy !== null} onClick={() => open(a)}>{busy === a.tripId ? "…" : t.bet}</button>
        </div>
      ))}
      {err && <p class="formerr" role="alert">{t.unavailable}</p>}
    </div>
  );
}
