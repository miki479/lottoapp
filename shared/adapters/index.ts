import type { FeedConfig } from "../cities.ts";
import { tripUpdatesAdapter, vehiclePositionsAdapter } from "./gtfsrt.ts";
import { openMeteoAdapter } from "./openmeteo.ts";
import type { DelayAdapter, WeatherAdapter } from "./types.ts";

/** Registry: new feed formats are added here, cities only reference them by `type`/`kind`. */
export function delayAdapterFor(feed: FeedConfig): DelayAdapter | null {
  if (feed.type === "gtfs-rt" && feed.kind === "vehicle_positions") return vehiclePositionsAdapter;
  if (feed.type === "gtfs-rt" && feed.kind === "trip_updates") return tripUpdatesAdapter;
  return null;
}

export function weatherAdapterFor(feed: FeedConfig): WeatherAdapter | null {
  return feed.type === "open-meteo" ? openMeteoAdapter : null;
}
