import { ChevronDown, MapPin } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { every } from "../lib/poll.ts";
import { cityName, cityOf } from "../lib/cities.ts";
import { fmtOdds, type MarketRow } from "../lib/format.ts";
import type { Pick } from "../lib/types.ts";
import type { Place } from "../lib/places.ts";
import type { Challenge } from "./ChallengeSheet.tsx";
import { HomePlaceField } from "./HomePlaceField.tsx";
import { Q } from "./Q.tsx";
import { StopsNear } from "./StopsNear.tsx";

const RADII = [10, 25, 50, 100];
const COLS = "id,city_id,category,kind,params,closes_at,target_at,odds_yes,odds_no,status";

/** Player-made questions and local matches within some km of the player's town (or located place), most played and closest first. */
export function NearbyBets(p: { msg: Messages; locale: Locale; now: number; origin: { lat: number; lon: number; name: string } | null; home: Place | null; onHome: (pl: Place | null) => void; onLocate: () => void; onPick: (m: MarketRow, pick: Pick) => void; onChallenge: (code: string) => void; country: string | null; popular: { m: MarketRow; bets: number }[]; fallback: boolean; zone: string | null; busy: boolean }) {
  const n = p.msg.nearby;
  const [open, setOpen] = useState(true), [km, setKm] = useState(25);
  const [chal, setChal] = useState<{ c: Challenge; km: number; players: number }[]>([]);
  const [rows, setRows] = useState<{ m: MarketRow; km: number; bettors: number }[] | null>(null);
  // asked again every two minutes while the tab is in view (not on every tick of the clock)
  useEffect(() => {
    if (!p.origin) { setChal([]); return; }
    let live = true;
    const go = () => { sb.rpc("nearby_challenges", { p_lat: p.origin!.lat, p_lon: p.origin!.lon, p_country: p.country, p_limit: 8 }).then(({ data }) => { if (live) setChal(((data ?? []) as { challenge: Challenge; km: number | string; players: number | string }[]).map((x) => ({ c: x.challenge, km: +x.km, players: +x.players }))); }); };
    go();
    const stop = every(go, 120_000);
    return () => { live = false; stop(); };
  }, [p.origin?.lat, p.origin?.lon, p.country]);
  useEffect(() => {
    if (!p.origin) { setRows(null); return; }
    let live = true;
    const go = async () => {
      const { data } = await sb.rpc("nearby_markets", { p_lat: p.origin!.lat, p_lon: p.origin!.lon, p_km: km, p_limit: 12 });
      const hits = (data ?? []) as { market_id: string; km: number | string; bettors: number | string }[];
      if (!hits.length) { if (live) setRows([]); return; }
      const { data: ms } = await sb.from("markets").select(COLS).in("id", hits.map((h) => h.market_id));
      const by = new Map(((ms ?? []) as unknown as MarketRow[]).map((m) => [m.id, m]));
      if (live) setRows(hits.flatMap((h) => { const m = by.get(h.market_id); return m ? [{ m, km: +h.km, bettors: +h.bettors }] : []; }));
    };
    go().catch(() => { if (live) setRows((r) => r ?? []); });
    const stop = every(() => { go().catch(() => {}); }, 120_000);
    return () => { live = false; stop(); };
  }, [p.origin?.lat, p.origin?.lon, km]);
  return (
    <section class="nearbets card">
      <button class="nbhead" onClick={() => setOpen(!open)} aria-expanded={open}><MapPin size={18} /><b>{n.title}</b>{p.origin && <small>{p.origin.name}</small>}<ChevronDown size={18} class={open ? "up" : ""} /></button>
      {open && <div class="nbbody">
        <p class="hint">{n.hint}</p>
        {!p.origin && <><button class="btn secondary" disabled={p.busy} onClick={p.onLocate}><MapPin size={16} />{n.askLocate}</button><HomePlaceField msg={p.msg} locale={p.locale} value={p.home} onChange={p.onHome} /></>}
        <StopsNear msg={p.msg} locale={p.locale} fallback={p.origin} onPick={p.onPick} />
        {p.origin && <div class="mkchips">{RADII.map((r) => <button key={r} class={`mkchip ${km === r ? "on" : ""}`} aria-pressed={km === r} onClick={() => setKm(r)}>{r} {n.km}</button>)}</div>}
        {p.origin && chal.length > 0 && <span class="detail">{p.msg.fx.nearTitle}</span>}
        {chal.map(({ c, km: d, players }) => <button key={c.id} class="nbitem" onClick={() => p.onChallenge(c.code)}><span class="q"><b>{c.title}</b></span><span class="nbmeta"><span>{d < 1 ? "<1" : Math.round(d)} {n.km}</span><span>{players} {p.msg.fx.players}</span></span></button>)}
        {p.origin && rows === null && <div class="sk s" />}
        {p.origin && rows && rows.length === 0 && chal.length === 0 && <p class="hint">{n.none}</p>}
        {p.origin && p.zone && p.popular.length > 0 && !p.fallback && <span class="detail">{p.zone}</span>}
        {p.origin && !p.fallback && p.popular.map(({ m, bets }) => {
          const c = cityOf(m.city_id);
          return (
            <button key={`pop${m.id}`} class="nbitem" onClick={() => p.onPick(m, "yes")}>
              <span class="q"><Q m={m} msg={p.msg} locale={p.locale} city={cityName(c, p.locale)} tz={c.timezone} now={new Date(p.now)} /></span>
              <span class="nbmeta"><span>{bets} {n.people}</span><b class="num">{fmtOdds(Number(m.odds_yes), p.locale)} / {fmtOdds(Number(m.odds_no), p.locale)}</b></span>
            </button>
          );
        })}
        {rows?.map(({ m, km: d, bettors }) => {
          const c = cityOf(m.city_id);
          return (
            <button key={m.id} class="nbitem" onClick={() => p.onPick(m, "yes")}>
              <span class="q"><Q m={m} msg={p.msg} locale={p.locale} city={cityName(c, p.locale)} tz={c.timezone} now={new Date(p.now)} /></span>
              <span class="nbmeta"><span>{d < 1 ? "<1" : Math.round(d)} {n.km}</span>{bettors > 0 && <span>{bettors} {n.people}</span>}<b class="num">{fmtOdds(Number(m.odds_yes), p.locale)} / {fmtOdds(Number(m.odds_no), p.locale)}</b></span>
            </button>
          );
        })}
      </div>}
    </section>
  );
}
