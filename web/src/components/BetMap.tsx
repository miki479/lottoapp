import { MapPin } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { every } from "../lib/poll.ts";
import type { MarketRow } from "../lib/format.ts";

interface Pos { lat: number; lon: number; bearing: number | null; at: string }
/** Tiles: OpenStreetMap by default (light use); set VITE_MAP_TILES to another provider's {z}/{x}/{y} URL for real traffic. */
const TILES = (import.meta.env.VITE_MAP_TILES as string | undefined) || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

/** A fold-away map of where the vehicle behind an open bet is right now. The map code is loaded only when it is opened. */
export function BetMap({ m, msg, now }: { m: Pick<MarketRow, "id" | "params" | "category">; msg: Messages; now: number }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null | undefined>(undefined);
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<{ marker: import("leaflet").Marker; stop?: import("leaflet").Marker; m: import("leaflet").Map; L: typeof import("leaflet") } | null>(null);
  const stopLat = Number(m.params.stopLat), stopLon = Number(m.params.stopLon);
  const hasStop = Number.isFinite(stopLat) && Number.isFinite(stopLon) && m.params.stopLat !== undefined;

  // where the vehicle is: only while the map is open
  useEffect(() => {
    if (!open) return;
    const go = () => sb.rpc("vehicle_position", { p_markets: [m.id] }).then(({ data }) => { const r = (data as (Pos & { market_id: string })[] | null)?.[0]; setPos(r ? { lat: r.lat, lon: r.lon, bearing: r.bearing, at: r.at } : null); });
    go();
    return every(go, 15_000);
  }, [open, m.id]);

  // the map itself, built on first open
  useEffect(() => {
    if (!open || !box.current || pos === undefined) return;
    let dead = false;
    (async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (dead || !box.current) return;
      if (!map.current) {
        const center: [number, number] = pos ? [pos.lat, pos.lon] : hasStop ? [stopLat, stopLon] : [42.5, 12.5];
        const mp = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView(center, pos || hasStop ? 14 : 5);
        L.tileLayer(TILES, { maxZoom: 18, attribution: msg.map.credit }).addTo(mp);
        const icon = (cls: string, html: string) => L.divIcon({ className: `bm-icon ${cls}`, html, iconSize: [30, 30], iconAnchor: [15, 15] });
        const marker = L.marker(center, { icon: icon("veh", m.category === "train" ? "🚆" : "🚌"), title: msg.map.vehicle }).addTo(mp);
        const stop = hasStop ? L.marker([stopLat, stopLon], { icon: icon("stp", "📍"), title: msg.map.stop }).addTo(mp) : undefined;
        map.current = { marker, stop, m: mp, L };
        setTimeout(() => mp.invalidateSize(), 50);
      }
      const c = map.current;
      if (pos) {
        c.marker.setLatLng([pos.lat, pos.lon]).addTo(c.m);
        const pts: [number, number][] = [[pos.lat, pos.lon]]; if (hasStop) pts.push([stopLat, stopLon]);
        c.m.fitBounds(c.L.latLngBounds(pts), { padding: [34, 34], maxZoom: 15 });
      } else c.marker.remove();
    })();
    return () => { dead = true; };
  }, [open, pos, hasStop]);

  // leave nothing behind when the card goes away
  useEffect(() => () => { map.current?.m.remove(); map.current = null; }, []);
  useEffect(() => { if (!open && map.current) { map.current.m.remove(); map.current = null; } }, [open]);

  const age = pos ? Math.max(0, Math.round((now - Date.parse(pos.at)) / 1000)) : 0;
  return (
    <div class="betmap">
      <button class="mapbtn" aria-expanded={open} onClick={() => setOpen(!open)}><MapPin size={15} />{open ? msg.map.hide : msg.map.show}</button>
      {open && (
        <div class="mapbody">
          <div ref={box} class="mapbox" />
          {pos === undefined && <p class="hint">…</p>}
          {pos === null && <p class="hint">{msg.map.none}</p>}
          {pos && <p class="hint">{msg.map.updated(age)}{m.params.posEst ? ` · ${msg.map.estimated}` : ""}</p>}
        </div>
      )}
    </div>
  );
}
