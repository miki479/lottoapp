import { testMode } from "./lib/testmode.ts";
import { Activity, Bitcoin, Clapperboard, Clock, CloudLightning, Gamepad2, MapPin, Trophy, TrendingUp, Users, Zap } from "lucide-preact";
import { RING_BONUS, STREAK_MILESTONES } from "../../shared/rewards.ts";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { AuthSheet } from "./components/AuthSheet.tsx";
import { BetSheet } from "./components/BetSheet.tsx";
import { offerOdds } from "../../shared/offers.ts";
import { OFFER_EVENT, offerErrorText, type OfferUse } from "./components/PersonalOffer.tsx";
import type { CatId } from "./components/CatChips.tsx";
import { DelayMeter } from "./components/DelayMeter.tsx";
import { OfflineBar } from "./components/OfflineBar.tsx";
import { Ticker } from "./components/Ticker.tsx";
import { ParlayBar } from "./components/ParlayBar.tsx";
import { ParlaySheet, slipOdds } from "./components/ParlaySheet.tsx";
import { Header } from "./components/Header.tsx";
import { CROWD_SOURCE } from "./lib/crowding.ts";
import type { FollowedShow } from "./lib/series.ts";
import { NearbyBets } from "./components/NearbyBets.tsx";
import { HomePlaceField } from "./components/HomePlaceField.tsx";
import { CityChip } from "./components/CityChip.tsx";
import { loadHome, saveHome } from "./lib/home.ts";
import { ChallengeSheet, type Challenge } from "./components/ChallengeSheet.tsx";
import { Sidebar, TabBar, type Screen } from "./components/Nav.tsx";
import { NicknameSheet } from "./components/NicknameSheet.tsx";
import { loadMyProgress, type MyProgress } from "./lib/looks.ts";
import { DECORATIONS } from "../../shared/looks";
import { ResultScreen } from "./components/ResultScreen.tsx";
import { Toast } from "./components/Toast.tsx";
import type { TopItem } from "./components/TopCards.tsx";
import { INTL_TAG, t, TROPHY_IDS, type Locale, type TrophyId } from "./i18n/index.ts";
import { useCountUp } from "./lib/anim.ts";
import { ensureGuest, guestState, sb } from "./lib/api.ts";
import { CITIES, cityInfos, cityName, cityOf } from "./lib/cities.ts";
import { useNow } from "./lib/clock.ts";
import { pickCity, pickLocale } from "./lib/detect.ts";
import { every } from "./lib/poll.ts";
import { computeOdds } from "../../shared/odds.ts";
import { countdown, setDayUnit, currencySymbol, dayIn, daysUntil, fmtOdds, isYesNo, money, question, superText, type MarketRow } from "./lib/format.ts";
import { haptic } from "./lib/haptics.ts";
import type { NearState } from "./components/NearYou.tsx";
import { FAMOUS_PLACES, FEATURED_CITY_IDS, FEATURED_PLACES, ITALY_CAPITALS, ensurePlace, km, placeById, placeIdOf, recentPlaces, rememberPlace, type Place } from "./lib/places.ts";
import { PushAsk } from "./components/PushAsk.tsx";
import { disablePush, enablePush, pushAsked, pushAvailable, pushDenied, pushEnabled, rememberPush } from "./lib/push.ts";
import { announce, setVoice, voiceEnabled, voiceSupported } from "./lib/voice.ts";
import { makeProfileCard, makeResultCard, shareImage } from "./lib/share.ts";
import type { FlashData, DailyMissionsData, QuestRow, ActivityRow, ParlayRow, SlipLeg, LiveDelay, LiveOcc, MyBet, MyStats, Pick, PopularRow, Profile, Progress, ResultRow } from "./lib/types.ts";
import { Bets } from "./views/Bets.tsx";
import { Home, type Trend } from "./views/Home.tsx";
import { ProfileView } from "./views/Profile.tsx";
import { Ranking } from "./views/Ranking.tsx";
import { Friends } from "./views/Friends.tsx";
import { Suspense, lazy } from "preact/compat";

/** A component loaded only when it is first shown (these sheets are not needed to paint the home screen), each with its own empty fallback. */
// deno-lint-ignore no-explicit-any
const lazyNamed = <P,>(load: () => Promise<(p: P) => any>) => { const C = lazy(() => load().then((c) => ({ default: c }))) as unknown as (p: any) => any; return (p: P) => <Suspense fallback={null}><C {...p} /></Suspense>; };
const QuakeMaker = lazyNamed<Parameters<typeof import("./components/QuakeMaker.tsx")["QuakeMaker"]>[0]>(() => import("./components/QuakeMaker.tsx").then((m) => m.QuakeMaker));
const SeriesMaker = lazyNamed<Parameters<typeof import("./components/SeriesMaker.tsx")["SeriesMaker"]>[0]>(() => import("./components/SeriesMaker.tsx").then((m) => m.SeriesMaker));
const MarketMaker = lazyNamed<Parameters<typeof import("./components/MarketMaker.tsx")["MarketMaker"]>[0]>(() => import("./components/MarketMaker.tsx").then((m) => m.MarketMaker));
const ChallengeMaker = lazyNamed<Parameters<typeof import("./components/ChallengeMaker.tsx")["ChallengeMaker"]>[0]>(() => import("./components/ChallengeMaker.tsx").then((m) => m.ChallengeMaker));
const AdminPage = lazyNamed<Parameters<typeof import("./components/AdminPage.tsx")["AdminPage"]>[0]>(() => import("./components/AdminPage.tsx").then((m) => m.AdminPage));
const LookSheet = lazyNamed<Parameters<typeof import("./components/LookSheet.tsx")["LookSheet"]>[0]>(() => import("./components/LookSheet.tsx").then((m) => m.LookSheet));
const PublicProfile = lazyNamed<Parameters<typeof import("./components/PublicProfile.tsx")["PublicProfile"]>[0]>(() => import("./components/PublicProfile.tsx").then((m) => m.PublicProfile));
const PlacePicker = lazyNamed<Parameters<typeof import("./components/PlacePicker.tsx")["PlacePicker"]>[0]>(() => import("./components/PlacePicker.tsx").then((m) => m.PlacePicker));
const RewardsSheet = lazyNamed<Parameters<typeof import("./components/RewardsSheet.tsx")["RewardsSheet"]>[0]>(() => import("./components/RewardsSheet.tsx").then((m) => m.RewardsSheet));

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
/** Country-wide feeds (all Italian trains, all German regional trains): they show up under every town of that country, not only under a city of their own. */
const NATIONAL = new Set(CITIES.filter((c) => c.id === "italia" || c.id === "germany").map((c) => c.id));
const region = () => { try { return new Intl.Locale(navigator.language).maximize().region ?? null; } catch { return null; } };
const PROFILE_COLS = "id,credits,city_id,locale,timezone,country,streak,best_streak,freezes,boosts,push_flash,push_streak,push_friends,display_name,last_play_date";
const BET_COLS = "id,pick,stake,odds,boosted,vice_pct,status,payout,bonus,bonus_hit,markets(id,city_id,category,kind,params,closes_at,target_at,odds_yes,odds_no,status,void_reason,outcome,evidence)";

