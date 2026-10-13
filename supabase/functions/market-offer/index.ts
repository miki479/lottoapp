// A player creates a question from a fixed template (weather metric at a place, coin price, game players, page views).
// Nothing free-form is accepted: every parameter is checked against a list or a range, the question is priced from the
// current reference value and refused when the answer would be too certain. Resolution uses the same public feeds as the house markets.
import { tvEpisode, tvReference } from "../_lib/tv.ts";
import { FAIR_MAX, FAIR_MIN, CRYPTO, WIKI_ARTICLES, buildCustomTick, buildTvMarket, isCrypto, isSteam, tickChance, tickStep } from "../_shared/shared/ticks.ts";
import { computeOdds } from "../_shared/shared/odds.ts";
import { ALL_BETS, DETAIL_LEAGUES, LEAGUES, isDetailBet, isPlayerBet, isTwoBet, twoWayPriors, leagueAverage, matchMarket, matchPriors, playerBetId, playerChance, playerMarket, type LineupPlayer, type MatchBet, type PlayerBet } from "../_shared/shared/sport.ts";
import { METRICS, METRIC_IDS, metricOdds, normalCdf, type MetricId } from "../_shared/shared/metrics.ts";
import { addDays, localDateString, zonedEpoch } from "../_shared/shared/time.ts";
import { db, loadCities, safe } from "../_lib/common.ts";
import { detailsAvailable, fetchLineup, loadTable } from "../_lib/football.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const UA = { "User-Agent": "LateLotto/0.1 (satirical fake-credit game; https://latelotto.web.app)" };
const PER_USER_PER_DAY = 10, PER_USER_OPEN = 6, MAX_OPEN_CUSTOM = 500;


/** Expected goals of each side, nudged by how likely each is to win (a plain estimate from the 1X2 chances). */
const teamGoals = (priors: Record<string, number> | undefined, side: "home" | "away") => {
  const ph = priors?.home_win ?? 0.4, pa = priors?.away_win ?? 0.3;
  return Math.min(2.4, Math.max(0.7, 1.35 + (side === "home" ? ph - pa : pa - ph) * 0.9));
};

async function getJson(url: string) { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15_000) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json(); }

