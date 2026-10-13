import { useEffect, useRef, useState } from "preact/hooks";
import { distanceM, roundCoord } from "../../../shared/geo.ts";
import { sb } from "./api.ts";
import { classify, shouldAsk, updateAnchor, type Anchor, type Situation } from "./intent.ts";

export interface NearbyStop { id: string; feedId: string; name: string; lat: number; lon: number; distanceM: number }
export interface Arrival {
  feedId: string; cityId: string; category: "bus" | "train"; tripId: string; routeName: string; headsign: string; stopId: string; stopName: string;
  distanceM: number; scheduledAt: number | null; predictedAt: number; delaySec: number | null; marketId: string | null; offerable: boolean;
}
export type Consent = "unset" | "on" | "off";
const KEY = "intent";
const get = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };
const put = (v: string) => { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch { /* storage unavailable */ } };
const read = (): Consent => { const v = get(); return v === "1" ? "on" : v === "0" ? "off" : "unset"; };

/**
 * What the person is probably looking for: waiting at a stop, at home, or just passing. The position is read only while the page is visible and
 * only after the person said yes; it stays in this phone's memory, and the server only ever sees it rounded to a ~100 m grid, to list the stops nearby.
 */
export function useIntent(o: { registered: boolean; home: { lat: number; lon: number } | null }) {
  const [consent, setConsent] = useState<Consent>(read);
  const [situation, setSituation] = useState<Situation>("unknown");
  const [stops, setStops] = useState<NearbyStop[]>([]);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [denied, setDenied] = useState(false);
  const homeRef = useRef(o.home); homeRef.current = o.home;

  useEffect(() => {
    if (consent !== "on" || !o.registered || typeof navigator === "undefined" || !navigator.geolocation) { setSituation("unknown"); setStops([]); setArrivals([]); return; }
    let anchor: Anchor | null = null, lastAsk: { lat: number; lon: number; at: number } | null = null, nearest: number | null = null, watch: number | null = null, asking = false, dead = false;

    const evaluate = () => {
      const now = Date.now();
      setSituation(classify({ anchor, now, nearestStopM: nearest, home: homeRef.current }));
      if (anchor && !asking && shouldAsk(anchor, now, lastAsk)) void ask(anchor);
    };
    const ask = async (a: Anchor) => {
      asking = true; lastAsk = { lat: a.lat, lon: a.lon, at: Date.now() };
      try {
        const { data, error } = await sb.functions.invoke("nearby", { body: { lat: roundCoord(a.lat), lon: roundCoord(a.lon), radiusM: 150 } });
        if (dead || error) return;
        const r = data as { stops?: NearbyStop[]; arrivals?: Arrival[] } | null;
        const list = r?.stops ?? [];
        // the distance that counts is the real one, measured here from where the person is, not from the rounded point the server saw
        const exact = list.map((s) => ({ ...s, distanceM: Math.round(distanceM(a.lat, a.lon, s.lat, s.lon)) })).sort((x, y) => x.distanceM - y.distanceM);
        const byStop = new Map(exact.map((s) => [`${s.feedId}|${s.id}`, s.distanceM]));
        nearest = exact.length ? exact[0]!.distanceM : null;
        setStops(exact);
        setArrivals((r?.arrivals ?? []).map((x) => ({ ...x, distanceM: byStop.get(`${x.feedId}|${x.stopId}`) ?? x.distanceM })));
        evaluate();
      } finally { asking = false; }
    };
    const onPos = (p: GeolocationPosition) => {
      const prev = anchor;
      anchor = updateAnchor(anchor, { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy, t: Date.now() });
      if (anchor !== prev && prev && anchor && anchor.since !== prev.since) { nearest = null; setStops([]); setArrivals([]); } // a new stay: what was listed is about another place
      evaluate();
    };
    const start = () => {
      if (watch !== null) return;
      watch = navigator.geolocation.watchPosition(onPos, (e) => { if (e.code === 1) { setDenied(true); } }, { enableHighAccuracy: false, maximumAge: 30_000, timeout: 20_000 });
    };
    const stop = () => { if (watch !== null) { navigator.geolocation.clearWatch(watch); watch = null; } };
    const onVis = () => { if (document.visibilityState === "visible") start(); else { stop(); anchor = null; lastAsk = null; nearest = null; } };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    const tick = setInterval(evaluate, 5_000);
    return () => { dead = true; stop(); clearInterval(tick); document.removeEventListener("visibilitychange", onVis); };
  }, [consent, o.registered]);

  const set = (c: Consent) => { put(c === "on" ? "1" : c === "off" ? "0" : ""); setConsent(c); if (c !== "on") { setSituation("unknown"); setStops([]); setArrivals([]); } setDenied(false); };
  return { consent, situation, stops, arrivals, denied, enable: () => set("on"), disable: () => set("off") };
}
