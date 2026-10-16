import { useEffect, useRef, useState } from "preact/hooks";
import type { StopRow } from "../../../shared/tripstops.ts";
import { sb } from "./api.ts";
import { every } from "./poll.ts";
import { createTtlCache } from "./ttlCache.ts";

/** How long an answer is kept: a board opened again within this time does not ask the server again. */
export const STOPS_TTL_MS = 30_000;

/** The stops of a question's trip. An empty list means the database knows nothing about the stops of this trip (the board is then hidden). */
const stops = createTtlCache<StopRow[]>(STOPS_TTL_MS, async (marketId) => {
  const { data, error } = await sb.rpc("trip_stops", { p_market: marketId });
  if (error) throw new Error(error.message);
  return (data ?? []) as StopRow[];
});

/**
 * The stops of a question's trip. Asked once when the control appears (to know whether there is anything to show and how many stops),
 * again when the board is opened if that answer is older than 30 seconds, and every 30 seconds while it stays open.
 * `undefined` while the first answer is on its way; an empty list when there is nothing, or when it could not be asked.
 */
export function useTripStops(marketId: string, enabled: boolean, open: boolean): StopRow[] | undefined {
  const [rows, setRows] = useState<StopRow[] | undefined>(() => (enabled ? stops.peek(marketId) : []));
  const gone = useRef(false);
  useEffect(() => { gone.current = false; return () => { gone.current = true; }; }, [marketId]);
  const ask = (force = false) => { stops.get(marketId, force).then((r) => { if (!gone.current) setRows(r); }, () => { if (!gone.current) setRows((old) => old ?? []); }); };
  useEffect(() => { if (enabled) ask(); else setRows([]); }, [marketId, enabled]);
  useEffect(() => {
    if (!enabled || !open) return;
    ask(); // the stored answer if it is fresh, a new one if it is older than the cache keeps
    return every(() => ask(true), STOPS_TTL_MS);
  }, [marketId, enabled, open]);
  return rows;
}