/** Reference value "now" for a tick series; null when the source cannot be read. */
async function tickReference(series: string): Promise<number | null> {
  try {
    if (isCrypto(series)) { const j = await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${CRYPTO[series].id}&vs_currencies=usd&precision=2`); const v = j?.[CRYPTO[series].id]?.usd; return typeof v === "number" ? v : null; }
    if (isSteam(series)) { const j = await getJson(`https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${series.slice(6)}`); const v = j?.response?.player_count; return typeof v === "number" ? v : null; }
    if (series.startsWith("wiki:")) {
      const day = (e: number) => new Date(e * 1000).toISOString().slice(0, 10).replace(/-/g, ""), now = Math.floor(Date.now() / 1000);
      const j = await getJson(`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/${encodeURIComponent(series.slice(5))}/daily/${day(now - 8 * 86400)}/${day(now - 86400)}`);
      const v = ((j?.items ?? []) as { views: number }[]).map((i) => i.views);
      return v.length >= 5 ? v.reduce((a, c) => a + c, 0) / v.length : null;
    }
  } catch { /* fall through */ }
  return null;
}

Deno.serve(safe(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const sb = db();
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await sb.auth.getUser(token);
  const uid = u?.user?.id;
  if (!uid) return json({ error: "not_authenticated" }, 401);
  if (u?.user?.is_anonymous) return json({ error: "registration_required" }, 403);
  const b = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!b) return json({ error: "bad_request" }, 400);
  const now = Math.floor(Date.now() / 1000);
  const preview = b.preview === true;

  if (!preview) {
    const day = await sb.from("markets").select("id", { count: "exact", head: true }).eq("created_by", uid).gt("created_at", new Date((now - 86400) * 1000).toISOString());
    if ((day.count ?? 0) >= PER_USER_PER_DAY) return json({ error: "limit" }, 429);
    const open = await sb.from("markets").select("id", { count: "exact", head: true }).eq("created_by", uid).eq("status", "open");
    if ((open.count ?? 0) >= PER_USER_OPEN) return json({ error: "too_many_open" }, 429);
    const all = await sb.from("markets").select("id", { count: "exact", head: true }).eq("status", "open").eq("params->>custom", "true");
    if ((all.count ?? 0) >= MAX_OPEN_CUSTOM) return json({ error: "full" }, 429);
  }
  const { data: prof } = await sb.from("profiles").select("display_name").eq("id", uid).maybeSingle();
  const by = (prof?.display_name as string | null) ?? null;
  const iso = (e: number) => new Date(e * 1000).toISOString();
  let draft: Record<string, unknown>;

  if (b.type === "metric") {
    const metric = String(b.metric) as MetricId, placeId = String(b.placeId ?? ""), dayOffset = Number(b.dayOffset), hour = Number(b.hour), threshold = Number(b.threshold);
    if (!METRIC_IDS.includes(metric) || !Number.isFinite(threshold) || ![0, 1].includes(dayOffset) || !Number.isInteger(hour) || hour < 6 || hour > 23) return json({ error: "bad_request" }, 400);
    // where: a house city with weather, or a place a player has opened (both are read by the hourly weather job)
    const city = (await loadCities()).find((c) => c.id === placeId && c.categories.weather?.enabled && c.location);
    let loc: { lat: number; lon: number; tz: string } | null = city ? { lat: city.location!.lat, lon: city.location!.lon, tz: city.timezone } : null;
    if (!loc && placeId.startsWith("p-")) {
      const { data: pl } = await sb.from("places").select("lat,lon,timezone").eq("id", placeId).maybeSingle();
      if (pl) { loc = { lat: Number(pl.lat), lon: Number(pl.lon), tz: pl.timezone as string }; if (!preview) await sb.from("places").update({ last_used_at: iso(now) }).eq("id", placeId); }
    }
    if (!loc) return json({ error: "bad_place" }, 400);
    const targetAt = zonedEpoch(addDays(localDateString(now, loc.tz), dayOffset), hour * 3600 + 1800, loc.tz);
    if (targetAt - 600 < now + 35 * 60 || targetAt > now + 48 * 3600) return json({ error: "bad_time" }, 400);
    const def = METRICS[metric];
    let forecast: number | undefined;
    try {
      const base = def.source === "air" ? "https://air-quality-api.open-meteo.com/v1/air-quality" : "https://api.open-meteo.com/v1/forecast";
      const j = await getJson(`${base}?${new URLSearchParams({ latitude: String(loc.lat), longitude: String(loc.lon), hourly: def.api, timezone: "GMT", forecast_days: "3" })}`);
      const t0 = Math.floor(targetAt / 3600) * 3600, i = ((j?.hourly?.time ?? []) as string[]).findIndex((x) => Date.parse(`${x}:00Z`) / 1000 === t0);
      const v = i >= 0 ? j.hourly[def.api][i] : null;
      if (typeof v === "number") forecast = v;
    } catch { /* below */ }
    if (forecast === undefined) return json({ error: "source_unavailable" }, 503);
    const hail = metric === "hail";
    const thr = hail ? 1 : Math.round(threshold / def.step) * def.step;
    // hail comes from the model's weather code (96/99 = thunderstorm with hail): chance by how close the forecast is to it
    const hailChance = forecast >= 96 ? 0.6 : forecast >= 95 ? 0.3 : forecast >= 80 ? 0.1 : 0.03;
    const chance = hail ? hailChance : Math.round((1 - normalCdf((thr - forecast) / def.sigma)) * 100) / 100;
    const info = { forecast, step: def.step, unit: def.unit, chance };
    if (!(thr >= (metric === "temp" ? -90 : 0) && thr <= (hail ? 1 : def.max)) || chance < FAIR_MIN || chance > FAIR_MAX) return json({ error: "too_certain", ...info }, 422);
    const odds = hail ? computeOdds(chance) : metricOdds(metric, forecast, thr);
    if (preview) return json({ preview: { ...info, odds_yes: odds.yes, odds_no: odds.no, threshold: thr } });
    draft = {
      city_id: placeId, category: "weather", kind: "metric_gt", feed_id: `om-${placeId}`,
      params: { metric, threshold: Math.round(thr * 10) / 10, unit: def.unit, localHour: hour, forecast: Math.round(forecast * 10) / 10, custom: "true", by },
      closes_at: iso(targetAt - 600), target_at: iso(targetAt), deadline_at: iso(Math.floor(targetAt / 3600) * 3600 + 3600 + 5 * 3600),
      odds_yes: odds.yes, odds_no: odds.no, dedupe_key: `c|${placeId}|metric_${metric}|${targetAt}|${thr}`,
      lat: Math.round(loc.lat * 1e5) / 1e5, lon: Math.round(loc.lon * 1e5) / 1e5,
    };
  } else if (b.type === "tick") {
    const series = String(b.series ?? ""), threshold = Number(b.threshold), at = Number(b.at);
    const known = isCrypto(series) || isSteam(series) || (series.startsWith("wiki:") && (WIKI_ARTICLES as readonly string[]).includes(series.slice(5)));
    if (!known || !Number.isFinite(threshold) || !Number.isFinite(at)) return json({ error: "bad_request" }, 400);
    const wiki = series.startsWith("wiki:");
    const target = wiki ? Math.round(at / 86400) * 86400 : Math.round(at / 300) * 300;
    if (wiki ? (target < now + 13 * 3600 || target > now + 3 * 86400) : (target < now + 40 * 60 || target > now + 72 * 3600)) return json({ error: "bad_time" }, 400);
    let ref = await tickReference(series);
    if (ref === null) {
      // the live source is rate-limited or down: fall back to the last hourly reading kept for the charts, if it is recent
      const key = isCrypto(series) ? `px:${series}` : series;
      const { data: last } = await sb.from("tick_history").select("value,at").eq("series", key).order("at", { ascending: false }).limit(1).maybeSingle();
      if (last && Date.parse(last.at as string) > Date.now() - 3 * 3600_000 && !series.startsWith("wiki:")) ref = Number(last.value);
    }
    if (ref === null) return json({ error: "source_unavailable" }, 503);
    const step = tickStep(series, ref), thr = Math.round(threshold / step) * step;
    const chance = Math.round(tickChance(series, ref, thr, Math.max(0.6, (target - now) / 3600), now) * 100) / 100;
    const info = { reference: ref, step, chance };
    if (thr <= 0 || chance < FAIR_MIN || chance > FAIR_MAX) return json({ error: "too_certain", ...info }, 422);
    const m = buildCustomTick(series, ref, thr, target, now);
    if (preview) return json({ preview: { ...info, odds_yes: m.odds_yes, odds_no: m.odds_no, threshold: thr } });
    draft = { ...m, params: { ...m.params, custom: "true", by }, dedupe_key: `c|${series}|${target}|${thr}` };
  } else if (b.type === "episode") {
    // A bet on the TVmaze rating of one episode, three days after it airs (the show and the episode are checked at the source).
    const episodeId = Number(b.episodeId), threshold = Math.round(Number(b.threshold) * 10) / 10;
    if (!Number.isInteger(episodeId) || episodeId <= 0 || !(threshold > 0 && threshold <= 10)) return json({ error: "bad_request" }, 400);
    const info = await tvEpisode(episodeId);
    if (!info || !info.episode.airstamp) return json({ error: "unknown_episode" }, 404);
    const air = Date.parse(info.episode.airstamp) / 1000;
    if (air < now - 2 * 86400 || air > now + 21 * 86400) return json({ error: "bad_time" }, 400);
    const ref = await tvReference(info.showId, info.episode.airstamp);
    if (ref === null) return json({ error: "source_unavailable" }, 503);
    const chance = Math.round(tickChance(`tv:${episodeId}`, ref, threshold, 72) * 100) / 100, res = { reference: Math.round(ref * 100) / 100, step: 0.1, chance };
    if (chance < FAIR_MIN || chance > FAIR_MAX) return json({ error: "too_certain", ...res }, 422);
    const m = buildTvMarket({ showId: info.showId, showName: info.showName, episodeId, season: info.episode.season, number: info.episode.number, airstamp: air, reference: ref, threshold, now });
    if (preview) return json({ preview: { ...res, odds_yes: m.odds_yes, odds_no: m.odds_no, threshold } });
    draft = { ...m, params: { ...m.params, custom: "true", by } };
  } else if (b.type === "lineup") {
    // The starting elevens of a match with what each player bet would pay (read once, kept; lineups appear about an hour before kick-off).
    const eventId = String(b.eventId ?? "");
    if (!/^\d{3,12}$/.test(eventId)) return json({ error: "bad_request" }, 400);
    const { data: sib } = await sb.from("markets").select("params").eq("kind", "match_bet").eq("params->>eventId", eventId).limit(1).maybeSingle();
    if (!sib) return json({ error: "unknown_match" }, 404);
    const sp = sib.params as { league: string; kickoff: number; apiId?: string; priors?: Record<string, number> };
    if (!DETAIL_LEAGUES.includes(sp.league) || !sp.apiId || !(await detailsAvailable(sb))) return json({ error: "details_unavailable" }, 503);
    if (!(sp.kickoff >= now + 35 * 60)) return json({ error: "bad_time" }, 400);
    let { data: row } = await sb.from("match_lineups").select("players,fetched_at,attempted_at").eq("event_id", eventId).maybeSingle();
    if (!row?.fetched_at && sp.kickoff - now < 3 * 3600 && (!row?.attempted_at || Date.now() - Date.parse(row.attempted_at as string) > 5 * 60_000)) {
      const r = await fetchLineup(sp.apiId);
      const ok = r.players.length >= 18;
      await sb.from("match_lineups").upsert({ event_id: eventId, api_id: sp.apiId, kickoff: new Date(sp.kickoff * 1000).toISOString(), players: ok ? r.players : [], attempted_at: new Date().toISOString(), fetched_at: ok ? new Date().toISOString() : null }, { onConflict: "event_id" });
      row = { players: ok ? r.players : [], fetched_at: ok ? new Date().toISOString() : null, attempted_at: new Date().toISOString() };
    }
    const odds = (kind: "pg" | "pa" | "ps", pl: LineupPlayer) => { const c = playerChance(kind, pl.pos, teamGoals(sp.priors, pl.side)); if (c === null || c < FAIR_MIN || c > FAIR_MAX) return null; const o = computeOdds(c); return { yes: o.yes, no: o.no }; };
    const players = ((row?.fetched_at ? row.players : []) as LineupPlayer[]).map((pl) => ({ ...pl, pg: odds("pg", pl), pa: odds("pa", pl), ps: odds("ps", pl) })).filter((pl) => pl.pg || pl.pa || pl.ps);
    return json({ players, ready: players.length > 0 });
  } else if (b.type === "match") {
    const eventId = String(b.eventId ?? ""), bet = String(b.bet) as MatchBet;
    if (isPlayerBet(bet)) {
      if (!/^\d{3,12}$/.test(eventId)) return json({ error: "bad_request" }, 400);
      const { data: sib } = await sb.from("markets").select("params,lat,lon").eq("kind", "match_bet").eq("params->>eventId", eventId).limit(1).maybeSingle();
      if (!sib) return json({ error: "unknown_match" }, 404);
      const sp = sib.params as { league: string; home: string; away: string; kickoff: number; priors: Record<MatchBet, number>; apiId?: string; homeBadge?: string; awayBadge?: string };
      if (!(sp.kickoff >= now + 35 * 60)) return json({ error: "bad_time" }, 400);
      if (!DETAIL_LEAGUES.includes(sp.league) || !sp.apiId || !(await detailsAvailable(sb))) return json({ error: "details_unavailable" }, 503);
      const { data: row } = await sb.from("match_lineups").select("players,fetched_at").eq("event_id", eventId).maybeSingle();
      const player = row?.fetched_at ? ((row.players ?? []) as LineupPlayer[]).find((x) => x.id === playerBetId(bet)) : undefined;
      if (!player) return json({ error: "unknown_player" }, 404);
      const kind = bet.slice(0, 2) as "pg" | "pa" | "ps", chance = playerChance(kind, player.pos, teamGoals(sp.priors, player.side));
      if (chance === null || chance < FAIR_MIN || chance > FAIR_MAX) return json({ error: "too_certain", chance }, 422);
      const m = playerMarket({ eventId, league: sp.league, home: sp.home, away: sp.away, kickoff: sp.kickoff, apiId: sp.apiId, homeBadge: sp.homeBadge, awayBadge: sp.awayBadge }, bet as PlayerBet, player, chance, sp.priors, sib.lat === null ? undefined : { lat: Number(sib.lat), lon: Number(sib.lon) }, { by });
      if (preview) return json({ preview: { chance, odds_yes: m.odds_yes, odds_no: m.odds_no, threshold: 0 } });
      draft = m as unknown as Record<string, unknown>;
    } else {
    const twoBet = isTwoBet(bet);
    if (!((ALL_BETS as string[]).includes(bet) || twoBet) || !/^\d{3,12}$/.test(eventId)) return json({ error: "bad_request" }, 400);
    // the match must already be known (house markets are made for every upcoming round); the same bet is never made twice
    const { data: sib } = await sb.from("markets").select("params,lat,lon").eq("kind", "match_bet").eq("params->>eventId", eventId).limit(1).maybeSingle();
    if (!sib) return json({ error: "unknown_match" }, 404);
    const sp = sib.params as { league: string; home: string; away: string; kickoff: number; priors: Record<MatchBet, number>; apiId?: string; testOnly?: boolean; homeBadge?: string; awayBadge?: string };
    if (!(sp.kickoff >= now + 35 * 60)) return json({ error: "bad_time" }, 400);
    // half-time, corners and cards are settled from a second source: only offered where it works right now, and only for the leagues it covers
    let apiId = sp.apiId;
    if (isDetailBet(bet)) {
      if (!DETAIL_LEAGUES.includes(sp.league) || !(await detailsAvailable(sb))) return json({ error: "details_unavailable" }, 503);
      if (!apiId) { try { apiId = String((await getJson(`https://www.thesportsdb.com/api/v1/json/${Deno.env.get("SPORTSDB_KEY") || "3"}/lookupevent.php?id=${eventId}`))?.events?.[0]?.idAPIfootball ?? "") || undefined; } catch { /* below */ } }
      if (!apiId) return json({ error: "details_unavailable" }, 503);
    }
    // older markets were made before these bets existed: price them from the same strengths
    const two = LEAGUES.find((l) => l.name === sp.league)?.two;
    if (twoBet && !two) return json({ error: "bad_request" }, 400);
    // a sport without draws only has the winner, the total points and the handicap: the football bets would be a sure thing there
    if (two && !twoBet && bet !== "home_win" && bet !== "away_win") return json({ error: "bad_request" }, 400);
    let priors = sp.priors ?? ({} as Record<MatchBet, number>);
    if (typeof priors[bet] !== "number") {
      const table = await loadTable(sb, sp.league), by = new Map(table.map((r) => [r.team, r]));
      priors = two ? { ...twoWayPriors(by.get(sp.home), by.get(sp.away), two), ...priors } : matchPriors(by.get(sp.home), by.get(sp.away), leagueAverage(table), sp.league === "Serie A");
    }
    const chance = priors[bet];
    if (typeof chance !== "number" || chance < FAIR_MIN || chance > FAIR_MAX) return json({ error: "too_certain", chance }, 422);
    const m = matchMarket({ eventId, league: sp.league, home: sp.home, away: sp.away, kickoff: sp.kickoff, ...(two ? { lenSec: two.lenSec } : {}), ...(apiId ? { apiId } : {}), ...(sp.homeBadge ? { homeBadge: sp.homeBadge } : {}), ...(sp.awayBadge ? { awayBadge: sp.awayBadge } : {}) }, bet, priors, sib.lat === null ? undefined : { lat: Number(sib.lat), lon: Number(sib.lon) }, !!sp.testOnly, { by });
    if (preview) return json({ preview: { chance, odds_yes: m.odds_yes, odds_no: m.odds_no, threshold: 0 } });
    draft = m as unknown as Record<string, unknown>;
    }
  } else return json({ error: "bad_request" }, 400);

  const have = await sb.from("markets").select("*").eq("dedupe_key", draft.dedupe_key as string).maybeSingle();
  if (have.data) return json({ market: have.data, existing: true });
  const { data: m, error } = await sb.from("markets").insert({ ...draft, created_by: uid }).select("*").single();
  if (error) return json({ error: error.message }, 500);
  return json({ market: m });
}));
