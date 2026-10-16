import { Bus, MapPin, Swords, Trophy, X } from "lucide-preact";
import { useRef, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { cityName, cityOf } from "../lib/cities.ts";
import { question, type MarketRow } from "../lib/format.ts";
import { leisureTime } from "../lib/intent.ts";
import { useIntent, type Arrival } from "../lib/useIntent.ts";
import { leagueName, teamName } from "../lib/names.ts";

type Pick = "yes" | "no";
const timeOf = (epoch: number, locale: Locale) => new Date(epoch * 1000).toLocaleTimeString(locale === "ja" ? "ja-JP" : locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/**
 * One card with what the person most likely wants right now: the bus they are waiting for when they stand at a stop, or a match, the weather and a challenge
 * for friends when they are at home or it is evening or weekend. Nothing at all while they walk past. The location part only works after they said yes.
 */
export function ForYou(p: { msg: Messages; locale: Locale; now: number; markets: MarketRow[] | null; registered: boolean; home: { lat: number; lon: number } | null; onPick: (m: MarketRow, pick: Pick) => void; onCreate: () => void }) {
  const t = p.msg.fy;
  const it = useIntent({ registered: p.registered, home: p.home });
  const [busy, setBusy] = useState<string | null>(null), [err, setErr] = useState(false), going = useRef(false);
  if (!p.registered) return null;

  if (it.consent === "unset") {
    return (
      <section class="card stack foryou" aria-label={t.title}>
        <div class="fyhead"><MapPin size={20} /><b>{t.consentTitle}</b></div>
        <p class="hint">{t.consentBody}</p>
        <div class="fyactions"><button class="btn secondary" onClick={it.disable}>{t.consentNo}</button><button class="btn primary" onClick={it.enable}>{t.consentYes}</button></div>
      </section>
    );
  }

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

  if (it.consent === "on" && it.situation === "waiting") {
    const near = it.stops[0], list = it.arrivals.filter((a) => a.distanceM <= 80 && (a.marketId || a.offerable)).slice(0, 3);
    if (near && list.length > 0) {
      return (
        <section class="card stack foryou waiting" aria-label={t.title}>
          <div class="fyhead"><Bus size={20} /><b>{t.atStop(near.name)}</b></div>
          {list.map((a) => (
            <div class="fyrow" key={a.tripId + a.stopId}>
              <div class="grow"><b>{a.routeName || "—"}</b>{a.headsign ? ` → ${a.headsign}` : ""}<span class="detail">{t.line(timeOf(a.scheduledAt ?? a.predictedAt, p.locale), a.delaySec === null ? "" : a.delaySec >= 60 ? t.late(Math.round(a.delaySec / 60)) : t.onTime)}</span></div>
              <button class="btn primary" disabled={busy !== null} onClick={() => open(a)}>{busy === a.tripId ? "…" : t.bet}</button>
            </div>
          ))}
          {err && <p class="formerr" role="alert">{t.unavailable}</p>}
        </section>
      );
    }
  }
  if (it.consent === "on" && it.situation === "passing") return null;

  // at home, or a time of day for leisure: a match, the weather, a challenge
  if (it.situation === "home" || (it.situation === "unknown" && leisureTime(new Date(p.now)))) {
    const list = p.markets ?? [], nowS = p.now / 1000;
    const match = list.filter((m) => m.kind === "match_bet" && m.params.bet === "home_win" && Number(m.params.kickoff) > nowS && Number(m.params.kickoff) < nowS + 30 * 3600).sort((a, b) => Number(a.params.kickoff) - Number(b.params.kickoff))[0];
    const wx = list.filter((m) => m.category === "weather" && Date.parse(m.closes_at) > p.now && Date.parse(m.closes_at) < p.now + 24 * 3600_000).sort((a, b) => Date.parse(a.closes_at) - Date.parse(b.closes_at))[0];
    if (!match && !wx) return null;
    return (
      <section class="card stack foryou" aria-label={t.title}>
        <div class="fyhead"><Trophy size={20} /><b>{t.homeTitle}</b></div>
        {match && <div class="fyrow"><div class="grow"><b>{teamName(String(match.params.home), p.locale)} – {teamName(String(match.params.away), p.locale)}</b><span class="detail">{leagueName(String(match.params.league ?? ""), p.locale)} · {timeOf(Number(match.params.kickoff), p.locale)}</span></div><button class="btn secondary" onClick={() => p.onPick(match, "yes")}>{t.matchBtn}</button></div>}
        {wx && <div class="fyrow"><div class="grow"><span>{question(wx, p.msg, p.locale, cityName(cityOf(wx.city_id), p.locale), cityOf(wx.city_id).timezone, new Date(p.now))}</span></div><button class="btn secondary" onClick={() => p.onPick(wx, "yes")}>{t.rainBtn}</button></div>}
        <button class="btn secondary wide" onClick={p.onCreate}><Swords size={18} />{t.challenge}</button>
        {it.denied && <p class="hint"><X size={12} /> {t.denied}</p>}
      </section>
    );
  }
  return null;
}
