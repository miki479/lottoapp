import { MapPin, Search, X } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { FAMOUS_PLACES, FEATURED_PLACES, ITALY_CAPITALS, searchPlaces, type Place } from "../lib/places.ts";
import { CITIES, cityName, enabledCategories } from "../lib/cities.ts";
import { Flag } from "./Flag.tsx";
import { Sheet } from "./Sheet.tsx";

/** Weather for any town: search it (or tap a regional capital) and its rain questions open right away. */
export function PlacePicker(p: { msg: Messages; locale: Locale; recent: Place[]; onCity: (id: string) => void; onPick: (place: Place) => Promise<void> | void; onClose: () => void }) {
  const m = p.msg.places;
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setFound(null); return; }
    const ctl = new AbortController(); setErr(null);
    const t = setTimeout(() => searchPlaces(q.trim(), p.locale === "it" ? "it" : "en", ctl.signal).then(setFound).catch((e) => { if (e.name !== "AbortError") setErr(m.searchError); }), 300);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);
  const going = useRef(false);
  const choose = async (pl: Omit<Place, "id">) => {
    if (going.current) return;
    going.current = true; setBusy(pl.name); setErr(null);
    try { await p.onPick({ ...pl, id: "" }); } catch { setErr(p.msg.errors.generic!); } finally { going.current = false; setBusy(null); }
  };
  const row = (pl: Omit<Place, "id">, key: string) => (
    <button key={key} class="placerow" disabled={busy !== null} onClick={() => choose(pl)}>
      <Flag cc={pl.country} size={14} /><span class="pn"><b>{pl.name}</b>{pl.admin && <small>{pl.admin}</small>}</span>{busy === pl.name ? <span class="detail">…</span> : <MapPin size={16} />}
    </button>
  );
  return (
    <Sheet onClose={p.onClose} label={m.title}>
      <div class="shead"><h2>{m.title}</h2><button class="iconbtn" onClick={p.onClose} aria-label={p.msg.common.close}><X size={22} /></button></div>
      <p class="hint">{m.hint}</p>
      <label class="searchbox"><Search size={18} /><input class="field" type="search" autofocus placeholder={m.search} value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} /></label>
      {err && <p class="formerr" role="alert">{err}</p>}
      {found !== null && (found.length === 0 ? <p class="hint">{m.none}</p> : <div class="placelist">{found.map((f) => row(f, f.id))}</div>)}
      {found === null && p.recent.length > 0 && <><h3>{m.recent}</h3><div class="placelist">{p.recent.map((r) => row(r, r.id))}</div></>}
      {found === null && <><h3>{m.withData}</h3><div class="capgrid">{CITIES.filter((c) => enabledCategories(c).some((k) => k !== "weather")).map((c) => <button key={c.id} class="chip" onClick={() => p.onCity(c.id)}><Flag cc={c.country} size={13} />{cityName(c, p.locale)}</button>)}</div></>}
      {found === null && <><h3>{m.capitals}</h3><div class="capgrid">{ITALY_CAPITALS.map((c) => <button key={c.name} class="chip" disabled={busy !== null} onClick={() => choose(c)}>{c.name}</button>)}</div></>}
      {found === null && <><h3>{m.famous}</h3><div class="capgrid">{[...FEATURED_PLACES, ...FAMOUS_PLACES].map((c) => <button key={c.id} class="chip" disabled={busy !== null} onClick={() => choose(c)}>{c.name}</button>)}</div></>}
      <p class="hint">{m.credit}</p>
    </Sheet>
  );
}
