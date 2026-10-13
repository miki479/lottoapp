import { Check, Search, X } from "lucide-preact";
import { useMemo, useState } from "preact/hooks";
import type { Locale } from "../i18n/index.ts";
import { MAP_PROVINCES, MAP_REGIONS } from "../lib/italyMap.ts";
import { regionLabel } from "../lib/regions.ts";
import { Flag } from "./Flag.tsx";
import { Sheet } from "./Sheet.tsx";

const T: Record<string, { title: string; search: string; none: string; close: string; hint: string }> = {
  it: { title: "Scegli la regione", search: "Cerca regione o città…", none: "Nessun risultato", close: "Chiudi", hint: "Le domande delle città di quella regione" },
  "en-US": { title: "Pick a region", search: "Search a region or town…", none: "No results", close: "Close", hint: "Questions from the towns of that region" },
  "en-GB": { title: "Pick a region", search: "Search a region or town…", none: "No results", close: "Close", hint: "Questions from the towns of that region" },
  ja: { title: "地域を選ぶ", search: "地域・都市を検索…", none: "見つかりません", close: "閉じる", hint: "その地域の都市の予想" },
};
const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** All the Italian regions in alphabetical order with a search box (it finds the capital towns too), as a bottom sheet: the list is under the thumb. */
export function RegionPanel(p: { locale: Locale; current: string | null; counts: Record<string, number>; onPick: (regionId: string) => void; onClose: () => void }) {
  const t = T[p.locale] ?? T["en-US"]!;
  const [q, setQ] = useState("");
  const regions = useMemo(() => [...MAP_REGIONS].sort((a, b) => regionLabel(a.id, p.locale).localeCompare(regionLabel(b.id, p.locale), p.locale)), [p.locale]);
  const n = norm(q.trim());
  const rows = useMemo(() => {
    if (!n) return regions.map((r) => ({ id: r.id, title: regionLabel(r.id, p.locale), sub: "" }));
    const byRegion = regions.filter((r) => norm(regionLabel(r.id, p.locale)).includes(n)).map((r) => ({ id: r.id, title: regionLabel(r.id, p.locale), sub: "" }));
    const byTown = MAP_PROVINCES.filter((c) => norm(c.name).includes(n)).sort((a, b) => a.name.localeCompare(b.name, p.locale)).map((c) => ({ id: c.region, title: c.name, sub: regionLabel(c.region, p.locale) }));
    return [...byRegion, ...byTown];
  }, [n, regions, p.locale]);
  let last = "";
  return (
    <Sheet onClose={p.onClose} label={t.title}>
      <div class="shead"><h2><Flag cc="IT" size={18} /> {t.title}</h2><span class="grow" /><button class="iconbtn" onClick={p.onClose} aria-label={t.close}><X size={22} /></button></div>
      <label class="searchbox"><Search size={18} /><input class="field" type="search" value={q} placeholder={t.search} aria-label={t.search} onInput={(e) => setQ((e.target as HTMLInputElement).value)} /></label>
      <p class="hint">{t.hint}</p>
      <div class="regionlist" role="listbox" aria-label={t.title}>
        {rows.length === 0 && <p class="hint">{t.none}</p>}
        {rows.map((r, i) => {
          const letter = norm(r.title).charAt(0).toUpperCase(), head = !n && letter !== last ? ((last = letter), <span class="rletter" aria-hidden="true">{letter}</span>) : null;
          return (
            <>
              {head}
              <button key={`${r.id}-${i}`} type="button" role="option" aria-selected={p.current === r.id} class={`regionrow ${p.current === r.id ? "on" : ""}`} onClick={() => p.onPick(r.id)}>
                <span class="rn"><b>{r.title}</b>{r.sub && <small>{r.sub}</small>}</span>
                {(p.counts[r.id] ?? 0) > 0 && <em>{p.counts[r.id]}</em>}
                {p.current === r.id && <Check size={18} />}
              </button>
            </>
          );
        })}
      </div>
    </Sheet>
  );
}
