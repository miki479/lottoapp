// Fetch a live feed of a city and run it through the real adapter.
// Usage: node scripts/smoke-feed.mjs <city> <feedId>
import { readFileSync } from "node:fs";
import GtfsRt from "gtfs-realtime-bindings";
import { validateCity } from "../shared/cities.ts";
import { delayAdapterFor, weatherAdapterFor } from "../shared/adapters/index.ts";

const [cityId, feedId] = process.argv.slice(2);
const city = validateCity(JSON.parse(readFileSync(new URL(`../cities/${cityId}.json`, import.meta.url), "utf8")));
const feed = city.feeds.find((f) => f.id === feedId);
if (!feed) throw new Error(`feed ${feedId} not in ${cityId}: ${city.feeds.map((f) => f.id).join(", ")}`);

const url = feed.type === "open-meteo"
  ? `${feed.url}?latitude=${city.location.lat}&longitude=${city.location.lon}&hourly=precipitation&timezone=${encodeURIComponent(city.timezone)}&forecast_days=2`
  : feed.url;
const res = await fetch(url, { headers: { "User-Agent": "lottoapp-smoke-test" }, signal: AbortSignal.timeout(30000) });
console.log(feed.id, "HTTP", res.status);
if (!res.ok) process.exit(1);

if (feed.type === "open-meteo") {
  const obs = weatherAdapterFor(feed)(await res.json(), feed.id);
  console.log("weather observations:", obs.length, obs.slice(0, 2));
} else {
  const msg = GtfsRt.transit_realtime.FeedMessage.toObject(
    GtfsRt.transit_realtime.FeedMessage.decode(new Uint8Array(await res.arrayBuffer())),
    { longs: Number, defaults: false },
  );
  const adapter = delayAdapterFor(feed);
  const obs = adapter(msg, { feedId: feed.id, timezone: city.timezone, fetchedAt: Math.floor(Date.now() / 1000) });
  const late = obs.filter((o) => o.delaySec > 180).length;
  console.log(`entities=${msg.entity?.length} observations=${obs.length} late>3min=${late}`);
  console.log(obs.slice(0, 2));
}
