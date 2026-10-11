import { Clock, MapPin, TrendingUp, Users, Zap } from "lucide-preact";
import { RING_BONUS, STREAK_MILESTONES } from "../../shared/rewards.ts";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { AuthSheet } from "./components/AuthSheet.tsx";
import { BetSheet } from "./components/BetSheet.tsx";
import type { CatId } from "./components/CatChips.tsx";
import { DelayMeter } from "./components/DelayMeter.tsx";
import { OfflineBar } from "./components/OfflineBar.tsx";
import { Ticker } from "./components/Ticker.tsx";
import { ParlayBar } from "./components/ParlayBar.tsx";
import { ParlaySheet, slipOdds } from "./components/ParlaySheet.tsx";
import { Header } from "./components/Header.tsx";
import { CROWD_SOURCE } from "./lib/crowding.ts";
import { Sidebar, TabBar, type Screen } from "./components/Nav.tsx";
import { NicknameSheet } from "./components/NicknameSheet.tsx";
import { ResultScreen } from "./components/ResultScreen.tsx";
import { Toast } from "./components/Toast.tsx";
import type { TopItem } from "./components/TopCards.tsx";
import { INTL_TAG, t, TROPHY_IDS, type Locale } from "./i18n/index.ts";
import { useCountUp } from "./lib/anim.ts";
import { ensureGuest, guestState, sb } from "./lib/api.ts";
import { CITIES, cityInfos, cityName, cityOf } from "./lib/cities.ts";
import { useNow } from "./lib/clock.ts";
import { pickCity, pickLocale } from "./lib/detect.ts";
import { countdown, currencySymbol, dayIn, isYesNo, money, question, type MarketRow } from "./lib/format.ts";
import { haptic } from "./lib/haptics.ts";
import { NearYou, type NearState } from "./components/NearYou.tsx";
import { PlacePicker } from "./components/PlacePicker.tsx";
import { FAMOUS_PLACES, FEATURED_CITY_IDS, FEATURED_PLACES, ITALY_CAPITALS, ensurePlace, km, placeById, placeIdOf, recentPlaces, rememberPlace, type Place } from "./lib/places.ts";
import { RewardsSheet } from "./components/RewardsSheet.tsx";
import { PushAsk } from "./components/PushAsk.tsx";
import { disablePush, enablePush, pushAsked, pushAvailable, pushDenied, pushEnabled, rememberPush } from "./lib/push.ts";
import { announce, setVoice, voiceEnabled, voiceSupported } from "./lib/voice.ts";
import { makeProfileCard, makeResultCard, shareImage } from "./lib/share.ts";
import type { QuestRow, ActivityRow, ParlayRow, SlipLeg, LiveDelay, MyBet, MyStats, Pick, PopularRow, Profile, Progress, ResultRow } from "./lib/types.ts";
import { Bets } from "./views/Bets.tsx";
import { Home, type Trend } from "./views/Home.tsx";
import { ProfileView } from "./views/Profile.tsx";
import { Ranking } from "./views/Ranking.tsx";

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const region = () => { try { return new Intl.Locale(navigator.language).maximize().region ?? null; } catch { return null; } };
const PROFILE_COLS = "id,credits,city_id,locale,timezone,country,streak,best_streak,freezes,boosts,push_flash,push_streak,display_name,last_play_date";
const BET_COLS = "id,pick,stake,odds,status,payout,markets(id,city_id,category,kind,params,closes_at,target_at,odds_yes,odds_no,status,void_reason,outcome,evidence)";

