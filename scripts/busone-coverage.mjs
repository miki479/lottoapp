// Every N minutes: how many trains the BusOne feed (Trenitalia + Italo) reports, how many have a delay, and their train numbers.
//   node scripts/busone-coverage.mjs [minutes=10] >> coverage.jsonl
import GtfsRt from "gtfs-realtime-bindings";
const FEEDS = { trenitalia: "https://proxy.busone.app/trenitalia/gtfs-rt/trip-updates.pb", italo: "https://proxy.busone.app/italo/gtfs-rt/trip-updates.pb" };
const H = { "X-BusOne-Client": "LateLotto (play-money game; https://latelotto.web.app)", "X-BusOne-Use": "personal" };
const every = Math.max(1, Number(process.argv[2] ?? 10)) * 60_000;
async function once() {
  const row = { at: new Date().toISOString() };
  for (const [k, url] of Object.entries(FEEDS)) {
    try {
      const buf = new Uint8Array(await (await fetch(url, { headers: H, signal: AbortSignal.timeout(25000) })).arrayBuffer());
      const f = GtfsRt.transit_realtime.FeedMessage.toObject(GtfsRt.transit_realtime.FeedMessage.decode(buf), { longs: Number });
      const trips = (f.entity ?? []).filter((e) => e.tripUpdate).map((e) => e.tripUpdate);
      row[k] = { trips: trips.length, withDelay: trips.filter((t) => (t.stopTimeUpdate ?? []).some((s) => (s.arrival?.delay ?? s.departure?.delay) !== undefined)).length, numbers: trips.map((t) => (String(t.trip?.tripId ?? "").match(/-(\d{3,5})-/) ?? [])[1] ?? String(t.trip?.tripId ?? "").slice(0, 12)) };
    } catch (e) { row[k] = { error: String(e.message ?? e).slice(0, 80) }; }
  }
  console.log(JSON.stringify(row));
}
await once();
while (true) { await new Promise((r) => setTimeout(r, every)); await once(); }
