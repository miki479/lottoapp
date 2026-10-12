import { Minus, Plus, X } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { INTL_TAG } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import type { MarketRow } from "../lib/format.ts";
import { fmtOdds } from "../lib/format.ts";
import { Sheet } from "./Sheet.tsx";
import { STEAM, WIKI_ARTICLES, CRYPTO } from "../../../shared/ticks.ts";
import { METRICS } from "../../../shared/metrics.ts";

type Tab = "weather" | "crypto" | "games" | "culture";
interface Preview { threshold: number; step?: number; odds_yes: number; odds_no: number; chance: number; forecast?: number; reference?: number; unit?: string }
const METRIC_LIST = ["temp", "wind", "uv", "aqi", "snow"] as const;
const SPOT_OFFSETS = [1, 3, 6, 12, 24];

/** Build your own question from a template. The server checks, prices and refuses what would be too obvious. */
export function MarketMaker(p: { msg: Messages; locale: Locale; places: { id: string; name: string }[]; onClose: () => void; onQuake: () => void; onCreated: (m: MarketRow) => void; registered: boolean }) {
  const m = p.msg.maker, nf = new Intl.NumberFormat(INTL_TAG[p.locale], { maximumFractionDigits: 1 });
  const [tab, setTab] = useState<Tab>("weather");
  const [place, setPlace] = useState(p.places[0]?.id ?? ""), [metric, setMetric] = useState<(typeof METRIC_LIST)[number]>("temp"), [dayOffset, setDayOffset] = useState(1), [hour, setHour] = useState(15);
  const [series, setSeries] = useState("btc"), [offset, setOffset] = useState(6), [wikiDay, setWikiDay] = useState(1);
  const [thr, setThr] = useState<number | null>(null), [pv, setPv] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);

  const seriesList = tab === "crypto" ? Object.keys(CRYPTO) : tab === "games" ? Object.keys(STEAM).map((id) => `steam:${id}`) : WIKI_ARTICLES.map((a) => `wiki:${a}`);
  const label = (s: string) => (s === "btc" || s === "eth" ? CRYPTO[s].label : s.startsWith("steam:") ? STEAM[s.slice(6) as keyof typeof STEAM] : s.slice(5).replace(/_/g, " "));
  const wiki = tab === "culture";
  const at = () => { const now = Math.floor(Date.now() / 1000); return wiki ? Math.floor(now / 86400) * 86400 + (wikiDay + 1) * 86400 : now + offset * 3600; };
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
  const create = async () => {
    if (thr === null) return;
    if (!p.registered) { setErr(m.needAccount); return; }
    setBusy(true); setErr(null);
    const { data, error } = await sb.functions.invoke("market-offer", { body: body(thr, false) });
    setBusy(false);
    if (data?.market) { p.onCreated(data.market as MarketRow); return; }
    let code = "generic";
    try { code = (await (error as { context?: Response })?.context?.json())?.error ?? "generic"; } catch { /* no body */ }
    setErr(code === "registration_required" ? m.needAccount : (m.errors[code as "generic"] ?? m.errors.generic));
  };
  const chips = (items: { k: string; t: string }[], cur: string, set: (k: string) => void) => (
    <div class="mkchips">{items.map((i) => <button key={i.k} class={`mkchip ${cur === i.k ? "on" : ""}`} onClick={() => set(i.k)} aria-pressed={cur === i.k}>{i.t}</button>)}</div>
  );
  return (
    <Sheet onClose={p.onClose} label={m.title}>
      <div class="shead"><h2>{m.title}</h2><button class="iconbtn" onClick={p.onClose} aria-label={p.msg.common.close}><X size={22} /></button></div>
      <p class="hint">{m.hint}</p>
      <div class="mkchips">
        {(["weather", "crypto", "games", "culture"] as Tab[]).map((t) => <button key={t} class={`mkchip ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{m.tabs[t]}</button>)}
        <button class="mkchip" onClick={p.onQuake}>{m.tabs.quake}</button>
      </div>
      {tab === "weather" ? <>
        <label class="qmfield"><span class="detail">{m.place}</span><select class="field" value={place} onChange={(e) => setPlace((e.target as HTMLSelectElement).value)}>{p.places.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
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
      {thr !== null && <div class="mkline">
        <span class="detail">{m.line}</span>
        <div class="stepper"><button class="iconbtn" onClick={() => setThr(Math.max(step, thr - step))} aria-label="−"><Minus size={20} /></button><b class="num">{nf.format(thr)}{tab === "weather" ? ` ${METRICS[metric].unit}` : tab === "crypto" ? " $" : ""}</b><button class="iconbtn" onClick={() => setThr(thr + step)} aria-label="+"><Plus size={20} /></button></div>
        {pv && <p class="hint num">{pv.forecast !== undefined ? `${m.forecastLbl}: ${nf.format(pv.forecast)}` : `${m.now}: ${nf.format(pv.reference ?? 0)}`} · {m.odds}: {fmtOdds(pv.odds_yes, p.locale)} / {fmtOdds(pv.odds_no, p.locale)}</p>}
      </div>}
      {err && <p class="formerr" role="alert">{err}</p>}
      <button class="btn primary wide" disabled={busy || !pv} onClick={create}>{busy ? m.creating : m.create}</button>
    </Sheet>
  );
}