export function App() {
  const now = useNow(5000);
  const [locale, setLocale] = useState<Locale>(() => (store.get("locale") as Locale) || pickLocale(navigator.languages ?? [navigator.language]));
  setDayUnit(locale === "it" ? "g" : locale === "ja" ? "日" : "d");
  const [filter, setFilter] = useState<string>(() => store.get("filter") || "world");
  const [cat, setCat] = useState<CatId>("bus");
  const [catChosen, setCatChosen] = useState(false);
  const [screen, setScreen] = useState<Screen>("home");
  // what was on screen last time is shown at once (only if it is recent) while the fresh list is on its way
  const [markets, setMarkets] = useState<MarketRow[] | null>(() => { try { const c = JSON.parse(localStorage.getItem("mk1") ?? "null") as { t: number; rows: MarketRow[] } | null; return c && Date.now() - c.t < 10 * 60_000 ? c.rows : null; } catch { return null; } });
  const [live, setLive] = useState<Record<string, LiveDelay>>({});
  const [occ, setOcc] = useState<Record<string, LiveOcc>>({});
  const [popular, setPopular] = useState<PopularRow[]>([]);
  const [trendRows, setTrendRows] = useState<{ m: MarketRow; bettors: number; near: boolean }[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [bets, setBets] = useState<MyBet[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [trophies, setTrophies] = useState<Set<string>>(new Set());
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const [reqCount, setReqCount] = useState(0), [reqTick, setReqTick] = useState(0);
  const [look, setLook] = useState<MyProgress | null>(null), [lookOpen, setLookOpen] = useState(false), [pubUser, setPubUser] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [sheet, setSheet] = useState<{ m: MarketRow; pick: Pick; offer?: OfferUse } | null>(null);
  const [auth, setAuth] = useState(false);
  const [nick, setNick] = useState(false);
  const [googleOn, setGoogleOn] = useState(false);
  const [resultBet, setResultBet] = useState<MyBet | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const [staleCats, setStaleCats] = useState<string[]>([]);
  const [detailsOn, setDetailsOn] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [rank, setRank] = useState<{ rank: number | null; scope: string }>({ rank: null, scope: "" });
  const [myPlaces, setMyPlaces] = useState<Place[]>(() => recentPlaces());
  const [, setPlacePending] = useState<Place | null>(null);
  const [placePicker, setPlacePicker] = useState(false);
  const [quakeMaker, setQuakeMaker] = useState(false);
  const [seriesMaker, setSeriesMaker] = useState<{ show: FollowedShow | null } | null>(null);
  const [maker, setMaker] = useState(false);
  const [home, setHome] = useState<Place | null>(() => loadHome());
  const changeHome = (pl: Place | null) => { setHome(pl); saveHome(pl); };
  // once there is a profile, the home town chosen on this device is kept in it too (town level, for area statistics)
  useEffect(() => { if (profile && home) saveHome(home); }, [profile?.id]);
  const [challengeMaker, setChallengeMaker] = useState(false);
  const [challengeCode, setChallengeCode] = useState<string | null>(null);
  const [myChallenges, setMyChallenges] = useState<Challenge[]>([]);
  const [friendBets, setFriendBets] = useState<Record<string, number>>({});
  const [invites, setInvites] = useState<(Challenge & { invited_by: string })[]>([]);
  const placeIds = useRef<string[]>(myPlaces.map((p) => p.id));
  const [near, setNear] = useState<NearState | null>(() => { try { return JSON.parse(store.get("near") ?? "null"); } catch { return null; } });
  const [nearRows, setNearRows] = useState<{ market_id: string; bets: number }[]>([]);
  const [locating, setLocating] = useState(false);
  const [trending, setTrending] = useState<Trend[]>([]);
  const [outlook, setOutlook] = useState<Record<string, number>>({});
  const [giftDot, setGiftDot] = useState(() => store.get("giftdot") === "1");
  const [giftCard, setGiftCard] = useState(() => store.get("giftcard") === "1");
  const [quests, setQuests] = useState<QuestRow[]>([]);
  const [betsLimit, setBetsLimit] = useState(60);
  const [flashM, setFlashM] = useState<FlashData | null>(null);
  const [missions, setMissions] = useState<DailyMissionsData | null>(null);
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
  const toastTimer = useRef<number | undefined>(undefined);
  const flash = (text: string, kind: "ok" | "err" = "ok") => { setToast({ text, kind }); clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(null), 3600); };
  const seenKey = `seen.${profile?.id ?? "x"}`;

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true), bip = (e: Event) => { e.preventDefault(); setInstallEvt(e); };
    addEventListener("online", on); addEventListener("offline", off); addEventListener("beforeinstallprompt", bip);
    return () => { removeEventListener("online", on); removeEventListener("offline", off); removeEventListener("beforeinstallprompt", bip); };
  }, []);

  // ---------- data loading ----------
  /** Level and look; a level reached since the last visit is announced once, with the ring it unlocks. */
  const loadLook = useCallback(async () => {
    const p = await loadMyProgress(); if (!p) return;
    setLook(p);
    if (p.granted && p.granted.length) { const ids = p.granted.filter((t): t is TrophyId => (TROPHY_IDS as string[]).includes(t)); loadTrophies(); if (ids.length) { setFresh(new Set(ids)); flash(msg.profile.trophy[ids[0]!].name); haptic.success(); } }
    const before = Number(store.get("lvl") ?? 0);
    if (before > 0 && p.level > before) {
      const got = DECORATIONS.filter((d) => d.level !== undefined && d.level > before && d.level <= p.level).sort((a, b) => b.level! - a.level!)[0];
      flash(msg.look.levelUp(p.level, got ? msg.look.deco[got.id] ?? got.id : null)); haptic.success();
    }
    if (p.level !== before) store.set("lvl", String(p.level));
  }, [msg]);
  const loadProfile = useCallback(async () => { const { data } = await sb.from("profiles").select(PROFILE_COLS).maybeSingle(); if (data) setProfile(data as Profile); return data as Profile | null; }, []);
  // signed in with Google and no nickname yet: take the name from the Google profile (a nickname already chosen is never touched)
  const namedOnce = useRef(false);
  useEffect(() => { if (!registered || !profile || profile.display_name || namedOnce.current) return; namedOnce.current = true; sb.rpc("claim_google_name").then(({ data }) => { if (data) { loadProfile(); loadQuests(); } }); }, [registered, profile?.display_name]);
  const loadProgress = useCallback(async (zone = tz) => {
    const { data } = await sb.from("daily_progress").select("day,bus,train,weather,traffic,bonus_claimed").order("day", { ascending: false }).limit(1).maybeSingle();
    const p = data && data.day === dayIn(zone) ? (data as Progress) : null; setProgress(p); return p;
  }, [tz]);
  const loadTrophies = useCallback(async () => { const { data } = await sb.from("trophies").select("trophy_id"); const s = new Set((data ?? []).map((r) => r.trophy_id as string)); setTrophies(s); return s; }, []);
  const loadBets = useCallback(async () => { const { data } = await sb.from("bets").select(BET_COLS).order("placed_at", { ascending: false }).limit(betsLimit); setBets((data ?? []) as unknown as MyBet[]); }, [betsLimit]);

  const loadChallenges = useCallback(async () => { if (!registered) { setMyChallenges([]); setInvites([]); setFriendBets({}); return; } const [{ data }, inv, fb] = await Promise.all([sb.rpc("my_challenges"), sb.rpc("my_invites"), sb.rpc("friend_bets")]); setFriendBets(Object.fromEntries(((fb.data ?? []) as { market_id: string; friends: number }[]).map((x) => [x.market_id, Number(x.friends)]))); setMyChallenges((data ?? []) as Challenge[]); setInvites((inv.data ?? []) as (Challenge & { invited_by: string })[]); }, [registered]);
  const loadParlays = useCallback(async () => { const { data } = await sb.from("parlays").select("id,boosted,stake,odds,status,payout,placed_at,settled_at,parlay_legs(market_id,pick,odds,status,markets(id,city_id,category,kind,params,closes_at,target_at,odds_yes,odds_no,status))").order("placed_at", { ascending: false }).limit(40); setParlays((data ?? []) as unknown as ParlayRow[]); }, []);
  const loadQuests = useCallback(async () => { const [{ data }, dm, fl] = await Promise.all([sb.rpc("my_quests"), sb.rpc("daily_missions"), sb.rpc("daily_flash")]); if (fl.data) setFlashM(fl.data as FlashData); setQuests(((data ?? []) as QuestRow[]).map((q) => ({ ...q, reward: +q.reward }))); if (dm.data) setMissions(dm.data as DailyMissionsData); }, []);
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

  // the sign-in listener is registered once: it must call the newest bootstrap (current language), not the first one
  const bootRef = useRef(bootstrap); bootRef.current = bootstrap;
  useEffect(() => {
    const sub = sb.auth.onAuthStateChange((event, s) => {
      const u = s?.user; setRegistered(!!u && !u.is_anonymous && !!u.email); setEmail(u?.email ?? null);
      if (event === "SIGNED_IN" || event === "USER_UPDATED") setTimeout(() => bootRef.current(), 0);
    });
    bootstrap().catch(() => {});
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } }).then((r) => r.json()).then((s) => { setGoogleOn(!!s?.external?.google); }).catch(() => {});
    return () => sub.data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (profile && !profile.country && region()) sb.rpc("set_country", { p_country: region() }).then(loadProfile); }, [profile?.id]);

  // loadMarkets runs on a timer from the first render: it reads the player's current town, country and filter through a ref
  const envRef = useRef({ near, profile, filter }); envRef.current = { near, profile, filter };
  const mkSeq = useRef(0); // calls overlap (timer, bets, filter changes): only the newest answer may replace the list
  const loadMarkets = useCallback(async () => {
    const seq = ++mkSeq.current;
    const { data, error } = await sb.from("markets").select("id,city_id,category,kind,params,closes_at,target_at,odds_yes,odds_no,status,flash_multiplier,flash_until,flash_kind").eq("status", "open").not("city_id", "like", "p-%").gt("closes_at", new Date().toISOString()).order("closes_at").limit(300);
    // Markets of the towns this player picked are loaded separately so a long list of places never crowds out the real cities.
    const mine = placeIds.current.length ? (await sb.from("markets").select("id,city_id,category,kind,params,closes_at,target_at,odds_yes,odds_no,status,flash_multiplier,flash_until,flash_kind").eq("status", "open").in("city_id", placeIds.current).gt("closes_at", new Date().toISOString()).order("closes_at").limit(160)).data ?? [] : [];
    // Questions that close far ahead (matches, daily page views, price lines) would fall off the first page: fetch them on their own.
    // One page per category: a single page of the soonest 200 across all of them (728 open at the last count) left the latest-closing ones out.
    const far = (await Promise.all(["sport", "finance", "culture", "nature", "law", "traffic"].map((c) => sb.from("markets").select("id,city_id,category,kind,params,closes_at,target_at,odds_yes,odds_no,status,flash_multiplier,flash_until,flash_kind").eq("status", "open").eq("category", c).gt("closes_at", new Date().toISOString()).order("closes_at").limit(c === "law" ? 60 : 200)))).flatMap((r) => r.data ?? []);
    // the questions we write ourselves close far ahead: always fetched on their own
    const house = (await sb.from("markets").select("id,city_id,category,kind,params,closes_at,target_at,odds_yes,odds_no,status,flash_multiplier,flash_until,flash_kind").eq("status", "open").eq("kind", "tick_gt").like("params->>series", "house:%").gt("closes_at", new Date().toISOString()).order("closes_at").limit(60)).data ?? [];
    // the first page holds only what closes soonest: the town being looked at (and the country-wide train feeds of its country) are loaded in full
    const f0 = envRef.current.filter;
    const here = f0 && f0 !== "world" && f0 !== "mine" && !placeIds.current.includes(f0) ? (await sb.from("markets").select("id,city_id,category,kind,params,closes_at,target_at,odds_yes,odds_no,status,flash_multiplier,flash_until,flash_kind").eq("status", "open").in("city_id", [f0, ...[...NATIONAL].filter((id) => CITIES.find((c) => c.id === id)?.country === (CITIES.find((c) => c.id === f0)?.country ?? placeById(f0)?.country))]).gt("closes_at", new Date().toISOString()).order("closes_at").limit(400)).data ?? [] : [];
    // the towns of the player's own country are loaded too: with a long list of open questions, the ones closing soonest may all belong to another country
    const cc = envRef.current.near?.country ?? envRef.current.profile?.country ?? region();
    const ownIds = CITIES.filter((c) => c.country === cc && !c.region).map((c) => c.id);
    const nationalIds = [...NATIONAL].filter((id) => CITIES.find((c) => c.id === id)?.country === cc);
    const own = cc && ownIds.length + nationalIds.length ? (await sb.from("markets").select("id,city_id,category,kind,params,closes_at,target_at,odds_yes,odds_no,status,flash_multiplier,flash_until,flash_kind").eq("status", "open").in("city_id", [...ownIds, ...nationalIds]).gt("closes_at", new Date().toISOString()).order("closes_at").limit(300)).data ?? [] : [];
    const seen = new Set([...(data ?? []), ...mine].map((x) => (x as { id: string }).id));
    const extra = [...far, ...house, ...here, ...own].filter((x) => { const id = (x as unknown as { id: string }).id; if (seen.has(id)) return false; seen.add(id); return true; });
    if (seq !== mkSeq.current) return;
    if (!error) { const all = [...(data ?? []), ...mine, ...extra].filter((m) => testMode() || !(m.params as { testOnly?: boolean } | null)?.testOnly) as MarketRow[]; setMarkets(all); try { localStorage.setItem("mk1", JSON.stringify({ t: Date.now(), rows: all.slice(0, 250) })); } catch { /* storage full or unavailable */ } if (navigator.onLine) setOffline(false); }
    else if (/fetch|network|load failed/i.test(error.message)) setOffline(true);
    const { data: h } = await sb.from("feed_health").select("feed_id,last_ok_at");
    const nowMs = Date.now();
    setDetailsOn((h ?? []).some((r) => r.feed_id === "apifootball" && !!r.last_ok_at && nowMs - Date.parse(r.last_ok_at) < 8 * 3600_000));
    setStaleCats([...new Set((h ?? []).flatMap((r) => { const f = CITIES.flatMap((c) => c.feeds).find((x) => x.id === r.feed_id); return f && f.category !== "weather" && f.licenseVerified && !!r.last_ok_at && nowMs - Date.parse(r.last_ok_at) > f.staleAfterSeconds * 1000 && (data ?? []).some((m) => m.category === f.category) ? [f.category as string] : []; }))]);
    const { data: pop } = await sb.rpc("popular_markets", { p_limit: 5 }); setPopular(((pop ?? []) as PopularRow[]).map((x) => ({ ...x, bets: +x.bets })));
    try {
      const env = envRef.current;
      const nearIds = CITIES.filter((c) => c.country === (env.near?.country ?? env.profile?.country ?? region())).map((c) => c.id);
      const here = env.near?.id ?? (env.filter !== "world" && env.filter !== "mine" ? env.filter : null);
      const { data: tr } = await sb.rpc("trending_markets", { p_place: here, p_near: nearIds, p_limit: 6 });
      const ids = ((tr ?? []) as { market_id: string; bettors: number | string }[]);
      if (ids.length) {
        const { data: rows } = await sb.from("markets").select("id,city_id,category,kind,params,closes_at,target_at,odds_yes,odds_no,status,flash_multiplier,flash_until,flash_kind").in("id", ids.map((x) => x.market_id));
        const by = new Map(((rows ?? []) as unknown as MarketRow[]).map((r) => [r.id, r]));
        setTrendRows(ids.flatMap((x) => { const mk = by.get(x.market_id); return mk ? [{ m: mk, bettors: +x.bettors, near: !!here && (mk.city_id === here || nearIds.includes(mk.city_id)) }] : []; }));
      } else setTrendRows([]);
    } catch { /* trending is optional */ }
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
  const loadResults = useCallback(async () => { const { data } = await sb.from("markets").select("id,city_id,kind,status,outcome,void_reason,params,evidence,target_at").neq("status", "open").order("target_at", { ascending: false }).limit(12); setResults((data ?? []) as ResultRow[]); }, []);
  /** A friend-challenge link (?c=<code>) opens that challenge. */
  useEffect(() => {
    const c = new URLSearchParams(location.search).get("c");
    if (!c || !/^[0-9a-f]{8}$/i.test(c)) return;
    setChallengeCode(c.toLowerCase());
    const u = new URL(location.href); u.searchParams.delete("c"); history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
  }, []);
  // a push can open the app on a given screen (?open=ranking)
  useEffect(() => { const o = new URLSearchParams(location.search).get("open"); if (o === "ranking" || o === "friends" || o === "bets" || o === "profile") { setScreen(o); const u = new URL(location.href); u.searchParams.delete("open"); history.replaceState(null, "", u.pathname + (u.search || "") + u.hash); } }, []);
  const loadReqs = useCallback(async () => { if (!registered) { setReqCount(0); return; } const { data } = await sb.rpc("friend_requests_in"); setReqCount(((data ?? []) as unknown[]).length); }, [registered]);
  useEffect(() => { loadReqs(); if (!registered) return; return every(loadReqs, 60_000); }, [registered, loadReqs]);
  useEffect(() => { loadChallenges(); }, [registered]);
  useEffect(() => { if (registered) loadLook(); else setLook(null); }, [registered, profile?.credits]);
  useEffect(() => { if (screen === "bets") loadChallenges(); }, [screen]);
  useEffect(() => { if (ready) loadBets(); }, [betsLimit]);
  useEffect(() => { if (!registered) return; return every(loadChallenges, 120_000); }, [registered, loadChallenges]);
  /** A shared link (?m=<market id>) opens that question straight away. */
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("m");
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    sb.from("markets").select("id,city_id,category,kind,params,closes_at,target_at,odds_yes,odds_no,status,flash_multiplier,flash_until,flash_kind").eq("id", id).maybeSingle().then(({ data }) => {
      const row = data as unknown as MarketRow | null;
      if (row && (testMode() || !(row.params as { testOnly?: boolean }).testOnly)) setSheet({ m: row, pick: "yes" });
      const u = new URL(location.href); u.searchParams.delete("m"); history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
    });
  }, []);
  useEffect(() => { loadMarkets(); loadResults(); loadActivity(); loadTrending(); const a = every(loadMarkets, 45_000), b = every(() => { loadResults(); loadActivity(); loadTrending(); }, 90_000); return () => { a(); b(); }; }, [loadMarkets, loadResults, loadActivity, loadTrending]);
  useEffect(() => { if (!ready) return; return every(() => { loadBets(); loadProfile(); loadQuests(); }, 60_000); }, [ready]);

  const rainIds = useMemo(() => (markets ?? []).filter((m) => m.kind === "rain_at").map((m) => m.id), [markets]);
  useEffect(() => {
    if (rainIds.length === 0) return;
    const go = () => sb.rpc("weather_outlook", { p_markets: rainIds }).then(({ data }) => setOutlook(Object.fromEntries(((data ?? []) as { market_id: string; mm: number }[]).map((r) => [r.market_id, +r.mm]))));
    go(); return every(go, 300_000);
  }, [rainIds.join()]);
  const trackable = useMemo(() => (markets ?? []).filter((m) => (m.category === "bus" || m.category === "train") && Date.parse(m.target_at) - Date.now() < (m.category === "train" ? 10 : 3) * 3600_000).slice(0, 150).map((m) => m.id), [markets]);
  useEffect(() => {
    if (trackable.length === 0) { setLive({}); return; }
    const go = () => sb.rpc("live_delays", { p_markets: trackable }).then(({ data }) => setLive(Object.fromEntries(((data ?? []) as LiveDelay[]).map((d) => [d.market_id, d]))));
    go(); return every(go, 20_000);
  }, [trackable.join()]);
  // how full the buses are (only some operators report it: the answer lists just those)
  const busIds = useMemo(() => (markets ?? []).filter((m) => m.category === "bus" && Date.parse(m.target_at) - Date.now() < 3 * 3600_000).slice(0, 150).map((m) => m.id), [markets]);
  useEffect(() => {
    if (busIds.length === 0) { setOcc({}); return; }
    const go = () => sb.rpc("live_occupancy", { p_markets: busIds }).then(({ data }) => setOcc(Object.fromEntries(((data ?? []) as LiveOcc[]).map((d) => [d.market_id, d]))));
    go(); return every(go, 30_000);
  }, [busIds.join()]);

  // ---------- derived ----------
  const open = useMemo(() => (markets ?? []).filter((m) => Date.parse(m.closes_at) > now && !m.params.ladderOf), [markets, Math.floor(now / 1000)]);
  /** "Sorry about the delay" rungs, grouped by the market they extend. */
  const ladders = useMemo(() => {
    const g: Record<string, MarketRow[]> = {};
    for (const m of markets ?? []) { const k = m.params.ladderOf as string | undefined; if (k && Date.parse(m.closes_at) > now) (g[k] ??= []).push(m); }
    for (const k of Object.keys(g)) g[k]!.sort((a, b) => Number(a.params.extraMin) - Number(b.params.extraMin));
    return g;
  }, [markets, Math.floor(now / 30000)]);
  /** Strikes are an Italian topic: shown only with the Italian language or an Italian country, never inside the categories. */
  const isItalian = locale === "it" || profile?.country === "IT" || region() === "IT";
  /** "Near you" chip: everything from the player's own country (their located town, profile or phone region). */
  const myCountry = near?.country ?? profile?.country ?? region();
  const countryOf = (id: string) => CITIES.find((c) => c.id === id)?.country ?? placeById(id)?.country ?? (near?.id === id ? near.country : undefined);
  const hasMine = !!myCountry && open.some((m) => m.category !== "nature" && m.category !== "strike" && m.category !== "finance" && m.category !== "culture" && m.category !== "sport" && m.category !== "law" && countryOf(m.city_id) === myCountry);
  const inFilter = useMemo(() => open.filter((m) => filter === "world" || m.city_id === filter || m.category === "nature" || m.category === "strike" || m.category === "finance" || m.category === "culture" || m.category === "sport" || m.category === "law" || (m.category === "traffic" && m.city_id === "world") || (filter === "mine" && countryOf(m.city_id) === myCountry) || (NATIONAL.has(m.city_id) && countryOf(filter) === countryOf(m.city_id))), [open, filter, myCountry, near?.id]);
  useEffect(() => { if (hasMine && filter === "world" && !store.get("filter")) setFilter("mine"); }, [hasMine]);
  // a question already bet on leaves the lists (it stays in "My bets"), so it cannot be played twice by mistake
  const betOn = useMemo(() => new Set(bets.filter((b) => b.status === "open").map((b) => b.markets.id)), [bets]);
  const byCat = (c: CatId) => inFilter.filter((m) => m.category === c && !betOn.has(m.id));
  useEffect(() => { if (catChosen || !markets) return; const first = (["bus", "train", "weather"] as CatId[]).find((c) => byCat(c).length > 0); if (first && byCat(cat).length === 0) setCat(first); }, [markets, filter, catChosen]);
  const flashFirst = (a: MarketRow[]) => [...a].sort((x, y) => Number((y.flash_multiplier ?? 1) > 1) - Number((x.flash_multiplier ?? 1) > 1));
  // trains and buses: the most delayed right now first, then the rest
  const byDelay = (x: MarketRow[]) => [...x].sort((m1, m2) => Number(!!live[m2.id] && !live[m2.id]!.is_forecast) - Number(!!live[m1.id] && !live[m1.id]!.is_forecast) || (live[m2.id]?.delay_sec ?? -1e9) - (live[m1.id]?.delay_sec ?? -1e9));
  const list = cat === "train" || cat === "bus" ? byDelay(byCat(cat)) : flashFirst(byCat(cat));
  const counts: Record<CatId, number> = { bus: byCat("bus").length, train: byCat("train").length, weather: byCat("weather").length, nature: byCat("nature").length, strike: isItalian ? byCat("strike").length : 0, traffic: byCat("traffic").length, finance: byCat("finance").length, culture: byCat("culture").length, sport: new Set(byCat("sport").map((m) => String(m.params.eventId))).size, law: byCat("law").length, gov: 0 };

  const top: TopItem[] = useMemo(() => {
    const items: TopItem[] = [];
    const fl = open.filter((m) => (m.flash_multiplier ?? 1) > 1 && m.flash_until && Date.parse(m.flash_until) > now && (filter === "world" || m.city_id === filter))[0];
    if (fl) items.push({ mid: fl.id, id: "flash", icon: Zap, label: superText(fl, msg) ? msg.sup.top : msg.streak.flash, big: <>×{fl.flash_multiplier}<small class="num">{countdown(Date.parse(fl.flash_until!) - now)}</small></>, sub: superText(fl, msg) ?? question(fl, msg, locale, cityName(cityOf(fl.city_id), locale), cityOf(fl.city_id).timezone, new Date(now)), onClick: () => setSheet({ m: fl, pick: "yes" }) });
    const facts = inFilter.filter((m) => live[m.id] && !live[m.id]!.is_forecast && live[m.id]!.delay_sec >= 60).sort((a, b) => live[b.id]!.delay_sec - live[a.id]!.delay_sec)[0];
    if (facts) items.push({ mid: facts.id, id: "late", icon: TrendingUp, label: msg.top.late, big: null, extra: <DelayMeter sec={live[facts.id]!.delay_sec} prev={live[facts.id]!.prev_delay_sec} limitSec={Number(facts.params.thresholdSec ?? 180)} msg={msg} big />, sub: `${facts.params.routeName ?? ""} → ${facts.params.headsign ?? ""}`, onClick: () => setSheet({ m: facts, pick: "yes" }) });
    const pop = popular.map((p) => ({ p, m: inFilter.find((m) => m.id === p.market_id) })).find((x) => x.m);
    if (pop?.m) items.push({ mid: pop.m.id, id: "pop", icon: Users, label: msg.top.popular, big: <>{pop.p.bets}<small>{msg.top.players(pop.p.bets).replace(/^\d+\s*/, "")}</small></>, sub: question(pop.m, msg, locale, cityName(cityOf(pop.m.city_id), locale), cityOf(pop.m.city_id).timezone, new Date(now)), onClick: () => setSheet({ m: pop.m!, pick: "no" }) });
    const byCity = new Map<string, number[]>();
    for (const m of open) { const l = live[m.id]; if (l && !l.is_forecast) byCity.set(m.city_id, [...(byCity.get(m.city_id) ?? []), l.delay_sec]); }
    const worst = [...byCity.entries()].filter(([, v]) => v.length >= 2).map(([c, v]) => [c, v.reduce((a, b) => a + b, 0) / v.length] as const).sort((a, b) => b[1] - a[1])[0];
    if (worst) items.push({ id: "city", icon: MapPin, label: msg.top.city, big: <>{cityName(cityOf(worst[0]), locale)}</>, sub: msg.top.avg(Math.max(0, Math.round(worst[1] / 60))), onClick: () => { store.set("filter", worst[0]); setFilter(worst[0]); setCatChosen(true); const k = (["bus", "train"] as CatId[]).find((c) => open.some((m) => m.city_id === worst[0] && m.category === c)); if (k && !(["bus", "train", "weather", "traffic"] as CatId[]).includes(cat)) setCat(k); } });
    const tr0 = trendRows.find((t) => (t.m.params as { testOnly?: boolean }).testOnly !== true && Date.parse(t.m.closes_at) > now);
    if (tr0) { const c = cityOf(tr0.m.city_id); items.unshift({ mid: tr0.m.id, id: "trend", icon: TrendingUp, label: tr0.near ? msg.maker.trendingNear : msg.maker.trending, big: <>{tr0.bettors}<small>{msg.top.players(tr0.bettors).replace(/^\d+\s*/, "")}</small></>, sub: question(tr0.m, msg, locale, cityName(c, locale), c.timezone, new Date(now)), onClick: () => setSheet({ m: tr0.m, pick: "yes" }) }); }
    // One standout per topic, each for its own reason: the best-paying match, the closest coin toss, the next thing in the spotlight, the wildest long shot, the sky.
    const open1 = (c: string, within: number) => inFilter.filter((m) => m.category === c && Date.parse(m.closes_at) > now && Date.parse(m.closes_at) - now < within * 3600_000 && !(m.params as { testOnly?: boolean }).testOnly);
    // the picks that depend on a ranking take one of the best three, a different one each day (UTC), so the row is not always the same
    const daily = <T,>(a: T[]): T | undefined => a[Math.floor(now / 86400_000) % Math.min(3, a.length)];
    const sub = (m: MarketRow) => question(m, msg, locale, cityName(cityOf(m.city_id), locale), cityOf(m.city_id).timezone, new Date(now));
    const feat = (id: string, icon: TopItem["icon"], label: string, m: MarketRow | undefined, big: preact.ComponentChildren, pick: "yes" | "no" = "yes") => { if (m) items.push({ mid: m.id, id, icon, label, big, sub: sub(m), onClick: () => setSheet({ m, pick }) }); };
    // the game everybody is waiting for: one hour in, one hour out, so the featured row does not fill up
    const gta = open.find((m) => String(m.params.series ?? "") === "house:gta6" && Date.parse(m.closes_at) > now);
    if (gta && Math.floor(now / 3600_000) % 2 === 0) { const d = daysUntil(Number(gta.params.releaseAt) * 1000, now); items.unshift({ mid: gta.id, id: "gta", cls: "gta", icon: Gamepad2, label: msg.house.excl, big: <>{d}<small>{msg.house.daysWord(d)}</small></>, sub: sub(gta), onClick: () => setSheet({ m: gta, pick: "yes" }) }); }
    // football: the likeliest draw, the match where both teams most likely score (its goal bet is opened on tap), the longest-priced away win
    const three = open1("sport", 72).filter((m) => ["home_win", "draw", "away_win"].includes(String(m.params.bet)));
    const prior = (m: MarketRow, k: string) => Number((m.params.priors as Record<string, number> | undefined)?.[k]);
    const dr = daily(three.filter((m) => m.params.bet === "draw").sort((x, y) => Number(x.odds_yes) - Number(y.odds_yes)));
    feat("sport-draw", Trophy, msg.top.draw, dr, dr ? <>×{fmtOdds(Number(dr.odds_yes), locale)}</> : null);
    const gl = three.filter((m) => m.params.bet === "draw" && Number.isFinite(prior(m, "btts"))).sort((x, y) => prior(y, "btts") - prior(x, "btts"))[0];
    if (gl) { const o = computeOdds(Math.min(0.9, Math.max(0.1, prior(gl, "btts")))).yes; items.push({ id: "sport-goal", icon: Trophy, label: msg.top.goal, big: <>×{fmtOdds(o, locale)}</>, sub: question({ ...gl, params: { ...gl.params, bet: "btts" } } as MarketRow, msg, locale, "", "UTC", new Date(now)), onClick: () => void openMatchBet(gl, "btts") }); }
    const up = daily(three.filter((m) => m.params.bet === "away_win" && Number(m.odds_yes) >= 4).sort((x, y) => Number(y.odds_yes) - Number(x.odds_yes)));
    feat("sport-upset", Trophy, msg.top.upset, up, up ? <>×{fmtOdds(Number(up.odds_yes), locale)}</> : null);
    const toss = daily(open1("finance", 24).sort((x, y) => Math.abs(Number(x.odds_yes) - Number(x.odds_no)) - Math.abs(Number(y.odds_yes) - Number(y.odds_no))));
    feat("coin", Bitcoin, msg.top.coin, toss, toss ? <>{fmtOdds(Number(toss.odds_yes), locale)}<small> / {fmtOdds(Number(toss.odds_no), locale)}</small></> : null);
    const spot = open1("culture", 48).sort((x, y) => Date.parse(x.closes_at) - Date.parse(y.closes_at))[0];
    feat("culture", Clapperboard, msg.top.spotlight, spot, <span class="num">{spot ? countdown(Date.parse(spot.closes_at) - now) : ""}</span>);
    const wild = daily(open1("nature", 36).filter((m) => Number(m.odds_yes) < 25).sort((x, y) => Number(y.odds_yes) - Number(x.odds_yes)));
    feat("wild", Activity, msg.top.wild, wild, wild ? <>×{fmtOdds(Number(wild.odds_yes), locale)}</> : null);
    const sky = daily(open1("weather", 24).sort((x, y) => Number(y.odds_yes) - Number(x.odds_yes)));
    feat("sky", CloudLightning, msg.top.sky, sky, sky ? <>×{fmtOdds(Number(sky.odds_yes), locale)}</> : null);
    const hotId = Object.entries(friendBets).sort((x, y) => y[1] - x[1]).find(([id]) => inFilter.some((m) => m.id === id));
    const hotM = hotId && inFilter.find((m) => m.id === hotId[0]);
    if (hotM && hotId) items.unshift({ mid: hotM.id, id: "friends", icon: Users, label: msg.frd.hot, big: <>{hotId[1]}<small>{msg.frd.friendsOn(hotId[1]).replace(/^\d+\s*/, "")}</small></>, sub: sub(hotM), onClick: () => setSheet({ m: hotM, pick: "yes" }) });
    const best = open1("", 48);
    const bestM = inFilter.filter((m) => Date.parse(m.closes_at) > now && Date.parse(m.closes_at) - now < 48 * 3600_000 && !(m.params as { testOnly?: boolean }).testOnly && !m.params.ladderOf && Number(m.odds_yes) < 20).sort((x, y) => Number(y.odds_yes) - Number(x.odds_yes))[0];
    void best; feat("best", TrendingUp, msg.top.best, bestM, bestM ? <>×{fmtOdds(Number(bestM.odds_yes), locale)}</> : null);
    const soon = inFilter[0];
    if (soon) items.push({ mid: soon.id, id: "soon", icon: Clock, label: msg.top.closing, big: <span class="num">{countdown(Date.parse(soon.closes_at) - now)}</span>, sub: question(soon, msg, locale, cityName(cityOf(soon.city_id), locale), cityOf(soon.city_id).timezone, new Date(now)), onClick: () => setSheet({ m: soon, pick: "no" }) });
    // Not everything at once: what matters now stays (friends, trend, flash, the most delayed), the rest rotates every few hours, five cards at most.
    const seenM = new Set<string>(); const uniq = items.filter((x) => { if (!x.mid) return true; if (seenM.has(x.mid)) return false; seenM.add(x.mid); return true; }); items.length = 0; items.push(...uniq);
    const PIN = ["friends", "trend", "flash", "late"], pinned = items.filter((x) => PIN.includes(x.id)).sort((x, y) => PIN.indexOf(x.id) - PIN.indexOf(y.id)).slice(0, 3);
    const seed = Math.floor(now / (3 * 3600_000)), h = (id: string) => { let n = seed; for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) >>> 0; return n; };
    const rest = items.filter((x) => !PIN.includes(x.id) || !pinned.includes(x)).sort((x, y) => h(x.id) - h(y.id));
    return [...pinned, ...rest].slice(0, 5);
  }, [inFilter, live, popular, trendRows, friendBets, locale, Math.floor(now / 1000)]);

  const flashId = open.find((m) => (m.flash_multiplier ?? 1) > 1 && m.flash_until && Date.parse(m.flash_until) > now)?.id;
  useEffect(() => { if (flashId) announce(`flash-${flashId}`, msg.voice.flash, locale); }, [flashId]);

  /** Ticker: what other players just did (real bets only), then recent results and tips. */
  const tickerItems = useMemo(() => {
    const out: { id: string; node: preact.ComponentChildren }[] = [];
    for (const a of activity) {
      const c = cityOf(a.city_id), isDelay = a.market_kind === "bus_delay_gt" || a.market_kind === "train_delay_gt", what = isDelay && a.label ? `${a.market_kind === "bus_delay_gt" ? msg.tabs.bus : msg.tabs.train} ${a.label} · ${cityName(c, locale)}` : a.label || cityName(c, locale);
      const verb = msg.ticker[a.kind];
      out.push({ id: `a${a.at}${a.who}${a.amount}`, node: <><b>{a.who ?? msg.ticker.anon}</b> {verb} <i class={`amt ${a.kind}`}>{a.kind === "won" ? "+" : a.kind === "lost" ? "−" : ""}{money(a.amount, locale)}</i> {msg.ticker.on} {what}</> });
    }
    for (const r of results) {
      const c = cityOf(r.city_id), route = String(r.params.routeName ?? "");
      const txt = r.status === "void" ? msg.bets.void : isYesNo(r.kind) ? (r.outcome === "yes" ? msg.card.yes : msg.card.no) : r.outcome === "yes" ? msg.card.late : msg.card.onTime;
      if (route || r.kind === "bus_delay_gt" || r.kind === "train_delay_gt") { out.push({ id: `r${r.id}`, node: <>{route || cityName(c, locale)} · {txt}</> }); continue; }
      // any other question is shown with its own words, never as a bare "World · No"
      if (!r.target_at) continue;
      const mk = { ...r, category: "", closes_at: r.target_at, odds_yes: 1, odds_no: 1, flash_multiplier: 1, flash_until: null, flash_kind: null } as unknown as MarketRow;
      out.push({ id: `r${r.id}`, node: <>{question(mk, msg, locale, cityName(c, locale), c.timezone, new Date(now))} · <b>{txt}</b></> });
    }
    // What is happening on the lines and in the markets right now (not only what players did).
    const q = (m: MarketRow) => { const c = cityOf(m.city_id); return question(m, msg, locale, cityName(c, locale), c.timezone, new Date(now)); };
    const lateNow = open.filter((m) => live[m.id] && !live[m.id]!.is_forecast && live[m.id]!.delay_sec >= 120).sort((a, b) => live[b.id]!.delay_sec - live[a.id]!.delay_sec).slice(0, 3);
    lateNow.forEach((m, i) => out.splice(Math.min(out.length, 1 + i * 3), 0, { id: `l${m.id}`, node: <><i class="amt lost">●</i> {msg.ticker.late(String(m.params.routeName ?? ""), String(m.params.headsign ?? ""), Math.round(live[m.id]!.delay_sec / 60))}</> }));
    const fl = open.find((m) => (m.flash_multiplier ?? 1) > 1 && m.flash_until && Date.parse(m.flash_until) > now);
    if (fl) out.splice(Math.min(out.length, 2), 0, { id: `f${fl.id}`, node: <><b>{msg.ticker.flash(Number(fl.flash_multiplier))}</b> · {q(fl)}</> });
    for (const p of popular.slice(0, 2)) { const m = open.find((x) => x.id === p.market_id); if (m) out.push({ id: `p${m.id}`, node: <><b>{msg.ticker.crowd(p.bets)}</b> · {q(m)}</> }); }
    open.filter((m) => !m.params.ladderOf && Date.parse(m.closes_at) - now < 8 * 60_000 && Date.parse(m.closes_at) > now).slice(0, 2).forEach((m) => out.push({ id: `c${m.id}`, node: <><b>{msg.ticker.closing}</b> · {q(m)}</> }));
    if (isItalian) { const s = open.filter((m) => m.category === "strike").sort((a, b) => Date.parse(a.target_at) - Date.parse(b.target_at))[0]; if (s) out.push({ id: `s${s.id}`, node: <>{msg.ticker.strike(new Intl.DateTimeFormat(INTL_TAG[locale], { day: "numeric", month: "long", timeZone: "Europe/Rome" }).format(new Date(s.target_at)))}</> }); }
    msg.home.idle.forEach((s, i) => out.splice(Math.min(out.length, 1 + i * 2), 0, { id: `t${i}`, node: <>{s}</> }));
    return out;
  }, [activity, results, locale, open, live, popular, isItalian, Math.floor(now / 30000)]);

  const sources = useMemo(() => {
    const map = new Map<string, (typeof CITIES)[number]["feeds"][number]["attribution"]>();
    for (const c of CITIES) for (const f of c.feeds) if (f.licenseVerified && c.categories[f.category]?.enabled) map.set(f.attribution.name, f.attribution);
    // Added by the metric and earthquake questions (not tied to a city feed).
    const extra = [
      { name: "Ministero delle Infrastrutture e dei Trasporti — Scioperi", license: "Dati pubblici del MIT (nessuna licenza dichiarata)", licenseUrl: "https://scioperi.mit.gov.it", url: "https://scioperi.mit.gov.it" },
      { name: CROWD_SOURCE.name, via: CROWD_SOURCE.via, license: CROWD_SOURCE.license, licenseUrl: CROWD_SOURCE.licenseUrl, url: CROWD_SOURCE.url },
      { name: "Allerta Meteo Emilia-Romagna", license: "CC BY-NC-SA 4.0 (non commercial use)", licenseUrl: "https://allertameteo.regione.emilia-romagna.it/note-legali", url: "https://allertameteo.regione.emilia-romagna.it/" },
      { name: "TVmaze", license: "CC BY-SA (episode data and ratings)", licenseUrl: "https://www.tvmaze.com/api#licensing", url: "https://www.tvmaze.com" },
      { name: "Ticketmaster", license: "Discovery API, free key; event data © Ticketmaster (see their terms of use)", licenseUrl: "https://developer.ticketmaster.com/support/terms-of-use/", url: "https://www.ticketmaster.it" },
      { name: "TheSportsDB", license: "Free API key (see their terms); data © its contributors", licenseUrl: "https://www.thesportsdb.com/api.php", url: "https://www.thesportsdb.com" },
      { name: "Gold API (gold-api.com)", license: "Free price API, terms of service", licenseUrl: "https://gold-api.com/terms", url: "https://gold-api.com" },
      { name: "Ministero delle Imprese e del Made in Italy — Osservatorio prezzi carburanti", license: "IODL 2.0 (open data)", licenseUrl: "https://www.dati.gov.it/content/italian-open-data-license-v20", url: "https://www.mimit.gov.it/it/prezzo-medio-carburanti" },
      { name: "U.S. Energy Information Administration", license: "Public domain (US Government)", licenseUrl: "https://www.eia.gov/about/copyrights_reuse.php", url: "https://www.eia.gov/opendata/" },
      ...(detailsOn ? [{ name: "API-Football (API-Sports)", license: "Free plan (see their terms)", licenseUrl: "https://www.api-football.com/terms", url: "https://www.api-football.com" }] : []),
      { name: "Frankfurter (ECB euro reference rates)", license: "European Central Bank reference rates, free API without key", licenseUrl: "https://frankfurter.dev", url: "https://frankfurter.dev" },
      { name: "Carbon Intensity API (National Grid ESO)", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", url: "https://carbonintensity.org.uk" },
      { name: "Capital Bikeshare, Divvy, Bay Wheels, Bluebikes (Lyft Bikes and Scooters, on behalf of their cities)", license: "Lyft Bikes and Scooters data licence agreement (any lawful purpose)", licenseUrl: "https://capitalbikeshare.com/data-license-agreement", url: "https://gbfs.org" },
      { name: "Bike Share Toronto (Toronto Parking Authority)", license: "Open Government Licence – Toronto", licenseUrl: "https://open.toronto.ca/open-data-licence/", url: "https://open.toronto.ca/dataset/bike-share-toronto/" },
      { name: "Oslo Bysykkel (Urban Sharing)", license: "NLOD 2.0", licenseUrl: "https://data.norge.no/nlod/en/2.0", url: "https://oslobysykkel.no/en/open-data" },
      { name: "National Weather Service (alerts)", license: "Public domain (US Government)", licenseUrl: "https://www.weather.gov/disclaimer", url: "https://www.weather.gov" },
      { name: "Energy-Charts day-ahead prices (Bundesnetzagentur | SMARD.de)", license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", url: "https://www.energy-charts.info" },
      { name: "NOAA CO-OPS tides and water levels", license: "Public domain (US Government)", licenseUrl: "https://www.weather.gov/disclaimer", url: "https://tidesandcurrents.noaa.gov" },
      { name: "Pegelonline (Wasserstraßen- und Schifffahrtsverwaltung des Bundes)", license: "Data licence Germany – Zero 2.0", licenseUrl: "https://www.govdata.de/dl-de/zero-2-0", url: "https://www.pegelonline.wsv.de" },
      { name: "Crypto Fear & Greed Index (alternative.me)", license: "Free API, attribution to alternative.me required", licenseUrl: "https://alternative.me/crypto/fear-and-greed-index/", url: "https://alternative.me/crypto/fear-and-greed-index/" },
      { name: "Steam Web API and game images (Valve)", license: "Steam Web API Terms of Use", licenseUrl: "https://steamcommunity.com/dev/apiterms", url: "https://steamcommunity.com/dev" },
      { name: "CoinGecko API", license: "Free API, attribution required", licenseUrl: "https://www.coingecko.com/en/api/documentation", url: "https://www.coingecko.com" },
      { name: "NOAA Space Weather Prediction Center", license: "Public domain (US Government)", licenseUrl: "https://www.weather.gov/disclaimer", url: "https://www.swpc.noaa.gov" },
      { name: "Wikimedia Foundation (page views)", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/", url: "https://wikimedia.org/api/rest_v1/" },
      { name: "USGS Earthquake Hazards Program", license: "Public domain", licenseUrl: "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits", url: "https://earthquake.usgs.gov" },
      { name: "Copernicus Atmosphere Monitoring Service", via: "Open-Meteo", license: "Copernicus licence", licenseUrl: "https://atmosphere.copernicus.eu/terms-of-use", url: "https://open-meteo.com/en/docs/air-quality-api" },
    ];
    return [...map.values(), ...extra] as NonNullable<ReturnType<typeof map.values> extends IterableIterator<infer T> ? T : never>[];
  }, [detailsOn]);

  // ---------- results (Esito) ----------
  const unseen = bets.filter((b) => b.status !== "open" && !seen.has(b.id));
  useEffect(() => { if (ready && !resultBet && !sheet && !auth && !nick && unseen.length > 0) { const b = unseen[0]!; setResultBet(b); announce(`res-${b.id}`, b.status === "won" ? msg.voice.won(money(b.payout - b.stake, locale)) : b.status === "lost" ? msg.voice.lost : msg.bets.void, locale); } }, [ready, unseen.map((b) => b.id).join(), !!sheet, auth, nick]);
  const markSeen = (id: string) => { const n = new Set(seen); n.add(id); setSeen(n); store.set(seenKey, JSON.stringify([...n].slice(-300))); };
  const closeResult = () => { if (resultBet) markSeen(resultBet.id); setResultBet(null); };

  // ---------- actions ----------
  const place = async (m: MarketRow, pick: Pick, stake: number, boost = false, bonus: string | null = null, vice = false, offerId: string | null = null) => {
    if (offline) return msg.common.offline;
    const before = { bonus: progress?.bonus_claimed ?? false, trophies: new Set(trophies), streak: profile?.streak ?? 0 };
    const baseOdds = Number(pick === "yes" ? m.odds_yes : m.odds_no), betOdds = offerId && sheet?.offer ? offerOdds(baseOdds, sheet.offer.mult) : baseOdds;
    const { error } = await sb.rpc("place_bet", { p_market: m.id, p_pick: pick, p_stake: stake, p_boost: boost, ...(bonus ? { p_bonus: bonus } : {}), ...(vice ? { p_vice: true } : {}), ...(offerId ? { p_offer: offerId } : {}) });
    if (error) return (offerId ? offerErrorText(error.message, locale) : null) ?? msg.errors[Object.keys(msg.errors).find((k) => error.message.includes(k)) ?? "generic"]!;
    setSheet(null);
    if (offerId) dispatchEvent(new Event(OFFER_EVENT));
    const [pf] = await Promise.all([loadProfile(), loadBets(), loadQuests(), loadMarkets(), loadChallenges()]);
    const reached = pf && pf.streak > before.streak ? STREAK_MILESTONES[pf.streak] : undefined;
    const [pr, tr] = [await loadProgress(), await loadTrophies()];
    const won = TROPHY_IDS.filter((id) => tr.has(id) && !before.trophies.has(id));
    if (won.length) { setFresh(new Set(won)); flash(`${msg.profile.trophy[won[0]!].name}`); }
    else if (reached) { flash(msg.streak.milestone(pf!.streak, `+${money(reached, locale)}`)); haptic.success(); }
    else if (pr?.bonus_claimed && !before.bonus) flash(`${msg.home.missionsDone} · +${money(RING_BONUS, locale)}`);
    else flash(msg.sheet.placed(money(Math.floor(stake * betOdds), locale)));
    if (pushAvailable() && !pushAsked() && !pushDenied()) setTimeout(() => setAskPush(true), 1500);
    announce(`placed-${m.id}`, msg.voice.placed(money(Math.floor(stake * betOdds), locale)), locale);
    return null;
  };
  const addSlip = (m: MarketRow, pick: Pick) => { setSlip((s) => (s.some((l) => l.m.id === m.id) ? s : [...s, { m, pick }])); setSheet(null); flash(`${msg.slip.added} · ${msg.slip.bar(slip.some((l) => l.m.id === m.id) ? slip.length : slip.length + 1)}`); haptic.tap(); };
  const placeParlay = async (legs: SlipLeg[], stake: number, boost = false) => {
    if (offline) return msg.common.offline;
    const { error } = await sb.rpc("place_parlay", { p_legs: legs.map((l) => ({ market: l.m.id, pick: l.pick })), p_stake: stake, p_boost: boost });
    if (error) return msg.errors[Object.keys(msg.errors).find((k) => error.message.includes(k)) ?? "generic"]!;
    const win = money(Math.floor(stake * slipOdds(legs)), locale);
    setSlip([]); setParlayOpen(false);
    await Promise.all([loadProfile(), loadParlays(), loadProgress(), loadTrophies(), loadQuests(), loadMarkets(), loadChallenges()]);
    flash(msg.slip.placed(win)); announce(`parlay-${Date.now()}`, msg.voice.placed(win), locale);
    return null;
  };
  /** Opens one reason (goal, double chance…) of a match from a featured card: the market is made once, on tap, then the bet sheet opens. */
  const openMatchBet = async (sib: MarketRow, bet: string) => {
    if (!registered) { setAuth(true); return; }
    const { data } = await sb.functions.invoke("market-offer", { body: { type: "match", eventId: String(sib.params.eventId), bet } });
    const m = data?.market as MarketRow | undefined;
    if (m) { setSheet({ m, pick: "yes" }); loadMarkets(); } else flash(msg.sportui.unavailable, "err");
  };
  const pickPlace = async (pl: Place) => {
    // register the place on the server first: the id it returns is the one the markets carry
    try { const sid = await ensurePlace(pl); pl = { ...pl, id: sid }; } catch (e) { flash(String((e as Error).message).includes("places_limit") ? msg.places.limit : msg.errors.generic!, "err"); return; }
    setMyPlaces(rememberPlace(pl)); placeIds.current = [pl.id, ...placeIds.current.filter((x) => x !== pl.id)].slice(0, 6);
    setPlacePicker(false); store.set("filter", pl.id); setFilter(pl.id); setCatChosen(true); await loadMarkets();
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
    go(); return every(go, 120_000);
  }, [near?.id]);
  const origin = useMemo(() => {
    if (home) return { lat: home.lat, lon: home.lon, name: home.name };
    if (near) { const c = cityOf(near.id); if (c.location && (c.location.lat || c.location.lon)) return { lat: c.location.lat, lon: c.location.lon, name: near.name }; }
    return null;
  }, [home?.id, home?.lat, near?.id]);
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
  const claimMission = async (id: string) => {
    const { data, error } = await sb.rpc("claim_mission", { p_id: id });
    if (error) { flash(msg.errors.generic!, "err"); return; }
    if (+data > 0) { flash(msg.dm.got(`+${money(+data, locale)}`)); haptic.success(); }
    await Promise.all([loadProfile(), loadQuests()]);
  };
  const claimFlash = async () => {
    const { data, error } = await sb.rpc("claim_flash");
    if (error) { flash(msg.errors.generic!, "err"); return; }
    const r = data as { credits: number; boosts: number; decoration?: string | null };
    if (r.decoration) setTimeout(() => { flash(msg.look.newDrop(msg.look.deco[r.decoration!] ?? r.decoration!)); loadLook(); }, 2600);
    if (r.credits > 0) { flash(msg.dm.flash.got(`+${money(r.credits, locale)}`, r.boosts)); haptic.success(); }
    await Promise.all([loadProfile(), loadQuests()]);
  };
  const claimChest = async () => {
    const { data, error } = await sb.rpc("claim_chest");
    if (error) { flash(msg.errors.generic!, "err"); return; }
    const r = data as { credits: number; boosts: number; decoration?: string | null };
    if (r.decoration) setTimeout(() => { flash(msg.look.newDrop(msg.look.deco[r.decoration!] ?? r.decoration!)); loadLook(); }, 2600);
    if (r.credits > 0) { flash(msg.dm.chestOpened(`+${money(r.credits, locale)}`, r.boosts)); haptic.success(); }
    await Promise.all([loadProfile(), loadQuests()]);
  };
  const claimable = quests.filter((q) => q.done && !q.claimed).length + (missions ? missions.missions.filter((m) => m.progress >= m.target && !m.claimed).length + (missions.chest.ready && !missions.chest.claimed ? 1 : 0) : 0) + (flashM && flashM.progress >= flashM.target && !flashM.claimed ? 1 : 0);
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
  const signOut = async () => { await sb.auth.signOut(); setProfile(null); setBets([]); setParlays([]); setProgress(null); setTrophies(new Set()); setReferral(null); setMissions(null); setFlashM(null); setQuests([]); setLook(null); setReqCount(0); store.set("lvl", ""); setReady(false); await bootstrap(); };
  const deleteAccount = async () => {
    const { error } = await sb.rpc("delete_my_account");
    if (error) { flash(msg.errors.generic!, "err"); return; }
    await sb.auth.signOut({ scope: "local" }); setProfile(null); setBets([]); setParlays([]); setProgress(null); setTrophies(new Set()); setReferral(null); setMissions(null); setFlashM(null); setQuests([]); setLook(null); setReqCount(0); store.set("lvl", ""); setReady(false); setScreen("home");
    await bootstrap(); flash(msg.profile.delete.done);
  };
  const changeLocale = (l: Locale) => { store.set("locale", l); setLocale(l); };
  const social = registered && !!profile?.display_name;
  useEffect(() => { if (screen === "friends" && !social && ready) setScreen("home"); }, [screen, social, ready]);
  const go = (s: Screen) => { if (s === "profile" && giftDot) { store.set("giftdot", "0"); setGiftDot(false); } setScreen(s); scrollTo({ top: 0 }); haptic.tap(); };
  const openBets = bets.filter((b) => b.status === "open").length + invites.length;

  return (
    <div class="shell">
      <Sidebar value={screen === "admin" ? "profile" : screen} onPick={go} msg={msg} openBets={openBets} profileDot={giftDot} rankBadge={reqCount} social={social} />
      <div>
        <Header satire={msg.home.satire} claimable={claimable} onWallet={() => setRewardsOpen(true)} voice={voiceSupported() ? { on: voiceOn, label: msg.voice.label, toggle: toggleVoice } : null} locale={locale} onLocale={changeLocale} wallet={profile ? new Intl.NumberFormat(INTL_TAG[locale]).format(Math.round(wallet)) : "···"} coin={currencySymbol(locale)} languageLabel={msg.common.language} creditsLabel={msg.common.credits} onHome={() => go("home")} />
        <OfflineBar offline={offline} msg={msg} onRetry={() => { loadMarkets(); setOffline(!navigator.onLine); }} />
        <Ticker items={tickerItems} />
        <main class="content">
          {screen === "home" && <Home onOffer={(m, o) => setSheet({ m, pick: "yes", offer: o })} onSeries={(s) => setSeriesMaker({ show: s ?? null })} occ={occ} friendBets={friendBets} details={detailsOn} stale={staleCats.includes(cat)} registered={registered} onAuth={() => setAuth(true)} nearbyNode={<NearbyBets msg={msg} locale={locale} now={now} origin={origin} home={home} onHome={changeHome} onLocate={locate} onChallenge={(code) => setChallengeCode(code)} country={near?.country ?? profile?.country ?? region()} busy={locating} popular={nearItems.items} fallback={nearItems.fallback} zone={near ? msg.near.zone(near.name) : null} onPick={(m, pick) => setSheet({ m, pick })} />} onCreate={() => (registered ? setMaker(true) : setAuth(true))} onQuakeMaker={() => setQuakeMaker(true)} italian={isItalian} msg={msg} locale={locale} now={now} markets={markets} list={list} live={live} cat={cat} counts={counts} onCat={(c) => { setCatChosen(true); setCat(c); haptic.tap(); }} mine={hasMine ? myCountry : null} country={myCountry} homePos={home ? { lat: home.lat, lon: home.lon } : null} filter={filter} onFilter={(f) => { store.set("filter", f); setFilter(f); setCatChosen(true); }} top={top} onPick={(m, pick) => setSheet({ m, pick })} trending={trending} places={myPlaces.filter((pl) => pl.id === filter)} onPlace={(pl) => { setPlacePending(pl); pickPlace(pl); }} onMorePlaces={() => setPlacePicker(true)} ladders={ladders} outlook={outlook} attributions={sources} installEvt={installEvt} />}
          {screen === "bets" && <Bets canMore={bets.length >= betsLimit} onMore={() => setBetsLimit((n) => n + 60)} invites={invites} challenges={myChallenges} onChallenge={(code) => setChallengeCode(code)} parlays={parlays} bets={bets} msg={msg} locale={locale} now={now} onOpen={setResultBet} onHome={() => go("home")} />}
          {screen === "friends" && <Friends reqTick={reqTick} onReqs={loadReqs} onProfile={setPubUser} referral={referral} onShareReferral={shareReferral} onChallenge={() => (registered ? setChallengeMaker(true) : setAuth(true))} onOpen={(code) => setChallengeCode(code)} locale={locale} msg={msg} registered={registered} onToast={flash} onAuth={() => setAuth(true)} now={now} />}
          {screen === "ranking" && <Ranking onProfile={setPubUser} home={home} onHome={changeHome} locale={locale} msg={msg} profile={profile} registered={registered} onToast={flash} onAuth={() => setAuth(true)} onNickname={() => setNick(true)} onRank={(r, s) => setRank({ rank: r, scope: s })} />}
          {screen === "admin" && <AdminPage msg={msg} onBack={() => go("profile")} />}
          {screen === "profile" && <ProfileView look={look} onLook={() => setLookOpen(true)} homeNode={<CityChip msg={msg} locale={locale} value={home} onChange={changeHome} />} onAdmin={() => go("admin")} giftCard={giftCard} onGiftSeen={() => { store.set("giftcard", "0"); setGiftCard(false); }} push={pushAvailable() ? { on: pushOn, denied: pushDenied(), toggle: () => turnPush(!pushOn), flash: !!profile?.push_flash, streak: !!profile?.push_streak, friends: !!profile?.push_friends, setPrefs: async (f: boolean, s: boolean, fr: boolean) => { await sb.rpc("set_push_prefs", { p_flash: f, p_streak: s, p_friends: fr }); loadProfile(); } } : null} referral={referral} onShareReferral={shareReferral} progress={progress} msg={msg} locale={locale} onLocale={changeLocale} profile={profile} email={email} registered={registered} trophies={trophies} fresh={fresh} onAuth={() => setAuth(true)} onNickname={() => setNick(true)} onShareProfile={shareProfile} onSignOut={signOut} onDelete={deleteAccount} sources={sources} />}
        </main>
      </div>
      <TabBar value={screen === "admin" ? "profile" : screen} onPick={go} msg={msg} openBets={openBets} profileDot={giftDot} rankBadge={reqCount} social={social} />

      {maker && <MarketMaker origin={origin} msg={msg} locale={locale} registered={registered} places={[...CITIES.filter((c) => c.categories.weather?.enabled).map((c) => ({ id: c.id, name: cityName(c, locale) })), ...myPlaces.map((pl) => ({ id: pl.id, name: pl.name }))]} onClose={() => setMaker(false)} onQuake={() => { setMaker(false); setQuakeMaker(true); }} onFriends={() => { setMaker(false); setChallengeMaker(true); }} onCreated={(m) => { setMaker(false); loadMarkets(); setSheet({ m, pick: "yes" }); }} />}
      {challengeMaker && <ChallengeMaker hasHome={!!home} msg={msg} locale={locale} registered={registered} onAuth={() => { setChallengeMaker(false); setAuth(true); }} onClose={() => setChallengeMaker(false)} onCreated={(code) => { setChallengeMaker(false); loadChallenges(); flash(msg.friends.created); setChallengeCode(code); }} />}
      {challengeCode && <ChallengeSheet code={challengeCode} msg={msg} locale={locale} now={now} registered={registered} onClose={() => { setChallengeCode(null); loadChallenges(); }} onAuth={() => { setChallengeCode(null); setAuth(true); }} onChanged={() => { loadProfile(); loadChallenges(); }} onDeleted={(text) => { setChallengeCode(null); flash(text); }} />}
      {seriesMaker && <SeriesMaker msg={msg} locale={locale} initial={seriesMaker.show} onClose={() => setSeriesMaker(null)} onCreated={(m) => { setSeriesMaker(null); loadMarkets(); setSheet({ m, pick: "yes" }); }} />}
      {quakeMaker && <QuakeMaker msg={msg} locale={locale} onClose={() => setQuakeMaker(false)} onCreated={(m) => { setQuakeMaker(false); loadMarkets(); setSheet({ m, pick: "yes" }); }} />}
      {placePicker && <PlacePicker msg={msg} locale={locale} recent={myPlaces} onPick={pickPlace} onCity={(id) => { store.set("filter", id); setFilter(id); setCatChosen(true); setPlacePicker(false); }} onClose={() => setPlacePicker(false)} />}
      {rewardsOpen && <RewardsSheet flash={flashM} onClaimFlash={claimFlash} missions={missions} onClaimMission={claimMission} onClaimChest={claimChest} msg={msg} locale={locale} now={now} profile={profile} quests={quests} referral={referral} registered={registered} onClaim={claimQuest} onGo={goQuest} onShare={shareReferral} onClose={() => setRewardsOpen(false)} />}
      {askPush && <PushAsk lifted={slip.length > 0} msg={msg} onYes={() => turnPush(true)} onNo={() => { rememberPush(false); setAskPush(false); }} />}
      <ParlayBar count={slip.length} odds={slipOdds(slip)} msg={msg} locale={locale} onOpen={() => setParlayOpen(true)} />
      {sheet && <BetSheet offer={sheet.offer} now={now} occ={occ[sheet.m.id]} mm={outlook[sheet.m.id]} boosts={profile?.boosts ?? 0} key={sheet.m.id} m={sheet.m} initial={sheet.pick} msg={msg} locale={locale} credits={profile?.credits ?? 0} ready={ready} needJoin={needJoin} googleOn={googleOn} inSlip={slipIds.has(sheet.m.id)} ladder={ladders[String(sheet.m.params.ladderOf ?? sheet.m.id)] ?? []} onSwitch={(x) => setSheet({ m: x, pick: "yes" })} onClose={() => setSheet(null)} onAddSlip={addSlip} onJoined={async () => {}} onPlace={place} />}
      {parlayOpen && slip.length > 0 && <ParlaySheet boosts={profile?.boosts ?? 0} legs={slip} msg={msg} locale={locale} credits={profile?.credits ?? 0} needJoin={needJoin} googleOn={googleOn} onClose={() => setParlayOpen(false)} onRemove={(id) => setSlip((s) => s.filter((l) => l.m.id !== id))} onClear={() => { setSlip([]); setParlayOpen(false); }} onJoined={async () => {}} onPlace={placeParlay} />}
      {auth && <AuthSheet msg={msg} guest={!registered} googleOn={googleOn} onClose={() => setAuth(false)} onDone={(text) => { setAuth(false); flash(text); }} />}
      {lookOpen && look && <LookSheet progress={look} msg={msg} myId={profile?.id ?? ""} onClose={() => setLookOpen(false)} onSaved={(p) => { setLook(p); flash(msg.look.saved); }} />}
      {pubUser && <PublicProfile id={pubUser} msg={msg} locale={locale} onClose={() => { setPubUser(null); loadReqs(); setReqTick((n) => n + 1); }} onToast={flash} />}
      {nick && <NicknameSheet msg={msg} current={profile?.display_name ?? null} onClose={() => setNick(false)} onSaved={(n) => { setNick(false); loadProfile(); loadQuests(); flash(n); }} />}
      {resultBet && <ResultScreen bet={resultBet} msg={msg} locale={locale} remaining={Math.max(0, unseen.filter((b) => b.id !== resultBet.id).length)} onClose={closeResult} onShare={shareResult} onNext={() => { markSeen(resultBet.id); const next = unseen.find((b) => b.id !== resultBet.id); setResultBet(next ?? null); }} />}
      {toast && <Toast text={toast.text} kind={toast.kind} lift={slip.length > 0} />}
    </div>
  );
}
