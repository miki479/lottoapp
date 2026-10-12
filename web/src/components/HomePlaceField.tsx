import { MapPin, Search, X } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { searchPlaces, type Place } from "../lib/places.ts";
import { Flag } from "./Flag.tsx";

/** Optional "your town": search, pick, remove. Unlocks the nearby bets without sharing the exact position. */
export function HomePlaceField(p: { msg: Messages; locale: Locale; value: Place | null; onChange: (pl: Place | null) => void }) {
  const n = p.msg.nearby;
  const [q, setQ] = useState(""), [found, setFound] = useState<Place[] | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setFound(null); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => searchPlaces(q.trim(), p.locale === "it" ? "it" : "en", ctl.signal).then(setFound).catch(() => {}), 300);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);
  if (p.value) {
    return <div class="homefield"><span class="detail">{n.home}</span><div class="placerow"><Flag cc={p.value.country} size={14} /><span class="pn"><b>{p.value.name}</b>{p.value.admin && <small>{p.value.admin}</small>}</span>
      <button class="iconbtn" aria-label={n.homeClear} onClick={() => p.onChange(null)}><X size={18} /></button></div></div>;
  }
  return (
    <div class="homefield">
      <span class="detail">{n.home}</span>
      <p class="hint">{n.homeHint}</p>
      <label class="searchbox"><Search size={18} /><input class="field" value={q} placeholder={n.homeSearch} onInput={(e) => setQ((e.target as HTMLInputElement).value)} /></label>
      {found?.map((pl) => <button key={`${pl.lat},${pl.lon}`} class="placerow" onClick={() => { p.onChange(pl); setQ(""); setFound(null); }}><Flag cc={pl.country} size={14} /><span class="pn"><b>{pl.name}</b>{pl.admin && <small>{pl.admin}</small>}</span><MapPin size={16} /></button>)}
    </div>
  );
}
