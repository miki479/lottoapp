// Makes the ViaggiaTreno (whole Italy) train questions from the Supabase servers, which the service accepts. Port of trainMarkets() in scripts/generate-markets.mjs.
// Called by pg_cron every 3 hours; the real times are then read by `ingest` (one request per train with an open question).
import { buildDelayMarket, localYmd, pickTargetStop, seededRandom } from "../_shared/shared/generator.ts";
import { gtfsDayStart, tzOffsetSec } from "../_shared/shared/time.ts";
import { DEFAULT_YES_PROBABILITY, learnedPrior } from "../_shared/shared/odds.ts";
import { historyKey, marketToEvent } from "../_shared/shared/market.ts";
import { trainTripId } from "../_shared/shared/adapters/viaggiatreno.ts";
import { db, loadCities, requireCron, safe } from "../_lib/common.ts";

const FEED = "it-train-viaggiatreno", CITY = "italia", SLOTS = [0, 4, 8], MAX = 60, DEADLINE_SEC = 90 * 60;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");
const hms = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

Deno.serve(safe(async (req) => {
  const denied = requireCron(req);
  if (denied) return denied;
  const sb = db(), now = Math.floor(Date.now() / 1000);
  const city = (await loadCities()).find((c) => c.id === CITY)!, feed = city.feeds.find((f) => f.id === FEED)!;
  const base = feed.url.replace(/\/$/, ""), stations = feed.stations ?? [];
  const vtDate = (epoch: number) => {
    const off = tzOffsetSec(epoch, city.timezone), d = new Date((epoch + off) * 1000), sign = off < 0 ? "-" : "+", a = Math.abs(off);
    return encodeURIComponent(`${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCDate())} ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} GMT${sign}${pad(Math.floor(a / 3600))}${pad(Math.floor((a % 3600) / 60))}`);
  };
  const vt = async (path: string) => {
    const r = await fetch(`${base}/${path}`, { headers: { "User-Agent": "LateLotto/0.1" }, signal: AbortSignal.timeout(15000) });
    const text = await r.text();
    if (!r.ok || /Access Denied/i.test(text)) throw new Error(`ViaggiaTreno ${path.split("/")[0]}: HTTP ${r.status}`);
    return text.trim() ? JSON.parse(text) : null;
  };
  // Trains that have not left yet, from the boards over the next hours (a few boards at a time).
  const candidates = new Map<string, Record<string, any>>();
  let firstError = "", failed = 0;
  const jobs = stations.flatMap((st) => SLOTS.map((h) => `partenze/${st}/${vtDate(now + h * 3600)}`));
  for (let i = 0; i < jobs.length; i += 6) {
    const boards = await Promise.all(jobs.slice(i, i + 6).map((p) => vt(p).catch((e) => { failed++; firstError ||= String(e.message ?? e); return null; })));
    for (const board of boards) for (const x of board ?? []) {
      if (!x.nonPartito || !x.numeroTreno || !x.dataPartenzaTreno || !x.codOrigine) continue;
      candidates.set(trainTripId(x.codOrigine, x.numeroTreno, x.dataPartenzaTreno), x);
    }
  }
  const { ymd } = localYmd(now, city.timezone);
  const rand = seededRandom(`${city.id}-${feed.id}-${ymd}-${Math.floor(now / 21600)}`);
  const mixed = [...candidates.entries()].map((e) => [rand(), e] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  // one question in three goes to a fast train, so Frecciarossa / Intercity are not drowned by the regionals
  const isFast = ([, x]: [string, Record<string, any>]) => ["FR", "FA", "FB", "IC", "ICN", "EC"].includes(String(x.categoriaDescrizione || "").trim().toUpperCase());
  const fast = mixed.filter(isFast), slow = mixed.filter((e) => !isFast(e)), shuffled: [string, Record<string, any>][] = [];
  while ((fast.length || slow.length) && shuffled.length < MAX * 3) {
    if (fast.length) shuffled.push(fast.shift()!);
    for (let k = 0; k < 2 && slow.length; k++) shuffled.push(slow.shift()!);
    if (!fast.length) while (slow.length && shuffled.length < MAX * 3) shuffled.push(slow.shift()!);
  }

  // odds: country-wide learned chance of "late" and the history of the hour
  const base0p = DEFAULT_YES_PROBABILITY.train_delay_gt;
  const { data: settled } = await sb.from("markets").select("outcome").eq("category", "train").eq("kind", "train_delay_gt").eq("status", "resolved").is("params->>ladderOf", null).eq("city_id", CITY).limit(1000);
  const priorYes = settled && settled.length ? learnedPrior(settled.filter((r) => r.outcome === "yes").length, settled.length, base0p) : base0p;
  const { data: hrows } = await sb.from("odds_history").select("kind,route_id,hour_of_day,threshold,n,yes").eq("city_id", CITY);
  const hmap = new Map((hrows ?? []).map((r) => [`${r.kind}|${r.route_id}|${r.hour_of_day}|${r.threshold}`, { n: r.n as number, yes: r.yes as number }]));
  const hist = (k: { kind: string; routeId: string; hourOfDay: number; threshold: number }) => hmap.get(`${k.kind}|${k.routeId}|${k.hourOfDay}|${k.threshold}`) ?? null;

  const markets: Record<string, unknown>[] = [], schedule: Record<string, unknown>[] = [];
  const sd = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
  for (let i = 0; i < shuffled.length && markets.length < MAX; i += 6) {
    const batch = shuffled.slice(i, i + 6);
    const details = await Promise.all(batch.map(([, x]) => vt(`andamentoTreno/${x.codOrigine}/${x.numeroTreno}/${x.dataPartenzaTreno}`).catch(() => null)));
    batch.forEach(([tripId, x], j) => {
      const t = details[j];
      if (markets.length >= MAX || !t?.fermate || t.provvedimento === 1) return; // unknown or cancelled
      const dayEpoch = Math.floor(x.dataPartenzaTreno / 1000), base0 = gtfsDayStart(dayEpoch, city.timezone);
      const names = new Map<string, string>(t.fermate.map((f: any) => [f.id, f.stazione]));
      const stops = t.fermate
        .filter((f: any) => f.id && f.programmata && f.progressivo != null && f.programmata / 1000 > now + 900)
        .map((f: any) => ({ seq: f.progressivo, stopId: f.id, time: hms(Math.floor(f.programmata / 1000) - base0), timepoint: true }))
        .filter((s: any) => !s.time.startsWith("-"))
        .sort((a: any, b: any) => a.seq - b.seq);
      const stop = pickTargetStop(stops, rand);
      if (!stop) return;
      const common = { cityId: city.id, tz: city.timezone, feedId: feed.id, category: "train" as const, routeId: String(t.categoria || x.categoriaDescrizione || "").trim() || "train", routeName: `${String(x.categoriaDescrizione || "").trim()} ${x.numeroTreno}`.trim(), headsign: x.destinazione ?? "", tripId, stop, stopName: names.get(stop.stopId) ?? stop.stopId, serviceDayEpoch: dayEpoch, thresholdSec: 300 };
      const draft = buildDelayMarket({ ...common, history: null, priorYes });
      const targetAt = Date.parse(draft.target_at) / 1000;
      if (Date.parse(draft.closes_at) / 1000 <= now + 300 || targetAt > now + 30 * 3600) return;
      const priced = buildDelayMarket({ ...common, history: hist(historyKey(marketToEvent({ ...draft, id: "x" } as never), city.timezone)), priorYes });
      markets.push({ ...priced, params: { ...priced.params }, deadline_at: new Date((targetAt + DEADLINE_SEC) * 1000).toISOString() });
      // every stop of the train for the "Show stops" board
      for (const f of t.fermate) {
        if (!f.id || f.progressivo == null || !f.programmata) continue;
        const secs = Math.floor(f.programmata / 1000) - base0;
        if (secs < 0) continue;
        schedule.push({ feed_id: feed.id, trip_id: tripId, stop_sequence: f.progressivo, stop_id: f.id, scheduled_time: hms(secs), service_date: sd, stop_name: String(f.stazione ?? "").slice(0, 120) || null });
      }
    });
  }
  for (let i = 0; i < schedule.length; i += 500) {
    const { error } = await sb.from("trip_schedule").upsert(schedule.slice(i, i + 500), { onConflict: "feed_id,trip_id,stop_sequence" });
    if (error) throw new Error(`trip_schedule: ${error.message}`);
  }
  const keyed = markets.map((m: any) => ({ ...m, dedupe_key: [m.city_id, m.kind, m.feed_id, m.params.tripId ?? "", m.params.stopId ?? "", Math.floor(Date.parse(m.target_at) / 1000)].join("|") }));
  if (keyed.length) {
    const { error } = await sb.from("markets").upsert(keyed, { onConflict: "dedupe_key", ignoreDuplicates: true });
    if (error) throw new Error(`markets: ${error.message}`);
  }
  return Response.json({ firstError, failed, boards: jobs.length, trains: candidates.size, markets: keyed.length, schedule: schedule.length });
}));
