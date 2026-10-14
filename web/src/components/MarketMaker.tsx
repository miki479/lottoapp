import { Minus, Plus, X } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { INTL_TAG } from "../i18n/index.ts";
import { useBusy } from "../lib/busy.ts";
import { sb } from "../lib/api.ts";
import { ensurePlace, placeById, searchPlaces, type Place } from "../lib/places.ts";
import { Map as MapIcon, Search } from "lucide-preact";
import { ItalyMapPicker, type MapCity } from "./ItalyMapPicker.tsx";
import type { MarketRow } from "../lib/format.ts";
import { fmtOdds } from "../lib/format.ts";
import { Sheet } from "./Sheet.tsx";
import { Flag } from "./Flag.tsx";
import { CITIES } from "../lib/cities.ts";
import { MatchPicker } from "./MatchPicker.tsx";
import { STEAM, WIKI_ARTICLES, CRYPTO } from "../../../shared/ticks.ts";
import { METRICS } from "../../../shared/metrics.ts";
import { ALWAYS } from "../lib/num.ts";

type Tab = "weather" | "crypto" | "games" | "culture" | "match";
interface Preview { threshold: number; step?: number; odds_yes: number; odds_no: number; chance: number; forecast?: number; reference?: number; unit?: string }
const METRIC_LIST = ["temp", "wind", "uv", "aqi", "snow", "hail"] as const;
const SPOT_OFFSETS = [1, 3, 6, 12, 24];

