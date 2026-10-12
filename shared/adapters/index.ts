import type { FeedConfig } from "../cities.ts";
import { tripUpdatesAdapter, tripUpdatesTimesAdapter, vehiclePositionsAdapter } from "./gtfsrt.ts";
import { openMeteoAdapter } from "./openmeteo.ts";
import { viaggiatrenoAdapter } from "./viaggiatreno.ts";
import type { DelayAdapter, TrainJsonAdapter, WeatherAdapter } from "./types.ts";

/** Registry: new feed formats are added here, cities only reference them by `type`/`kind`. */
export function delayAdapterFor(feed: FeedConfig): DelayAdapter | null {
  if (feed.type === "gtfs-rt" && feed.kind === "vehicle_positions") return vehiclePositionsAdapter;
  if (feed.type === "gtfs-rt" && feed.kind === "trip_updates") return tripUpdatesAdapter;
  if (feed.type === "gtfs-rt" && feed.kind === "trip_updates_times") return tripUpdatesTimesAdapter;
  return null;
}

export function weatherAdapterFor(feed: FeedConfig): WeatherAdapter | null {
  return feed.type === "open-meteo" ? openMeteoAdapter : null;
}

export function trainJsonAdapterFor(feed: FeedConfig): TrainJsonAdapter | null {
  return feed.type === "viaggiatreno" ? viaggiatrenoAdapter : null;
}
