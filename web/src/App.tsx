import { Clock, MapPin, TrendingUp, Users, Zap } from "lucide-preact";
import { RING_BONUS, STREAK_MILESTONES } from "../../shared/rewards.ts";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { AuthSheet } from "./components/AuthSheet.tsx";
import { BetSheet } from "./components/BetSheet.tsx";
import type { CatId } from "./components/CatChips.tsx";
import { Header } from "./components/Header.tsx";
import { Sidebar, TabBar, type Screen } from "./components/Nav.tsx";
import { NicknameSheet } from "./components/NicknameSheet.tsx";
import { ResultScreen } from "./components/ResultScreen.tsx";
import { Toast } from "./components/Toast.tsx";
import type { TopItem } from "./components/TopCards.tsx";
import { INTL_TAG, t, TROPHY_IDS, type Locale } from "./i18n/index.ts";
import { useCountUp } from "./lib/anim.ts";
import { ensureGuest, sb } from "./lib/api.ts";
import { CITIES, cityInfos, cityName, cityOf } from "./lib/cities.ts";
import { useNow } from "./lib/clock.ts";
import { pickCity, pickLocale } from "./lib/detect.ts";
import { countdown, currencySymbol, dayIn, money, question, type MarketRow } from "./lib/format.ts";
import { haptic } from "./lib/haptics.ts";
import { makeProfileCard, makeResultCard, shareImage } from "./lib/share.ts";
import type { LiveDelay, MyBet, MyStats, Pick, PopularRow, Profile, Progress, ResultRow } from "./lib/types.ts";
import { Bets } from "./views/Bets.tsx";
import { Home } from "./views/Home.tsx";
import { ProfileView } from "./views/Profile.tsx";
import { Ranking } from "./views/Ranking.tsx";

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const region = () => { try { return new Intl.Locale(navigator.language).maximize().region ?? null; } catch { return null; } };
const PROFILE_COLS = "id,credits,city_id,locale,timezone,country,streak,best_streak,freezes,display_name,last_play_date";
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
  const [installEvt, setInstallEvt] = useState<Event | null>(null);

  const msg = t(locale);
  const tz = profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
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

  /** Guest session + wallet. Runs at start and again after signing in or out. */
  const bootstrap = useCallback(async () => {
    const uid = await ensureGuest(); if (!uid) return;
    const prefer = store.get("city") || pickCity(cityInfos(), { country: region(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, locale });
    await sb.rpc("ensure_profile", { p_city: prefer, p_locale: locale, p_country: region() });
    await sb.rpc("claim_daily_refill");
    const p = await loadProfile(); setSeen(new Set(JSON.parse(store.get(`seen.${uid}`) ?? "[]")));
    await Promise.all([loadTrophies(), loadBets(), loadProgress(p?.timezone)]);
    setReady(true);
  }, [locale]);

  useEffect(() => {
    const sub = sb.auth.onAuthStateChange((event, s) => {
      const u = s?.user; setRegistered(!!u && !u.is_anonymous && !!u.email); setEmail(u?.email ?? null);
      if (event === "SIGNED_IN" || event === "USER_UPDATED") setTimeout(() => bootstrap(), 0);
    });
    bootstrap().catch(() => {});
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY } }).then((r) => r.json()).then((s) => setGoogleOn(!!s?.external?.google)).catch(() => {});
    return () => sub.data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (profile && !profile.country && region()) sb.rpc("set_country", { p_country: region() }).then(loadProfile); }, [profile?.id]);

  const loadMarkets = useCallback(async () => {
    const { data, error } = await sb.from("markets").select("id,city_id,category,kind,params,closes_at,target_at,odds_yes,odds_no,status,flash_multiplier,flash_until,flash_kind").eq("status", "open").gt("closes_at", new Date().toISOString()).order("closes_at").limit(300);
    if (!error) setMarkets((data ?? []) as MarketRow[]);
    const { data: h } = await sb.from("feed_health").select("feed_id,last_ok_at");
    const nowMs = Date.now();
    setStale((h ?? []).some((r) => { const f = CITIES.flatMap((c) => c.feeds).find((x) => x.id === r.feed_id); return !!f && f.category !== "weather" && f.licenseVerified && !!r.last_ok_at && nowMs - Date.parse(r.last_ok_at) > f.staleAfterSeconds * 1000 && (data ?? []).some((m) => m.category === f.category); }));
    const { data: pop } = await sb.rpc("popular_markets", { p_limit: 5 }); setPopular(((pop ?? []) as PopularRow[]).map((x) => ({ ...x, bets: +x.bets })));
  }, []);
  const loadResults = useCallback(async () => { const { data } = await sb.from("markets").select("id,city_id,kind,status,outcome,void_reason,params,evidence").neq("status", "open").order("target_at", { ascending: false }).limit(12); setResults((data ?? []) as ResultRow[]); }, []);
  useEffect(() => { loadMarkets(); loadResults(); const a = setInterval(loadMarkets, 30000), b = setInterval(loadResults, 60000); return () => { clearInterval(a); clearInterval(b); }; }, [loadMarkets, loadResults]);
  useEffect(() => { if (!ready) return; const i = setInterval(() => { loadBets(); loadProfile(); }, 30000); return () => clearInterval(i); }, [ready]);

  const trackable = useMemo(() => (markets ?? []).filter((m) => m.kind !== "rain_at" && Date.parse(m.target_at) - Date.now() < 3 * 3600_000).slice(0, 80).map((m) => m.id), [markets]);
  useEffect(() => {
    if (trackable.length === 0) { setLive({}); return; }
    const go = () => sb.rpc("live_delays", { p_markets: trackable }).then(({ data }) => setLive(Object.fromEntries(((data ?? []) as LiveDelay[]).map((d) => [d.market_id, d]))));
    go(); const i = setInterval(go, 15000); return () => clearInterval(i);
  }, [trackable.join()]);

  // ---------- derived ----------
  const open = useMemo(() => (markets ?? []).filter((m) => Date.parse(m.closes_at) > now), [markets, Math.floor(now / 1000)]);
  const inFilter = useMemo(() => open.filter((m) => filter === "world" || m.city_id === filter), [open, filter]);
  const byCat = (c: CatId) => inFilter.filter((m) => m.category === c);
  useEffect(() => { if (catChosen || !markets) return; const first = (["bus", "train", "weather"] as CatId[]).find((c) => byCat(c).length > 0); if (first && byCat(cat).length === 0) setCat(first); }, [markets, filter, catChosen]);
  const flashFirst = (a: MarketRow[]) => [...a].sort((x, y) => Number((y.flash_multiplier ?? 1) > 1) - Number((x.flash_multiplier ?? 1) > 1));
  const list = flashFirst(byCat(cat));
  const counts: Record<CatId, number> = { bus: byCat("bus").length, train: byCat("train").length, weather: byCat("weather").length, traffic: 0 };

  const top: TopItem[] = useMemo(() => {
    const items: TopItem[] = [];
    const fl = open.filter((m) => (m.flash_multiplier ?? 1) > 1 && m.flash_until && Date.parse(m.flash_until) > now && (filter === "world" || m.city_id === filter))[0];
    if (fl) items.push({ id: "flash", icon: Zap, label: msg.streak.flash, big: <>×{fl.flash_multiplier}<small class="num">{countdown(Date.parse(fl.flash_until!) - now)}</small></>, sub: question(fl, msg, locale, cityName(cityOf(fl.city_id), locale), cityOf(fl.city_id).timezone, new Date(now)), onClick: () => setSheet({ m: fl, pick: "yes" }) });
    const facts = inFilter.filter((m) => live[m.id] && !live[m.id]!.is_forecast && live[m.id]!.delay_sec >= 60).sort((a, b) => live[b.id]!.delay_sec - live[a.id]!.delay_sec)[0];
    if (facts) items.push({ id: "late", icon: TrendingUp, label: msg.top.late, big: <>+{Math.round(live[facts.id]!.delay_sec / 60)}<small>min</small></>, sub: `${facts.params.routeName ?? ""} → ${facts.params.headsign ?? ""}`, onClick: () => setSheet({ m: facts, pick: "yes" }) });
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

  const liveItems = useMemo(() => {
    const out: string[] = [];
    for (const r of results) {
      const c = cityOf(r.city_id), route = String(r.params.routeName ?? ""), stop = String(r.params.stopName ?? "");
      out.push(r.status === "void" ? `${route || cityName(c, locale)}: ${msg.bets.void}` : r.kind === "rain_at" ? `${cityName(c, locale)}: ${r.outcome === "yes" ? msg.card.yes : msg.card.no}` : `${route}${stop ? ` · ${stop}` : ""}: ${r.outcome === "yes" ? msg.card.late : msg.card.onTime}`);
    }
    msg.home.idle.forEach((s, i) => out.splice(Math.min(out.length, 1 + i * 2), 0, s));
    return out;
  }, [results, locale]);

  const sources = useMemo(() => {
    const map = new Map<string, (typeof CITIES)[number]["feeds"][number]["attribution"]>();
    for (const c of CITIES) for (const f of c.feeds) if (f.licenseVerified && c.categories[f.category]?.enabled) map.set(f.attribution.name, f.attribution);
    return [...map.values()];
  }, []);

  // ---------- results (Esito) ----------
  const unseen = bets.filter((b) => b.status !== "open" && !seen.has(b.id));
  useEffect(() => { if (ready && !resultBet && !sheet && !auth && !nick && unseen.length > 0) setResultBet(unseen[0]!); }, [ready, unseen.map((b) => b.id).join(), !!sheet, auth, nick]);
  const markSeen = (id: string) => { const n = new Set(seen); n.add(id); setSeen(n); store.set(seenKey, JSON.stringify([...n].slice(-300))); };
  const closeResult = () => { if (resultBet) markSeen(resultBet.id); setResultBet(null); };

  // ---------- actions ----------
  const place = async (m: MarketRow, pick: Pick, stake: number) => {
    const before = { bonus: progress?.bonus_claimed ?? false, trophies: new Set(trophies), streak: profile?.streak ?? 0 };
    const { error } = await sb.rpc("place_bet", { p_market: m.id, p_pick: pick, p_stake: stake });
    if (error) return msg.errors[Object.keys(msg.errors).find((k) => error.message.includes(k)) ?? "generic"]!;
    setSheet(null);
    const [pf] = await Promise.all([loadProfile(), loadBets()]);
    const reached = pf && pf.streak > before.streak ? STREAK_MILESTONES[pf.streak] : undefined;
    const [pr, tr] = [await loadProgress(), await loadTrophies()];
    const won = TROPHY_IDS.filter((id) => tr.has(id) && !before.trophies.has(id));
    if (won.length) { setFresh(new Set(won)); flash(`${msg.profile.trophy[won[0]!].name}`); }
    else if (reached) { flash(msg.streak.milestone(pf!.streak, `+${money(reached, locale)}`)); haptic.success(); }
    else if (pr?.bonus_claimed && !before.bonus) flash(`${msg.home.missionsDone} · +${money(RING_BONUS, locale)}`);
    else flash(msg.sheet.placed(money(Math.floor(stake * Number(pick === "yes" ? m.odds_yes : m.odds_no)), locale)));
    return null;
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
  const go = (s: Screen) => { setScreen(s); scrollTo({ top: 0 }); haptic.tap(); };
  const openBets = bets.filter((b) => b.status === "open").length;

  return (
    <div class="shell">
      <Sidebar value={screen} onPick={go} msg={msg} openBets={openBets} />
      <div>
        <Header locale={locale} onLocale={changeLocale} wallet={profile ? new Intl.NumberFormat(INTL_TAG[locale]).format(Math.round(wallet)) : "···"} coin={currencySymbol(locale)} languageLabel={msg.common.language} creditsLabel={msg.common.credits} onHome={() => go("home")} />
        <main class="content">
          {offline && <p class="note" style="margin-bottom:12px">{msg.common.offline}</p>}
          {stale && <p class="note warn" style="margin-bottom:12px">{msg.feedWarning}</p>}
          {screen === "home" && <Home msg={msg} locale={locale} now={now} markets={markets} list={list} live={live} cat={cat} counts={counts} onCat={(c) => { setCatChosen(true); setCat(c); haptic.tap(); }} filter={filter} onFilter={(f) => { store.set("filter", f); setFilter(f); }} top={top} liveItems={liveItems} onPick={(m, pick) => setSheet({ m, pick })} attributions={sources} installEvt={installEvt} />}
          {screen === "bets" && <Bets bets={bets} msg={msg} locale={locale} now={now} onOpen={setResultBet} onHome={() => go("home")} />}
          {screen === "ranking" && <Ranking msg={msg} profile={profile} registered={registered} onToast={flash} onAuth={() => setAuth(true)} onNickname={() => setNick(true)} onRank={(r, s) => setRank({ rank: r, scope: s })} />}
          {screen === "profile" && <ProfileView progress={progress} msg={msg} locale={locale} onLocale={changeLocale} profile={profile} email={email} registered={registered} trophies={trophies} fresh={fresh} onAuth={() => setAuth(true)} onNickname={() => setNick(true)} onShareProfile={shareProfile} onSignOut={signOut} onDelete={deleteAccount} sources={sources} />}
        </main>
      </div>
      <TabBar value={screen} onPick={go} msg={msg} openBets={openBets} />

      {sheet && <BetSheet m={sheet.m} initial={sheet.pick} msg={msg} locale={locale} credits={profile?.credits ?? 0} ready={ready} onClose={() => setSheet(null)} onPlace={place} />}
      {auth && <AuthSheet msg={msg} guest={!registered} googleOn={googleOn} onClose={() => setAuth(false)} onDone={(text) => { setAuth(false); flash(text); }} />}
      {nick && <NicknameSheet msg={msg} current={profile?.display_name ?? null} onClose={() => setNick(false)} onSaved={(n) => { setNick(false); loadProfile(); flash(n); }} />}
      {resultBet && <ResultScreen bet={resultBet} msg={msg} locale={locale} remaining={Math.max(0, unseen.filter((b) => b.id !== resultBet.id).length)} onClose={closeResult} onShare={shareResult} onNext={() => { markSeen(resultBet.id); const next = unseen.find((b) => b.id !== resultBet.id); setResultBet(next ?? null); }} />}
      {toast && <Toast text={toast.text} kind={toast.kind} />}
    </div>
  );
}
