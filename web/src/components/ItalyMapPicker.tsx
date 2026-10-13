import { ArrowLeft } from "lucide-preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Locale } from "../i18n/index.ts";
import { haptic } from "../lib/haptics.ts";
import { ITALY_BOX, MAP_PROVINCES, MAP_REGIONS, type MapProvince, type MapRegion } from "../lib/italyMap.ts";

export interface MapCity { name: string; region: string; lat: number; lon: number }

const T: Record<string, { italy: string; tapRegion: string; tapCity: string; back: string }> = {
  it: { italy: "Italia", tapRegion: "Tocca una regione", tapCity: "Scegli la città", back: "Indietro" },
  "en-US": { italy: "Italy", tapRegion: "Tap a region", tapCity: "Pick the town", back: "Back" },
  "en-GB": { italy: "Italy", tapRegion: "Tap a region", tapCity: "Pick the town", back: "Back" },
  ja: { italy: "イタリア", tapRegion: "地域をタップ", tapCity: "都市を選択", back: "戻る" },
};
const SHORT: Record<string, string> = { "emilia-romagna": "Emilia-R.", "friuli-venezia-giulia": "Friuli VG", "trentino-alto-adige": "Trentino AA", "valle-d-aosta": "Aosta" };
type Box = [number, number, number, number];
const pad = (b: Box, f: number): Box => [b[0] - b[2] * f, b[1] - b[3] * f, b[2] * (1 + 2 * f), b[3] * (1 + 2 * f)];
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A small map of Italy: tap a region, the map zooms in and shows its towns (capitals of the provinces), tap one to choose it. The arrow goes back to the regions. */
export function ItalyMapPicker(p: { locale: Locale; initialRegion?: string | null; onRegion?: (id: string | null) => void; onPick: (c: MapCity) => void; busy?: boolean }) {
  const t = T[p.locale] ?? T["en-US"]!;
  const [region, setRegion] = useState<string | null>(p.initialRegion ?? null);
  const target = useMemo<Box>(() => { const r = MAP_REGIONS.find((x) => x.id === region); return r ? pad(r.box, 0.1) : pad(ITALY_BOX, 0.02); }, [region]);
  const [vb, setVb] = useState<Box>(target), cur = useRef<Box>(target);
  // the view glides to the new box (a plain tween: the viewBox cannot be animated with CSS)
  useEffect(() => {
    if (reduced()) { cur.current = target; setVb(target); return; }
    const from = cur.current, t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 420), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const b = from.map((v, i) => v + (target[i]! - v) * e) as Box;
      cur.current = b; setVb(b);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  const go = (id: string | null) => { setRegion(id); p.onRegion?.(id); haptic.tap(); };
  const reg = MAP_REGIONS.find((x) => x.id === region) ?? null;
  const cities = useMemo(() => (reg ? MAP_PROVINCES.filter((x) => x.region === reg.id).sort((a, b) => a.name.localeCompare(b.name, "it")) : []), [reg]);
  const regionName = (r: MapRegion) => (p.locale === "it" ? r.name : r.en);
  const pick = (c: MapProvince) => { if (p.busy) return; haptic.tap(); p.onPick({ name: c.name, region: reg?.name ?? "", lat: c.lat, lon: c.lon }); };
  const w = vb[2], labelSize = target[2] * (cities.length > 8 ? 0.03 : 0.04);
  // town labels: put each one where it overlaps no other (above, below, or to the side of its dot)
  const labels = useMemo(() => {
    const tw = target[2], fs = labelSize, placed: { x0: number; x1: number; y0: number; y1: number }[] = [], out: Record<string, { x: number; y: number; anchor: "start" | "middle" | "end"; text: string }> = {};
    const shorten = (n: string) => { const w = n.split(/[\s-]/)[0]!; return w.length > 8 ? `${w.slice(0, 6)}.` : n.includes(" ") || n.includes("-") ? `${w}.` : w; };
    const tryPlace = (c: MapProvince, text: string) => {
      const wd = text.length * fs * 0.56, r = tw * 0.02;
      const cand: [number, number, "start" | "middle" | "end"][] = [[c.x, c.y - r - fs * 0.35, "middle"], [c.x, c.y + r + fs * 0.95, "middle"], [c.x + r + fs * 0.3, c.y - fs * 0.2, "start"], [c.x - r - fs * 0.3, c.y - fs * 0.2, "end"], [c.x + r + fs * 0.3, c.y + fs * 1.1, "start"], [c.x - r - fs * 0.3, c.y + fs * 1.1, "end"]];
      let best = cand[0]!, hit = Infinity, bestRect = { x0: 0, x1: 0, y0: 0, y1: 0 };
      for (const [x, y, a] of cand) {
        const x0 = a === "middle" ? x - wd / 2 : a === "start" ? x : x - wd, rect = { x0, x1: x0 + wd, y0: y - fs, y1: y + fs * 0.25 };
        const n = placed.filter((q) => rect.x0 < q.x1 && rect.x1 > q.x0 && rect.y0 < q.y1 && rect.y1 > q.y0).length;
        if (n < hit) { hit = n; best = [x, y, a]; bestRect = rect; if (n === 0) break; }
      }
      return { best, hit, rect: bestRect };
    };
    // a name that cannot find room is cut short (Reggio Emilia -> Reggio, Pesaro e Urbino -> Pesaro.); the full list below always has the whole name
    for (const c of [...cities].sort((a, b) => a.x - b.x)) {
      let text = c.name, t = tryPlace(c, text);
      if (t.hit > 0) { const short = shorten(c.name), t2 = tryPlace(c, short); if (t2.hit < t.hit) { text = short; t = t2; } }
      placed.push(t.rect);
      out[c.id] = { x: t.best[0], y: t.best[1], anchor: t.best[2], text };
    }
    return out;
  }, [cities, target]);
  return (
    <div class="itpick">
      <div class="ithead">
        {reg ? <button type="button" class="iconbtn" onClick={() => go(null)} aria-label={t.back}><ArrowLeft size={20} /></button> : <span class="itdot" aria-hidden="true" />}
        <b>{reg ? regionName(reg) : t.italy}</b>
        <span class="hint">{reg ? t.tapCity : t.tapRegion}</span>
      </div>
      <svg class="itmap" style={`aspect-ratio:${(vb[2] / vb[3]).toFixed(3)}`} viewBox={vb.map((v) => v.toFixed(1)).join(" ")} role="group" aria-label={reg ? regionName(reg) : t.italy}>
        {MAP_REGIONS.map((r, i) => {
          const here = r.id === region, hidden = region !== null && !here;
          const provs = MAP_PROVINCES.filter((x) => x.region === r.id);
          return (
            <g key={r.id} class={`itreg ${here ? "here" : ""} ${hidden ? "off" : ""}`} style={`--h:${(i * 47) % 360}`}
              role={region === null ? "button" : undefined} tabIndex={region === null ? 0 : undefined} aria-label={region === null ? regionName(r) : undefined}
              onClick={region === null ? () => go(r.id) : undefined} onKeyDown={region === null ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(r.id); } } : undefined}>
              {provs.map((pv) => <path key={pv.id} d={pv.d} class="itprov" onClick={here ? (e) => { e.stopPropagation(); pick(pv); } : undefined} />)}
            </g>
          );
        })}
        {reg && cities.map((c) => (
          <g key={c.id} class="itcity" role="button" tabIndex={0} aria-label={c.name} onClick={() => pick(c)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(c); } }}>
            <circle cx={c.x} cy={c.y} r={w * 0.016} /><circle class="hit" cx={c.x} cy={c.y} r={w * 0.045} />
            <text x={labels[c.id]?.x ?? c.x} y={labels[c.id]?.y ?? c.y} font-size={labelSize} text-anchor={labels[c.id]?.anchor ?? "middle"}>{labels[c.id]?.text ?? c.name}</text>
          </g>
        ))}
        {!reg && MAP_REGIONS.map((r) => <text key={r.id} class="itlabel" x={r.cx} y={r.cy} font-size="26" text-anchor="middle">{SHORT[r.id] ?? regionName(r)}</text>)}
      </svg>
      <div class="itlist" role="group">
        {reg
          ? <>{cities.map((c) => <button key={c.id} type="button" class="mkchip" disabled={p.busy} onClick={() => pick(c)}>{c.name}</button>)}</>
          : MAP_REGIONS.map((r) => <button key={r.id} type="button" class="mkchip" onClick={() => go(r.id)}>{regionName(r)}</button>)}
      </div>
      {reg && <button type="button" class="btn secondary wide itback" onClick={() => go(null)}><ArrowLeft size={18} />{t.italy}</button>}
    </div>
  );
}