const MAP_TXT: Record<string, string> = { it: "Scegli sulla mappa", "en-US": "Pick on the map", "en-GB": "Pick on the map", ja: "地図から選ぶ" };
/** Build your own question from a template. The server checks, prices and refuses what would be too obvious. */
export function MarketMaker(p: { msg: Messages; locale: Locale; places: { id: string; name: string }[]; onClose: () => void; onQuake: () => void; onFriends: () => void; onCreated: (m: MarketRow) => void; registered: boolean; origin: { lat: number; lon: number } | null }) {
  const m = p.msg.maker, nf1 = new Intl.NumberFormat(INTL_TAG[p.locale], { maximumFractionDigits: 1, useGrouping: ALWAYS }), nf0 = new Intl.NumberFormat(INTL_TAG[p.locale], { maximumFractionDigits: 0, useGrouping: ALWAYS });
  const nf = { format: (v: number) => (Math.abs(v) >= 1000 ? nf0 : nf1).format(v) };
  const [tab, setTab] = useState<Tab>("weather");
  const [place, setPlace] = useState(p.places[0]?.id ?? ""), [metric, setMetric] = useState<(typeof METRIC_LIST)[number]>("temp"), [dayOffset, setDayOffset] = useState(1), [hour, setHour] = useState(15);
  const [series, setSeries] = useState("btc"), [offset, setOffset] = useState(6), [wikiDay, setWikiDay] = useState(1);
  const [thr, setThr] = useState<number | null>(null), [pv, setPv] = useState<Preview | null>(null);
  const [busy, run] = useBusy(), [err, setErr] = useState<string | null>(null);
  // any town can be picked, not only the ones listed: the search finds it, and ensure_place gives it the id the questions are made on
  const [q, setQ] = useState(""), [found, setFound] = useState<Place[] | null>(null), [extra, setExtra] = useState<{ id: string; name: string }[]>([]), [picking, setPicking] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) { setFound(null); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => searchPlaces(q.trim(), p.locale === "it" ? "it" : "en", ctl.signal).then(setFound).catch(() => {}), 300);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);
  const ccOf = (id: string) => CITIES.find((c) => c.id === id)?.country ?? placeById(id)?.country ?? extraCc.current[id];
  const extraCc = useRef<Record<string, string>>({});
  const [mapOpen, setMapOpen] = useState(false), [mapRegion, setMapRegion] = useState<string | null>(null);
  // a town chosen on the map: find its exact position (the map only knows the province), then register it like any searched town
  const pickMapCity = async (c: MapCity) => {
    if (picking) return;
    let pl: Place = { id: "", name: c.name, admin: c.region, country: "IT", lat: c.lat, lon: c.lon, timezone: "Europe/Rome" };
    try {
      const hits = await searchPlaces(c.name, "it");
      const norm = (x: string | null) => (x ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const it = hits.filter((h) => h.country === "IT");
      pl = it.find((h) => norm(h.admin) === norm(c.region)) ?? it[0] ?? pl;
    } catch { /* the position of the province is good enough for a forecast */ }
    await pickTown({ ...pl, name: c.name });
    setMapOpen(false);
  };
  const pickTown = async (pl: Place) => {
    if (picking) return;
    setPicking(true); setErr(null);
    try { const id = await ensurePlace(pl); extraCc.current[id] = pl.country; setExtra((x) => (x.some((y) => y.id === id) ? x : [...x, { id, name: pl.admin ? `${pl.name} (${pl.admin})` : pl.name }])); setPlace(id); setQ(""); setFound(null); }
    catch (e) { setErr(String((e as Error).message).includes("places_limit") ? p.msg.places.limit : p.msg.maker.errors.generic!); }
    setPicking(false);
  };

  const seriesList = tab === "crypto" ? Object.keys(CRYPTO) : tab === "games" ? Object.keys(STEAM).map((id) => `steam:${id}`) : WIKI_ARTICLES.map((a) => `wiki:${a}`);
  const label = (s: string) => (s === "btc" || s === "eth" ? CRYPTO[s].label : s.startsWith("steam:") ? STEAM[s.slice(6) as keyof typeof STEAM] : s.slice(5).replace(/_/g, " "));
  const wiki = tab === "culture";
  const at = () => { const now = Math.floor(Date.now() / 1000); return wiki ? Math.floor(now / 86400) * 86400 + (wikiDay + 1) * 86400 : Math.ceil((now + offset * 3600) / 1800) * 1800; };
  const body = (threshold: number, preview: boolean) => tab === "weather"
    ? { type: "metric", placeId: place, metric, dayOffset, hour, threshold, preview }
    : { type: "tick", series, at: at(), threshold, preview };

  useEffect(() => { setThr(null); setPv(null); setErr(null); if (tab !== "weather" && !seriesList.includes(series)) setSeries(seriesList[0]!); }, [tab]);
  useEffect(() => { setThr(null); setPv(null); setErr(null); }, [place, metric, dayOffset, hour, series, offset, wikiDay]);
  // price preview (threshold starts at the reference value, then follows the stepper)
  useEffect(() => {
    if (tab !== "weather" && !seriesList.includes(series)) return;
    if (tab === "weather" && !place) return;
    let live = true;
    const t = setTimeout(async () => {
      const { data, error } = await sb.functions.invoke("market-offer", { body: body(thr ?? 1, true) });
      if (!live) return;
      if (data?.preview) { setPv(data.preview as Preview); setErr(null); if (thr === null) setThr(data.preview.threshold); return; }
      let code = "generic", info: Record<string, number> = {};
      try { const j = await (error as { context?: Response })?.context?.json(); code = j?.error ?? "generic"; info = j ?? {}; } catch { /* no body */ }
      if (thr === null && typeof (info.reference ?? info.forecast) === "number") { const r = (info.reference ?? info.forecast)!, st = info.step || 1; setThr(Math.round(r / st) * st); setPv(null); return; }
      setPv(null); setErr(p.msg.maker.errors[code as "generic"] ?? p.msg.maker.errors.generic);
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [tab, place, metric, dayOffset, hour, series, offset, wikiDay, thr]);

  const step = pv?.step ?? 1;
  const create = () => run(async () => {
    if (thr === null) return;
    if (!p.registered) { setErr(m.needAccount); return; }
    setErr(null);
    const { data, error } = await sb.functions.invoke("market-offer", { body: body(thr, false) });
    if (data?.market) { p.onCreated(data.market as MarketRow); return; }
    let code = "generic";
    try { code = (await (error as { context?: Response })?.context?.json())?.error ?? "generic"; } catch { /* no body */ }
    setErr(code === "registration_required" ? m.needAccount : (m.errors[code as "generic"] ?? m.errors.generic));
  }, () => setErr(m.errors.generic));
  const chips = (items: { k: string; t: string }[], cur: string, set: (k: string) => void) => (
    <div class="mkchips">{items.map((i) => <button key={i.k} class={`mkchip ${cur === i.k ? "on" : ""}`} onClick={() => set(i.k)} aria-pressed={cur === i.k}>{i.t}</button>)}</div>
  );
  return (
    <Sheet onClose={p.onClose} label={m.title}>
      <div class="shead"><h2>{m.title}</h2><button class="iconbtn" onClick={p.onClose} aria-label={p.msg.common.close}><X size={22} /></button></div>
      <p class="hint">{m.hint}</p>
      <div class="mkchips wrap">
        <button class="mkchip" onClick={p.onFriends}>{p.msg.friends.tab}</button>
        {(["weather", "crypto", "games", "culture"] as Tab[]).map((t) => <button key={t} class={`mkchip ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{m.tabs[t as "weather"]}</button>)}
        <button class={`mkchip ${tab === "match" ? "on" : ""}`} onClick={() => setTab("match")}>{p.msg.matchmaker.tab}</button>
        <button class="mkchip" onClick={p.onQuake}>{m.tabs.quake}</button>
      </div>
      {tab === "match" ? <MatchPicker msg={p.msg} locale={p.locale} origin={p.origin} registered={p.registered} onCreated={p.onCreated} /> : tab === "weather" ? <>
        <div class="qmfield"><span class="detail">{m.place}</span>
          <div class="townrow"><b>{ccOf(place) && <Flag cc={ccOf(place)!} size={16} />} {[...p.places, ...extra].find((x) => x.id === place)?.name ?? "—"}</b>
            <button type="button" class="btn secondary" aria-expanded={mapOpen} onClick={() => setMapOpen(!mapOpen)}><MapIcon size={16} />{MAP_TXT[p.locale] ?? MAP_TXT["en-US"]}</button></div>
        </div>
        {mapOpen && <ItalyMapPicker locale={p.locale} initialRegion={mapRegion} onRegion={setMapRegion} onPick={pickMapCity} busy={picking} />}
        <label class="searchbox"><Search size={18} /><input class="field" value={q} placeholder={p.msg.places.search} aria-label={p.msg.places.search} onInput={(e) => setQ((e.target as HTMLInputElement).value)} /></label>
        {found?.map((pl) => <button key={`${pl.lat},${pl.lon}`} class="placerow" disabled={picking} onClick={() => pickTown(pl)}><Flag cc={pl.country} size={14} /><span class="pn"><b>{pl.name}</b>{pl.admin && <small>{pl.admin}</small>}</span></button>)}
        <span class="detail">{m.metric}</span>{chips(METRIC_LIST.map((k) => ({ k, t: p.msg.wx.names[k] })), metric, (k) => setMetric(k as typeof metric))}
        <div class="qmgrid">
          <label class="qmfield"><span class="detail">{m.day}</span><select class="field" value={dayOffset} onChange={(e) => setDayOffset(Number((e.target as HTMLSelectElement).value))}><option value={0}>{m.today}</option><option value={1}>{m.tomorrow}</option></select></label>
          <label class="qmfield"><span class="detail">{m.hour}</span><select class="field" value={hour} onChange={(e) => setHour(Number((e.target as HTMLSelectElement).value))}>{Array.from({ length: 18 }, (_, i) => i + 6).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:30</option>)}</select></label>
        </div>
      </> : <>
        <span class="detail">{m.pickOne}</span>{chips(seriesList.map((s) => ({ k: s, t: label(s) })), series, setSeries)}
        <span class="detail">{m.when}</span>
        {wiki ? chips([{ k: "1", t: m.midnightToday }, { k: "2", t: m.midnightTomorrow }].map((x) => ({ ...x })), String(wikiDay + 1), (k) => setWikiDay(Number(k) - 1))
          : chips(SPOT_OFFSETS.map((h) => ({ k: String(h), t: m.in_h.replace("{n}", String(h)) })), String(offset), (k) => setOffset(Number(k)))}
      </>}
      {tab !== "match" && thr !== null && <div class="mkline">
        <span class="detail">{m.line}</span>
        <div class="stepper"><button class="iconbtn" onClick={() => setThr(Math.max(step, thr - step))} aria-label="−"><Minus size={20} /></button><b class="num">{nf.format(thr)}{tab === "weather" ? ` ${METRICS[metric].unit}` : tab === "crypto" ? " $" : ""}</b><button class="iconbtn" onClick={() => setThr(thr + step)} aria-label="+"><Plus size={20} /></button></div>
        {pv && <p class="hint num">{pv.forecast !== undefined ? `${m.forecastLbl}: ${nf.format(pv.forecast)}` : `${m.now}: ${nf.format(pv.reference ?? 0)}`} · {m.odds}: {fmtOdds(pv.odds_yes, p.locale)} / {fmtOdds(pv.odds_no, p.locale)}</p>}
      </div>}
      {tab !== "match" && err && <p class="formerr" role="alert">{err}</p>}
      {tab !== "match" && <button class="btn primary wide" disabled={busy || !pv} aria-busy={busy} onClick={create}>{busy ? m.creating : m.create}</button>}
    </Sheet>
  );
}
