import { Bus } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { roundCoord } from "../../../shared/geo.ts";
import type { Locale, Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { every } from "../lib/poll.ts";
import type { MarketRow } from "../lib/format.ts";
import type { Pick } from "../lib/types.ts";
import type { Arrival } from "../lib/useIntent.ts";

const timeOf = (epoch: number, locale: Locale) => new Date(epoch * 1000).toLocaleTimeString(locale === "ja" ? "ja-JP" : locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** The buses and trains due at the stops within 250 m of the chosen place (home or where the player is): bet on the one that passes outside the door. */
export function StopsNear(p: { msg: Messages; locale: Locale; origin: { lat: number; lon: number }; onPick: (m: MarketRow, pick: Pick) => void }) {
  const t = p.msg.fy, n = p.msg.nearby;
  const [list, setList] = useState<Arrival[] | null>(null), [busy, setBusy] = useState<string | null>(null), [err, setErr] = useState(false), going = useRef(false);
  useEffect(() => {
    let live = true;
    const go = async () => {
      const { data, error } = await sb.functions.invoke("nearby", { body: { lat: roundCoord(p.origin.lat), lon: roundCoord(p.origin.lon), radiusM: 250 } });
      if (!live) return;
      if (error) { setList((l) => l ?? []); return; }
      setList(((data as { arrivals?: Arrival[] } | null)?.arrivals ?? []).filter((a) => a.marketId || a.offerable).slice(0, 6));
    };
    go().catch(() => { if (live) setList((l) => l ?? []); });
    const stop = every(() => { go().catch(() => {}); }, 60_000);
    return () => { live = false; stop(); };
  }, [p.origin.lat, p.origin.lon]);
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
  if (list === null) return <div class="sk s" />;
  return (
    <div class="stack stopsnear">
      <span class="detail"><Bus size={14} style="vertical-align:-2px" /> {n.passing}</span>
      {list.length === 0 && <p class="hint">{n.passingNone}</p>}
      {list.map((a) => (
        <div class="fyrow" key={a.tripId + a.stopId}>
          <div class="grow"><b>{a.routeName || "—"}</b>{a.headsign ? ` → ${a.headsign}` : ""}<span class="detail">{a.stopName} · {t.line(timeOf(a.scheduledAt ?? a.predictedAt, p.locale), a.delaySec === null ? "" : a.delaySec >= 60 ? t.late(Math.round(a.delaySec / 60)) : t.onTime)}</span></div>
          <button class="btn primary" disabled={busy !== null} onClick={() => open(a)}>{busy === a.tripId ? "…" : t.bet}</button>
        </div>
      ))}
      {err && <p class="formerr" role="alert">{t.unavailable}</p>}
    </div>
  );
}
