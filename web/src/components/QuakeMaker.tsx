import { MapPin, Search, X } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { searchPlaces, type Place } from "../lib/places.ts";
import { sb } from "../lib/api.ts";
import type { MarketRow } from "../lib/format.ts";
import { localDayStart } from "../../../shared/time.ts";
import { Flag } from "./Flag.tsx";
import { Sheet } from "./Sheet.tsx";

const RADII = [100, 300, 1000], MAGS = [4, 4.5, 5, 5.5, 6, 7], LENGTHS = [1, 3, 6, 12, 24];

/** Pick a place, a radius, a magnitude and a time window; the server prices it from the real USGS rate and returns the new market. */
export function QuakeMaker(p: { msg: Messages; locale: Locale; onClose: () => void; onCreated: (m: MarketRow) => void }) {
  const m = p.msg.quakeMaker;
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Place[] | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [radius, setRadius] = useState(300), [mag, setMag] = useState(5), [day, setDay] = useState(0), [hour, setHour] = useState(20), [len, setLen] = useState(3);
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (q.trim().length < 2 || place) { setFound(null); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => searchPlaces(q.trim(), p.locale === "it" ? "it" : "en", ctl.signal).then(setFound).catch(() => {}), 300);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, place]);

  const create = async () => {
    if (!place) { setErr(m.pickPlace); return; }
    const now = Math.floor(Date.now() / 1000);
    const start = localDayStart(now + day * 86400, place.timezone) + hour * 3600;
    if (start < now + 35 * 60) { setErr(m.time); return; }
    setBusy(true); setErr(null);
    const { data, error } = await sb.functions.invoke("quake-offer", { body: { lat: place.lat, lon: place.lon, radiusKm: radius, minMag: mag, hours: len, startEpoch: start, place: place.name, tz: place.timezone } });
    setBusy(false);
    if (error || !data?.market) {
      let code = "generic";
      try { code = (await (error as { context?: Response })?.context?.json())?.error ?? "generic"; } catch { /* no body */ }
      setErr(code === "limit" ? m.limit : code === "full" ? m.full : code === "usgs_unavailable" ? m.usgs : code === "bad_time" ? m.time : p.msg.errors.generic!);
      return;
    }
    p.onCreated(data.market as MarketRow);
  };
  const sel = (label: string, value: number, opts: number[], fmt: (n: number) => string, set: (n: number) => void) => (
    <label class="qmfield"><span class="detail">{label}</span><select class="field" value={value} onChange={(e) => set(Number((e.target as HTMLSelectElement).value))}>{opts.map((o) => <option key={o} value={o}>{fmt(o)}</option>)}</select></label>
  );
  return (
    <Sheet onClose={p.onClose} label={m.title}>
      <div class="shead"><h2>{m.title}</h2><button class="iconbtn" onClick={p.onClose} aria-label={p.msg.common.close}><X size={22} /></button></div>
      <p class="hint">{m.body}</p>
      {place
        ? <button class="placerow" onClick={() => { setPlace(null); setQ(""); }}><Flag cc={place.country} size={14} /><span class="pn"><b>{place.name}</b>{place.admin && <small>{place.admin}</small>}</span><X size={16} /></button>
        : <>
            <label class="searchbox"><Search size={18} /><input class="field" value={q} placeholder={m.search} onInput={(e) => setQ((e.target as HTMLInputElement).value)} autoFocus /></label>
            {found?.map((pl) => <button key={`${pl.lat},${pl.lon}`} class="placerow" onClick={() => { setPlace(pl); setFound(null); }}><Flag cc={pl.country} size={14} /><span class="pn"><b>{pl.name}</b>{pl.admin && <small>{pl.admin}</small>}</span><MapPin size={16} /></button>)}
          </>}
      <div class="qmgrid">
        {sel(m.radius, radius, RADII, m.km, setRadius)}
        {sel(m.mag, mag, MAGS, (n) => `M${n.toFixed(1)}+`, setMag)}
        {sel(m.day, day, [0, 1, 2, 3], (n) => (n === 0 ? m.today : n === 1 ? m.tomorrow : `+${n}`), setDay)}
        {sel(m.hour, hour, Array.from({ length: 24 }, (_, i) => i), (n) => `${String(n).padStart(2, "0")}:00`, setHour)}
        {sel(m.length, len, LENGTHS, m.hours, setLen)}
      </div>
      {place && <p class="hint">{m.local(place.timezone)}</p>}
      {err && <p class="formerr" role="alert">{err}</p>}
      <button class="btn primary wide" disabled={busy} onClick={create}>{busy ? m.creating : m.create}</button>
      <p class="hint">{m.credit}</p>
    </Sheet>
  );
}