export function App() {
  const now = useNow();
  const [locale, setLocale] = useState<Locale>(() => (store.get("locale") as Locale) || pickLocale(navigator.languages ?? [navigator.language]));
  const [filter, setFilter] = useState<string>(() => store.get("filter") || "world");
  const [cat, setCat] = useState<CatId>("bus");
  const [catChosen, setCatChosen] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  const [markets, setMarkets] = useState<MarketRow[] | null>(null);
  const [live, setLive] = useState<Record<string, LiveDelay>>({});
  const [popular, setPopular] = useState<PopularRow[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [bets, setBets] = useState<MyBet[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [trophies, setTrophies] = useState<Set<string>>(new Set());
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const [ready, setReady] = useState(false);
  const [sheet, setSheet] = useState<{ m: MarketRow; pick: Pick } | null>(null);
  const [auth, setAuth] = useState(false);
  const [nick, setNick] = useState(false);
  const [googleOn, setGoogleOn] = useState(false);
  const [resultBet, setResultBet] = useState<MyBet | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const [stale, setStale] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [rank, setRank] = useState<{ rank: number | null; scope: string }>({ rank: null, scope: "" });
  const [myPlaces, setMyPlaces] = useState<Place[]>(() => recentPlaces());
  const [, setPlacePending] = useState<Place | null>(null);
  const [placePicker, setPlacePicker] = useState(false);
  const placeIds = useRef<string[]>(myPlaces.map((p) => p.id));
  const [near, setNear] = useState<NearState | null>(() => { try { return JSON.parse(store.get("near") ?? "null"); } catch { return null; } });
  const [nearRows, setNearRows] = useState<{ market_id: string; bets: number }[]>([]);
  const [locating, setLocating] = useState(false);
  const [trending, setTrending] = useState<Trend[]>([]);
  const [outlook, setOutlook] = useState<Record<string, number>>({});
  const [giftDot, setGiftDot] = useState(() => store.get("giftdot") === "1");
  const [giftCard, setGiftCard] = useState(() => store.get("giftcard") === "1");
  const [quests, setQuests] = useState<QuestRow[]>([]);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [askPush, setAskPush] = useState(false);
  const [slip, setSlip] = useState<SlipLeg[]>([]);
  const [parlayOpen, setParlayOpen] = useState(false);
  const [parlays, setParlays] = useState<ParlayRow[]>([]);
  const [needSignup, setNeedSignup] = useState(false);
  const [referral, setReferral] = useState<{ code: string; invited: number; paid: number } | null>(null);
  const [voiceOn, setVoiceOn] = useState(voiceEnabled());
  const [installEvt, setInstallEvt] = useState<Event | null>(null);

  const msg = t(locale);
  const tz = profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const wallet = useCountUp(profile?.credits ?? 0, 600);
  const flash = (text: string, kind: "ok" | "err" = "ok") => { setToast({ text, kind }); setTimeout(() => setToast(null), 3600); };
  const seenKey = `seen.${profile?.id ?? "x"}`;

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true), bip = (e: Event) => { e.preventDefault(); setInstallEvt(e); };
    addEventListener("online", on); addEventListener("offline", off); addEventListener("beforeinstallprompt", bip);
    return () => { removeEventListener("online", on); removeEventListener("offline", off); removeEventListener("beforeinstallprompt", bip); };
  }, []);

  // ---------- data loading ----------
  const loadProfile = useCallback(async () => { const { data } = await sb.from("profiles").select(PROFILE_COLS).maybeSingle(); if (data) setProfile(data as Profile); return data as Profile | null; }, []);
  const loadProgress = useCallback(async (zone = tz) => {
    const { data } = await sb.from("daily_progress").select("day,bus,train,weather,traffic,bonus_claimed").order("day", { ascending: false }).limit(1).maybeSingle();
    const p = data && data.day === dayIn(zone) ? (data as Progress) : null; setProgress(p); return p;
  }, [tz]);
  const loadTrophies = useCallback(async () => { const { data } = await sb.from("trophies").select("trophy_id"); const s = new Set((data ?? []).map((r) => r.trophy_id as string)); setTrophies(s); return s; }, []);
  const loadBets = useCallback(async () => { const { data } = await sb.from("bets").select(BET_COLS).order("placed_at", { ascending: false }).limit(60); setBets((data ?? []) as unknown as MyBet[]); }, []);

  const loadParlays = useCallback(async () => { const { data } = await sb.from("parlays").select("id,stake,odds,status,payout,placed_at,settled_at,parlay_legs(market_id,pick,odds,status,markets(city_id,kind,params))").order("placed_at", { ascending: false }).limit(40); setParlays((data ?? []) as unknown as ParlayRow[]); }, []);
  const loadQuests = useCallback(async () => { const { data } = await sb.rpc("my_quests"); setQuests(((data ?? []) as QuestRow[]).map((q) => ({ ...q, reward: +q.reward }))); }, []);
  const loadReferral = useCallback(async () => {
    const { data } = await sb.rpc("my_referral"); const r = (data as { code: string; invited: number; paid: number }[] | null)?.[0];
    if (r) setReferral({ code: r.code, invited: +r.invited, paid: +r.paid });
  }, []);

  /** Guest session + wallet. Runs at start and again after signing in or out. */
  const bootstrap = useCallback(async () => {
    const uid = await ensureGuest(); if (!uid) return;
    const prefer = store.get("city") || pickCity(cityInfos(), { country: region(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, locale });
    await sb.rpc("ensure_profile", { p_city: prefer, p_locale: locale, p_country: region() });
    await sb.rpc("claim_daily_refill");
    const p = await loadProfile(); setSeen(new Set(JSON.parse(store.get(`seen.${uid}`) ?? "[]")));
    await Promise.all([loadTrophies(), loadBets(), loadParlays(), loadQuests(), loadProgress(p?.timezone)]);
    // Invite link: remember ?ref=CODE and redeem it as soon as the player has a registered account.
    // Sign-in providers report problems back in the URL (query or hash): show them instead of failing silently.
    const back = new URLSearchParams(location.hash.replace(/^#/, "") || location.search);
    const backErr = back.get("error_description") ?? back.get("error");
    if (backErr) { const e = backErr.replace(/\+/g, " "); flash(/exchange external code/i.test(e) ? msg.errors.google_retry! : /already linked|identity_already_exists/i.test(e) ? msg.errors.google_exists! : `${msg.errors.generic} (${e})`, "err"); history.replaceState(null, "", location.pathname); }
    const ref = new URLSearchParams(location.search).get("ref"); if (ref) { store.set("ref", ref.toUpperCase()); history.replaceState(null, "", location.pathname); }
    const { data: reg } = await sb.rpc("is_registered");
    if (reg) {
      const code = store.get("ref");
      if (code) { const { data: okRef } = await sb.rpc("redeem_referral", { p_code: code }); store.set("ref", ""); if (okRef) flash(msg.referral.accepted); }
      loadReferral();
      const { data: gift } = await sb.rpc("claim_welcome_gift"); if (gift) { flash(msg.boost.gift); loadProfile(); haptic.success(); store.set("giftdot", "1"); store.set("giftcard", "1"); setGiftDot(true); setGiftCard(true); }
    }
    const { data: need } = await sb.rpc("registration_required"); setNeedSignup(!!need);
    // keep the town the player was last looking at alive on the server (places expire after 3 days of no use)
    const cur = placeById(store.get("filter") ?? ""); if (cur) ensurePlace(cur).catch(() => {});
    setReady(true);
  }, [locale]);

  useEffect(() => {
    const sub = sb.auth.onAuthStateChange((event, s) => {
      const u = s?.user; setRegistered(!!u && !u.is_anonymous && !!u.email); setEmail(u?.email ?? null);
      if (event === "SIGNED_IN" || event === "USER_UPDATED") setTimeout(() => bootstrap(), 0);
    });
    bootstrap().catch(() => {});
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } }).then((r) => r.json()).then((s) => { setGoogleOn(!!s?.external?.google); }).catch(() => {});
    return () => sub.data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (profile && !profile.country && region()) sb.rpc("set_country", { p_country: region() }).then(loadProfile); }, [profile?.id]);

  const loadMarkets = useCallback(async () => {
    const { data, error } = await sb.from("markets").select("id,city_id,category,kind,params,closes_at,target_at,odds_yes,odds_no,status,flash_multiplier,flash_until,flash_kind").eq("status", "open").not("city_id", "like", "p-%").gt("closes_at", new Date().toISOString()).order("closes_at").limit(300);
    // Markets of the towns this player picked are loaded separately so a long list of places never crowds out the real cities.
    const mine = placeIds.current.length ? (await sb.from("markets").select("id,city_id,category,kind,params,closes_at,target_at,odds_yes,odds_no,status,flash_multiplier,flash_until,flash_kind").eq("status", "open").in("city_id", placeIds.current).gt("closes_at", new Date().toISOString()).order("closes_at").limit(160)).data ?? [] : [];
    if (!error) { setMarkets([...(data ?? []), ...mine] as MarketRow[]); if (navigator.onLine) setOffline(false); }
    else if (/fetch|network|load failed/i.test(error.message)) setOffline(true);
    const { data: h } = await sb.from("feed_health").select("feed_id,last_ok_at");
    const nowMs = Date.now();
    setStale((h ?? []).some((r) => { const f = CITIES.flatMap((c) => c.feeds).find((x) => x.id === r.feed_id); return !!f && f.category !== "weather" && f.licenseVerified && !!r.last_ok_at && nowMs - Date.parse(r.last_ok_at) > f.staleAfterSeconds * 1000 && (data ?? []).some((m) => m.category === f.category); }));
    const { data: pop } = await sb.rpc("popular_markets", { p_limit: 5 }); setPopular(((pop ?? []) as PopularRow[]).map((x) => ({ ...x, bets: +x.bets })));
  }, []);
  const loadActivity = useCallback(async () => { const { data } = await sb.rpc("activity_feed", { p_limit: 12 }); setActivity(((data ?? []) as ActivityRow[]).map((r) => ({ ...r, amount: +r.amount }))); }, []);
  /** The four towns people bet on most (public aggregate), skipping the ones that already have a permanent chip. */
  const loadTrending = useCallback(async () => {
    const { data } = await sb.rpc("trending_places", { p_limit: 12 });
    const out: Trend[] = [];
    for (const r of (data ?? []) as { city_id: string; name: string | null; country: string | null; lat: number | null; lon: number | null; timezone: string | null }[]) {
      if (FEATURED_CITY_IDS.includes(r.city_id) || FEATURED_PLACES.some((f) => f.id === r.city_id)) continue;
      const c = CITIES.find((x) => x.id === r.city_id);
      if (c) out.push({ id: c.id, name: cityName(c, locale), country: c.country });
      else if (r.name && r.country && r.lat !== null && r.lon !== null && r.timezone) out.push({ id: r.city_id, name: r.name, country: r.country, place: { id: r.city_id, name: r.name, admin: null, country: r.country, lat: +r.lat, lon: +r.lon, timezone: r.timezone } });
      if (out.length === 4) break;
    }
    setTrending(out);
  }, [locale]);
  const loadResults = useCallback(async () => { const { data } = await sb.from("markets").select("id,city_id,kind,status,outcome,void_reason,params,evidence").neq("status", "open").order("target_at", { ascending: false }).limit(12); setResults((data ?? []) as ResultRow[]); }, []);
  useEffect(() => { loadMarkets(); loadResults(); loadActivity(); loadTrending(); const a = setInterval(loadMarkets, 30000), b = setInterval(() => { loadResults(); loadActivity(); loadTrending(); }, 60000); return () => { clearInterval(a); clearInterval(b); }; }, [loadMarkets, loadResults, loadActivity, loadTrending]);
  useEffect(() => { if (!ready) return; const i = setInterval(() => { loadBets(); loadProfile(); loadQuests(); }, 30000); return () => clearInterval(i); }, [ready]);

  const rainIds = useMemo(() => (markets ?? []).filter((m) => m.kind === "rain_at").map((m) => m.id), [markets]);
  useEffect(() => {
    if (rainIds.length === 0) return;
    const go = () => sb.rpc("weather_outlook", { p_markets: rainIds }).then(({ data }) => setOutlook(Object.fromEntries(((data ?? []) as { market_id: string; mm: number }[]).map((r) => [r.market_id, +r.mm]))));
    go(); const i = setInterval(go, 300000); return () => clearInterval(i);
  }, [rainIds.join()]);
  const trackable = useMemo(() => (markets ?? []).filter((m) => (m.category === "bus" || m.category === "train") && Date.parse(m.target_at) - Date.now() < 3 * 3600_000).slice(0, 80).map((m) => m.id), [markets]);
  useEffect(() => {
    if (trackable.length === 0) { setLive({}); return; }
    const go = () => sb.rpc("live_delays", { p_markets: trackable }).then(({ data }) => setLive(Object.fromEntries(((data ?? []) as LiveDelay[]).map((d) => [d.market_id, d]))));
    go(); const i = setInterval(go, 15000); return () => clearInterval(i);
  }, [trackable.join()]);

  // ---------- derived ----------
  const open = useMemo(() => (markets ?? []).filter((m) => Date.parse(m.closes_at) > now && !m.params.ladderOf), [markets, Math.floor(now / 1000)]);
  /** "Sorry about the delay" rungs, grouped by the market they extend. */
  const ladders = useMemo(() => {
    const g: Record<string, MarketRow[]> = {};
    for (const m of markets ?? []) { const k = m.params.ladderOf as string | undefined; if (k && Date.parse(m.closes_at) > now) (g[k] ??= []).push(m); }
    for (const k of Object.keys(g)) g[k]!.sort((a, b) => Number(a.params.extraMin) - Number(b.params.extraMin));
    return g;
  }, [markets, Math.floor(now / 30000)]);
  const inFilter = useMemo(() => open.filter((m) => filter === "world" || m.city_id === filter || m.category === "nature"), [open, filter]);
  const byCat = (c: CatId) => inFilter.filter((m) => m.category === c);
  useEffect(() => { if (catChosen || !markets) return; const first = (["bus", "train", "weather"] as CatId[]).find((c) => byCat(c).length > 0); if (first && byCat(cat).length === 0) setCat(first); }, [markets, filter, catChosen]);
  const flashFirst = (a: MarketRow[]) => [...a].sort((x, y) => Number((y.flash_multiplier ?? 1) > 1) - Number((x.flash_multiplier ?? 1) > 1));
  const list = flashFirst(byCat(cat));
  const counts: Record<CatId, number> = { bus: byCat("bus").length, train: byCat("train").length, weather: byCat("weather").length, nature: byCat("nature").length, traffic: 0 };

  const top: TopItem[] = useMemo(() => {
    const items: TopItem[] = [];
    const fl = open.filter((m) => (m.flash_multiplier ?? 1) > 1 && m.flash_until && Date.parse(m.flash_until) > now && (filter === "world" || m.city_id === filter))[0];
    if (fl) items.push({ id: "flash", icon: Zap, label: msg.streak.flash, big: <>×{fl.flash_multiplier}<small class="num">{countdown(Date.parse(fl.flash_until!) - now)}</small></>, sub: question(fl, msg, locale, cityName(cityOf(fl.city_id), locale), cityOf(fl.city_id).timezone, new Date(now)), onClick: () => setSheet({ m: fl, pick: "yes" }) });
    const facts = inFilter.filter((m) => live[m.id] && !live[m.id]!.is_forecast && live[m.id]!.delay_sec >= 60).sort((a, b) => live[b.id]!.delay_sec - live[a.id]!.delay_sec)[0];
    if (facts) items.push({ id: "late", icon: TrendingUp, label: msg.top.late, big: null, extra: <DelayMeter sec={live[facts.id]!.delay_sec} prev={live[facts.id]!.prev_delay_sec} limitSec={Number(facts.params.thresholdSec ?? 180)} msg={msg} big />, sub: `${facts.params.routeName ?? ""} → ${facts.params.headsign ?? ""}`, onClick: () => setSheet({ m: facts, pick: "yes" }) });
    const pop = popular.map((p) => ({ p, m: inFilter.find((m) => m.id === p.market_id) })).find((x) => x.m);
    if (pop?.m) items.push({ id: "pop", icon: Users, label: msg.top.popular, big: <>{pop.p.bets}<small>{msg.top.players(pop.p.bets).replace(/^\d+\s*/, "")}</small></>, sub: question(pop.m, msg, locale, cityName(cityOf(pop.m.city_id), locale), cityOf(pop.m.city_id).timezone, new Date(now)), onClick: () => setSheet({ m: pop.m!, pick: "no" }) });
    const byCity = new Map<string, number[]>();
    for (const m of open) { const l = live[m.id]; if (l && !l.is_forecast) byCity.set(m.city_id, [...(byCity.get(m.city_id) ?? []), l.delay_sec]); }
    const worst = [...byCity.entries()].filter(([, v]) => v.length >= 2).map(([c, v]) => [c, v.reduce((a, b) => a + b, 0) / v.length] as const).sort((a, b) => b[1] - a[1])[0];
    if (worst) items.push({ id: "city", icon: MapPin, label: msg.top.city, big: <>{cityName(cityOf(worst[0]), locale)}</>, sub: msg.top.avg(Math.max(0, Math.round(worst[1] / 60))), onClick: () => setFilter(worst[0]) });
    const soon = inFilter[0];
    if (soon) items.push({ id: "soon", icon: Clock, label: msg.top.closing, big: <span class="num">{countdown(Date.parse(soon.closes_at) - now)}</span>, sub: question(soon, msg, locale, cityName(cityOf(soon.city_id), locale), cityOf(soon.city_id).timezone, new Date(now)), onClick: () => setSheet({ m: soon, pick: "no" }) });
    return items;
  }, [inFilter, live, popular, locale, Math.floor(now / 1000)]);

  const flashId = open.find((m) => (m.flash_multiplier ?? 1) > 1 && m.flash_until && Date.parse(m.flash_until) > now)?.id;
  useEffect(() => { if (flashId) announce(`flash-${flashId}`, msg.voice.flash, locale); }, [flashId]);

  /** Ticker: what other players just did (real bets only), then recent results and tips. */
  const tickerItems = useMemo(() => {
    const out: { id: string; node: preact.ComponentChildren }[] = [];
    for (const a of activity) {
      const c = cityOf(a.city_id), what = isYesNo(a.market_kind) ? cityName(c, locale) : a.label || cityName(c, locale);
      const verb = msg.ticker[a.kind];
      out.push({ id: `a${a.at}${a.who}${a.amount}`, node: <><b>{a.who ?? msg.ticker.anon}</b> {verb} <i class={`amt ${a.kind}`}>{a.kind === "won" ? "+" : a.kind === "lost" ? "−" : ""}{money(a.amount, locale)}</i> {msg.ticker.on} {what}</> });
    }
    for (const r of results) {
      const c = cityOf(r.city_id), route = String(r.params.routeName ?? "");
      const txt = r.status === "void" ? msg.bets.void : isYesNo(r.kind) ? (r.outcome === "yes" ? msg.card.yes : msg.card.no) : r.outcome === "yes" ? msg.card.late : msg.card.onTime;
      out.push({ id: `r${r.id}`, node: <>{route || cityName(c, locale)} · {txt}</> });
    }
    msg.home.idle.forEach((s, i) => out.splice(Math.min(out.length, 1 + i * 2), 0, { id: `t${i}`, node: <>{s}</> }));
    return out;
  }, [activity, results, locale]);

  const sources = useMemo(() => {
    const map = new Map<string, (typeof CITIES)[number]["feeds"][number]["attribution"]>();
    for (const c of CITIES) for (const f of c.feeds) if (f.licenseVerified && c.categories[f.category]?.enabled) map.set(f.attribution.name, f.attribution);
    // Added by the metric and earthquake questions (not tied to a city feed).
    const extra = [
      { name: CROWD_SOURCE.name, via: CROWD_SOURCE.via, license: CROWD_SOURCE.license, licenseUrl: CROWD_SOURCE.licenseUrl, url: CROWD_SOURCE.url },
      { name: "USGS Earthquake Hazards Program", license: "Public domain", licenseUrl: "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits", url: "https://earthquake.usgs.gov" },
      { name: "Copernicus Atmosphere Monitoring Service", via: "Open-Meteo", license: "Copernicus licence", licenseUrl: "https://atmosphere.copernicus.eu/terms-of-use", url: "https://open-meteo.com/en/docs/air-quality-api" },
    ];
    return [...map.values(), ...extra] as NonNullable<ReturnType<typeof map.values> extends IterableIterator<infer T> ? T : never>[];
  }, []);

  // ---------- results (Esito) ----------
  const unseen = bets.filter((b) => b.status !== "open" && !seen.has(b.id));
  useEffect(() => { if (ready && !resultBet && !sheet && !auth && !nick && unseen.length > 0) { const b = unseen[0]!; setResultBet(b); announce(`res-${b.id}`, b.status === "won" ? msg.voice.won(money(b.payout - b.stake, locale)) : b.status === "lost" ? msg.voice.lost : msg.bets.void, locale); } }, [ready, unseen.map((b) => b.id).join(), !!sheet, auth, nick]);
  const markSeen = (id: string) => { const n = new Set(seen); n.add(id); setSeen(n); store.set(seenKey, JSON.stringify([...n].slice(-300))); };
  const closeResult = () => { if (resultBet) markSeen(resultBet.id); setResultBet(null); };

  // ---------- actions ----------
  const place = async (m: MarketRow, pick: Pick, stake: number, boost = false) => {
    if (offline) return msg.common.offline;
    const before = { bonus: progress?.bonus_claimed ?? false, trophies: new Set(trophies), streak: profile?.streak ?? 0 };
    const { error } = await sb.rpc("place_bet", { p_market: m.id, p_pick: pick, p_stake: stake, p_boost: boost });
    if (error) return msg.errors[Object.keys(msg.errors).find((k) => error.message.includes(k)) ?? "generic"]!;
    setSheet(null);
    const [pf] = await Promise.all([loadProfile(), loadBets(), loadQuests()]);
    const reached = pf && pf.streak > before.streak ? STREAK_MILESTONES[pf.streak] : undefined;
    const [pr, tr] = [await loadProgress(), await loadTrophies()];
    const won = TROPHY_IDS.filter((id) => tr.has(id) && !before.trophies.has(id));
    if (won.length) { setFresh(new Set(won)); flash(`${msg.profile.trophy[won[0]!].name}`); }
    else if (reached) { flash(msg.streak.milestone(pf!.streak, `+${money(reached, locale)}`)); haptic.success(); }
    else if (pr?.bonus_claimed && !before.bonus) flash(`${msg.home.missionsDone} · +${money(RING_BONUS, locale)}`);
    else flash(msg.sheet.placed(money(Math.floor(stake * Number(pick === "yes" ? m.odds_yes : m.odds_no)), locale)));
    if (pushAvailable() && !pushAsked() && !pushDenied()) setTimeout(() => setAskPush(true), 1500);
    announce(`placed-${m.id}`, msg.voice.placed(money(Math.floor(stake * Number(pick === "yes" ? m.odds_yes : m.odds_no)), locale)), locale);
    return null;
  };
  const addSlip = (m: MarketRow, pick: Pick) => { setSlip((s) => (s.some((l) => l.m.id === m.id) ? s : [...s, { m, pick }])); setSheet(null); flash(msg.slip.added); };
  const placeParlay = async (legs: SlipLeg[], stake: number, boost = false) => {
    if (offline) return msg.common.offline;
    const { error } = await sb.rpc("place_parlay", { p_legs: legs.map((l) => ({ market: l.m.id, pick: l.pick })), p_stake: stake, p_boost: boost });
    if (error) return msg.errors[Object.keys(msg.errors).find((k) => error.message.includes(k)) ?? "generic"]!;
    const win = money(Math.floor(stake * slipOdds(legs)), locale);
    setSlip([]); setParlayOpen(false);
    await Promise.all([loadProfile(), loadParlays(), loadProgress(), loadTrophies(), loadQuests()]);
    flash(msg.slip.placed(win)); announce(`parlay-${Date.now()}`, msg.voice.placed(win), locale);
    return null;
  };
  const pickPlace = async (pl: Place) => {
    // register the place on the server first: the id it returns is the one the markets carry
    try { const sid = await ensurePlace(pl); pl = { ...pl, id: sid }; } catch (e) { flash(String((e as Error).message).includes("places_limit") ? msg.places.limit : msg.errors.generic!, "err"); return; }
    setMyPlaces(rememberPlace(pl)); placeIds.current = [pl.id, ...placeIds.current.filter((x) => x !== pl.id)].slice(0, 6);
    setPlacePicker(false); store.set("filter", pl.id); setFilter(pl.id); setCatChosen(true); setCat("weather"); await loadMarkets();
  };
  /** Reads the device position once, picks the nearest known city and keeps ONLY that city's id (the coordinates are never stored or sent). */
  const locate = () => {
    if (!navigator.geolocation) { flash(msg.near.denied, "err"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: la, longitude: lo } = pos.coords;
      const known = [
        ...CITIES.map((c) => ({ id: c.id, name: cityName(c, locale), country: c.country, lat: c.location.lat, lon: c.location.lon, place: undefined as Place | undefined })),
        ...[...FEATURED_PLACES, ...FAMOUS_PLACES, ...ITALY_CAPITALS.map((c) => ({ ...c, id: placeIdOf(c.lat, c.lon) }))].map((pl) => ({ id: pl.id, name: pl.name, country: pl.country, lat: pl.lat, lon: pl.lon, place: pl as Place | undefined })),
      ];
      const best = known.reduce((a, b) => (km(la, lo, a.lat, a.lon) <= km(la, lo, b.lat, b.lon) ? a : b));
      try {
        if (best.place) { const sid = await ensurePlace(best.place); best.id = sid; placeIds.current = [sid, ...placeIds.current.filter((x) => x !== sid)].slice(0, 7); }
        const n = { id: best.id, name: best.name, country: best.country }; setNear(n); store.set("near", JSON.stringify(n)); await loadMarkets();
      } catch { flash(msg.errors.generic!, "err"); }
      setLocating(false);
    }, () => { setLocating(false); flash(msg.near.denied, "err"); }, { timeout: 10000, maximumAge: 600000 });
  };
  useEffect(() => {
    if (!near) return;
    if (!placeIds.current.includes(near.id) && near.id.startsWith("p-")) { placeIds.current = [near.id, ...placeIds.current].slice(0, 7); }
    const go = () => sb.rpc("popular_in_city", { p_city: near.id, p_limit: 5 }).then(({ data }) => setNearRows(((data ?? []) as { market_id: string; bets: number }[]).map((r) => ({ market_id: r.market_id, bets: +r.bets }))));
    go(); const i = setInterval(go, 60000); return () => clearInterval(i);
  }, [near?.id]);
  const nearItems = useMemo(() => {
    if (!near) return { items: [] as { m: MarketRow; bets: number }[], fallback: false };
    const items = nearRows.map((r) => ({ m: open.find((x) => x.id === r.market_id)!, bets: r.bets })).filter((x) => x.m);
    if (items.length > 0) return { items, fallback: false };
    return { items: open.filter((x) => x.city_id === near.id).slice(0, 3).map((m) => ({ m, bets: 0 })), fallback: true };
  }, [near?.id, nearRows, open]);
  const claimQuest = async (id: string) => {
    const { data, error } = await sb.rpc("claim_quest", { p_id: id });
    if (error) { flash(msg.errors.generic!, "err"); return; }
    if (+data > 0) { flash(`+${money(+data, locale)}`); haptic.success(); }
    await Promise.all([loadProfile(), loadQuests()]);
  };
  const goQuest = (id: string) => { setRewardsOpen(false); if (id === "o_nick") { if (registered) setNick(true); else setAuth(true); } else if (id === "o_push") { go("profile"); turnPush(true); } };
  const claimable = quests.filter((q) => q.done && !q.claimed).length;
  const turnPush = async (on: boolean) => {
    setAskPush(false);
    if (!on) { await disablePush().catch(() => {}); rememberPush(false); setPushOn(false); flash(msg.push.off); return; }
    const uid = profile?.id; if (!uid) return;
    try { const ok = await enablePush(uid); rememberPush(ok); setPushOn(ok); if (ok) { await sb.rpc("set_push_ok"); loadQuests(); } flash(ok ? msg.push.on : msg.push.denied, ok ? "ok" : "err"); } catch { flash(msg.errors.generic!, "err"); }
  };
  useEffect(() => { if (ready) pushEnabled().then(setPushOn).catch(() => {}); }, [ready]);
  useEffect(() => { if (new URLSearchParams(location.search).get("open") === "bets") { setScreen("bets"); history.replaceState(null, "", location.pathname); } }, []);
  const toggleVoice = () => { const on = !voiceOn; setVoice(on); setVoiceOn(on); flash(on ? msg.voice.on : msg.voice.off); if (on) announce("voice-on", msg.voice.on, locale, true); };
  const needJoin = needSignup && !registered;
  guestState.hasProgress = !registered && bets.length + parlays.length > 0;
  const slipIds = new Set(slip.map((l) => l.m.id));
  const shareReferral = async () => {
    if (!referral) return; const url = `${location.origin}/?ref=${referral.code}`;
    try { if (navigator.share) { await navigator.share({ title: "LateLotto", text: msg.referral.shareText(referral.code), url }); return; } await navigator.clipboard.writeText(url); flash(msg.referral.copied); } catch { /* cancelled */ }
  };
  const shareResult = async () => { if (!resultBet) return; const blob = await makeResultCard(resultBet, msg, locale); if ((await shareImage(blob, "LateLotto", msg.result.shareText)) === "saved") flash(msg.result.saved); };
  const shareProfile = async () => {
    const { data } = await sb.rpc("my_stats"); const s = (data as MyStats[] | null)?.[0] ?? null;
    const blob = await makeProfileCard({ name: profile?.display_name ?? null, streak: profile?.streak ?? 0, stats: s ? { total: +s.total, won: +s.won, lost: +s.lost, voided: +s.voided, best_win: +s.best_win, net: +s.net, staked: +s.staked } : null, trophies: TROPHY_IDS.filter((x) => trophies.has(x)) }, msg);
    if ((await shareImage(blob, "LateLotto", msg.profile.shareText)) === "saved") flash(msg.result.saved);
  };
  const signOut = async () => { await sb.auth.signOut(); setProfile(null); setBets([]); setProgress(null); setTrophies(new Set()); setReady(false); await bootstrap(); };
  const deleteAccount = async () => {
    const { error } = await sb.rpc("delete_my_account");
    if (error) { flash(msg.errors.generic!, "err"); return; }
    await sb.auth.signOut({ scope: "local" }); setProfile(null); setBets([]); setProgress(null); setTrophies(new Set()); setReady(false); setScreen("home");
    await bootstrap(); flash(msg.profile.delete.done);
  };
  const changeLocale = (l: Locale) => { store.set("locale", l); setLocale(l); };
  const go = (s: Screen) => { if (s === "profile" && giftDot) { store.set("giftdot", "0"); setGiftDot(false); } setScreen(s); scrollTo({ top: 0 }); haptic.tap(); };
  const openBets = bets.filter((b) => b.status === "open").length;

  return (
    <div class="shell">
      <Sidebar value={screen} onPick={go} msg={msg} openBets={openBets} profileDot={giftDot} />
      <div>
        <Header claimable={claimable} onWallet={() => setRewardsOpen(true)} voice={voiceSupported() ? { on: voiceOn, label: msg.voice.label, toggle: toggleVoice } : null} locale={locale} onLocale={changeLocale} wallet={profile ? new Intl.NumberFormat(INTL_TAG[locale]).format(Math.round(wallet)) : "···"} coin={currencySymbol(locale)} languageLabel={msg.common.language} creditsLabel={msg.common.credits} onHome={() => go("home")} />
        <OfflineBar offline={offline} msg={msg} onRetry={() => { loadMarkets(); setOffline(!navigator.onLine); }} />
        <Ticker items={tickerItems} />
        <main class="content">
          {stale && <p class="note warn" style="margin-bottom:12px">{msg.feedWarning}</p>}
          {screen === "home" && <Home msg={msg} locale={locale} now={now} markets={markets} list={list} live={live} cat={cat} counts={counts} onCat={(c) => { setCatChosen(true); setCat(c); haptic.tap(); }} filter={filter} onFilter={(f) => { store.set("filter", f); setFilter(f); }} top={top} onPick={(m, pick) => setSheet({ m, pick })} nearNode={<NearYou msg={msg} locale={locale} now={now} near={near} items={nearItems.items} fallback={nearItems.fallback} busy={locating} onLocate={locate} onOpen={(m) => setSheet({ m, pick: "yes" })} />} trending={trending} places={myPlaces.filter((pl) => pl.id === filter)} onPlace={(pl) => { setPlacePending(pl); pickPlace(pl); }} onMorePlaces={() => setPlacePicker(true)} ladders={ladders} outlook={outlook} attributions={sources} installEvt={installEvt} />}
          {screen === "bets" && <Bets parlays={parlays} bets={bets} msg={msg} locale={locale} now={now} onOpen={setResultBet} onHome={() => go("home")} />}
          {screen === "ranking" && <Ranking msg={msg} profile={profile} registered={registered} onToast={flash} onAuth={() => setAuth(true)} onNickname={() => setNick(true)} onRank={(r, s) => setRank({ rank: r, scope: s })} />}
          {screen === "profile" && <ProfileView giftCard={giftCard} onGiftSeen={() => { store.set("giftcard", "0"); setGiftCard(false); }} push={pushAvailable() ? { on: pushOn, denied: pushDenied(), toggle: () => turnPush(!pushOn), flash: !!profile?.push_flash, streak: !!profile?.push_streak, setPrefs: async (f: boolean, s: boolean) => { await sb.rpc("set_push_prefs", { p_flash: f, p_streak: s }); loadProfile(); } } : null} referral={referral} onShareReferral={shareReferral} progress={progress} msg={msg} locale={locale} onLocale={changeLocale} profile={profile} email={email} registered={registered} trophies={trophies} fresh={fresh} onAuth={() => setAuth(true)} onNickname={() => setNick(true)} onShareProfile={shareProfile} onSignOut={signOut} onDelete={deleteAccount} sources={sources} />}
        </main>
      </div>
      <TabBar value={screen} onPick={go} msg={msg} openBets={openBets} profileDot={giftDot} />

      {placePicker && <PlacePicker msg={msg} locale={locale} recent={myPlaces} onPick={pickPlace} onCity={(id) => { store.set("filter", id); setFilter(id); setPlacePicker(false); }} onClose={() => setPlacePicker(false)} />}
      {rewardsOpen && <RewardsSheet msg={msg} locale={locale} now={now} profile={profile} quests={quests} referral={referral} registered={registered} onClaim={claimQuest} onGo={goQuest} onShare={shareReferral} onClose={() => setRewardsOpen(false)} />}
      {askPush && <PushAsk lifted={slip.length > 0} msg={msg} onYes={() => turnPush(true)} onNo={() => { rememberPush(false); setAskPush(false); }} />}
      <ParlayBar count={slip.length} odds={slipOdds(slip)} msg={msg} locale={locale} onOpen={() => setParlayOpen(true)} />
      {sheet && <BetSheet now={now} mm={outlook[sheet.m.id]} boosts={profile?.boosts ?? 0} key={sheet.m.id} m={sheet.m} initial={sheet.pick} msg={msg} locale={locale} credits={profile?.credits ?? 0} ready={ready} needJoin={needJoin} googleOn={googleOn} inSlip={slipIds.has(sheet.m.id)} ladder={ladders[String(sheet.m.params.ladderOf ?? sheet.m.id)] ?? []} onSwitch={(x) => setSheet({ m: x, pick: "yes" })} onClose={() => setSheet(null)} onAddSlip={addSlip} onJoined={async () => {}} onPlace={place} />}
      {parlayOpen && slip.length > 0 && <ParlaySheet boosts={profile?.boosts ?? 0} legs={slip} msg={msg} locale={locale} credits={profile?.credits ?? 0} needJoin={needJoin} googleOn={googleOn} onClose={() => setParlayOpen(false)} onRemove={(id) => setSlip((s) => s.filter((l) => l.m.id !== id))} onClear={() => { setSlip([]); setParlayOpen(false); }} onJoined={async () => {}} onPlace={placeParlay} />}
      {auth && <AuthSheet msg={msg} guest={!registered} googleOn={googleOn} onClose={() => setAuth(false)} onDone={(text) => { setAuth(false); flash(text); }} />}
      {nick && <NicknameSheet msg={msg} current={profile?.display_name ?? null} onClose={() => setNick(false)} onSaved={(n) => { setNick(false); loadProfile(); loadQuests(); flash(n); }} />}
      {resultBet && <ResultScreen bet={resultBet} msg={msg} locale={locale} remaining={Math.max(0, unseen.filter((b) => b.id !== resultBet.id).length)} onClose={closeResult} onShare={shareResult} onNext={() => { markSeen(resultBet.id); const next = unseen.find((b) => b.id !== resultBet.id); setResultBet(next ?? null); }} />}
      {toast && <Toast text={toast.text} kind={toast.kind} />}
    </div>
  );
}
