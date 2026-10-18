// Aircraft over Italy (OpenSky Network): the service does not answer to the cloud's addresses, so this runs on a home computer (scripts/home-cron).
// Every call reads the count once; the questions are created in the first minutes of each hour (the same rule as the hourly part of `ingest`), and the
// reading of the instant 06, 12 or 18 UTC is kept when the call falls within the grace window after it.
import { buildFlightMarkets, CRYPTO_GRACE_SEC } from "../_shared/shared/ticks.ts";
import { db, requireCron, safe } from "../_lib/common.ts";

const H = 3600;

Deno.serve(safe(async (req) => {
  const denied = requireCron(req);
  if (denied) return denied;
  const sb = db();
  const now = Math.floor(Date.now() / 1000);
  let n: number | null = null;
  try {
    const res = await fetch("https://opensky-network.org/api/states/all?lamin=36.4&lomin=6.6&lamax=47.1&lomax=18.6", {
      headers: { "User-Agent": "LateLotto/0.1 (satirical fake-credit game; https://latebet.it)", "Accept-Encoding": "gzip" }, signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    n = Array.isArray(j?.states) ? (j.states as unknown[][]).filter((s) => s[8] === false).length : null;
  } catch (e) {
    const m = String((e as Error).message ?? e).slice(0, 200);
    await sb.from("feed_health").upsert({ feed_id: "opensky", last_error: m, last_error_at: new Date().toISOString() });
    return Response.json({ error: m }, { status: 502 });
  }
  if (n === null) return Response.json({ error: "no states" }, { status: 502 });
  const nowIso = new Date(now * 1000).toISOString(), out: Record<string, unknown> = { aircraft: n };
  await sb.from("feed_health").upsert({ feed_id: "opensky", last_ok_at: nowIso, last_error: null });

  // the history point of the hour (the chart under the question)
  await sb.from("tick_history").upsert([{ series: "flights:it", at: new Date(Math.floor(now / H) * H * 1000).toISOString(), value: n }], { onConflict: "series,at" });

  // the reading that settles the questions of 06, 12 and 18 UTC
  const at = Math.floor(now / H) * H, hourUtc = (at % 86400) / H;
  if ([6, 12, 18].includes(hourUtc) && now - at <= CRYPTO_GRACE_SEC) {
    const { error } = await sb.from("tick_observations").upsert([{ series: "flights:it", at: new Date(at * 1000).toISOString(), value: n, fetched_at: nowIso }], { onConflict: "series,at", ignoreDuplicates: true });
    out.observation = error ? error.message : "kept";
  }

  // new questions, once per hour (the line follows the count, so asking at every call would pile up duplicates)
  if (now % H < 600) {
    const markets = buildFlightMarkets(n, now);
    if (markets.length) {
      const { error } = await sb.from("markets").upsert(markets, { onConflict: "dedupe_key", ignoreDuplicates: true });
      out.markets = error ? error.message : markets.length;
    }
  }
  return Response.json(out);
}));
