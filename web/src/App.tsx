import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { Board } from "./components/Board.tsx";
import { BetSheet } from "./components/BetSheet.tsx";
import { Mascot, Icon } from "./components/Brand.tsx";
import { Chips } from "./components/Chips.tsx";
import { Hero } from "./components/Hero.tsx";
import { MarketCard, catIcon } from "./components/MarketCard.tsx";
import { Ticker, type TickItem } from "./components/Ticker.tsx";
import { INTL_TAG, LOCALES, t, TROPHY_IDS, type Locale } from "./i18n/index.ts";
import { confetti, useCountUp } from "./lib/anim.ts";
import { ensureGuest, sb } from "./lib/api.ts";
import { CITIES, cityInfos, cityName, cityOf, enabledCategories } from "./lib/cities.ts";
import { useNow } from "./lib/clock.ts";
import { pickCity, pickLocale } from "./lib/detect.ts";
import { dayIn, flag, seasonDaysLeft, type MarketRow } from "./lib/format.ts";
import type { LiveDelay, MyBet, Pick, Profile, Progress, ResultRow } from "./lib/types.ts";
import { Missions } from "./views/Missions.tsx";
import { Mine } from "./views/Mine.tsx";
import { Ranking } from "./views/Ranking.tsx";

type Nav = "events" | "missions" | "ranking" | "mine";
type Cat = "bus" | "train" | "weather" | "traffic";

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const region = () => { try { return new Intl.Locale(navigator.language).maximize().region ?? null; } catch { return null; } };
const PROFILE_COLS = "id,credits,city_id,locale,timezone,country,streak,best_streak,freezes,display_name,last_play_date";

export function App() {
  const now = useNow();
  const [locale, setLocale] = useState<Locale>(() => (store.get("locale") as Locale) || pickLocale(navigator.languages ?? [navigator.language]));
  const [filter, setFilter] = useState<string>(() => store.get("filter") || "world");
  const [cat, setCat] = useState<Cat>("bus");
  const [catChosen, setCatChosen] = useState(false);
  const [nav, setNav] = useState<Nav>("events");
  const [markets, setMarkets] = useState<MarketRow[] | null>(null);
  const [live, setLive] = useState<Record<string, LiveDelay>>({});
  const [results, setResults] = useState<ResultRow[]>([]);
  const [bets, setBets] = useState<MyBet[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [trophies, setTrophies] = useState<Set<string>>(new Set());
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [registered, setRegistered] = useState(false);
  const [ready, setReady] = useState(false);
  const [sheet, setSheet] = useState<{ m: MarketRow; pick: Pick } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [showSave, setShowSave] = useState(false);
  const [saveBar, setSaveBar] = useState(false);
  const [rank, setRank] = useState<{ rank: number | null; scope: string }>({ rank: null, scope: "" });
  const [installEvt, setInstallEvt] = useState<Event | null>(null);

  const msg = t(locale);
  const homeCity = profile ? cityOf(profile.city_id) : cityOf(pickCity(cityInfos(), { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, locale }));
  const tz = profile?.timezone ?? homeCity.timezone;
  const wallet = useCountUp(profile?.credits ?? 0, 800);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3800); };

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    const bip = (e: Event) => { e.preventDefault(); setInstallEvt(e); };
    addEventListener("online", on); addEventListener("offline", off); addEventListener("beforeinstallprompt", bip);
    return () => { removeEventListener("online", on); removeEventListener("offline", off); removeEventListener("beforeinstallprompt", bip); };
  }, []);

  const loadProfile = useCallback(async () => {
    const { data } = await sb.from("profiles").select(PROFILE_COLS).maybeSingle();
    if (data) setProfile(data as Profile);
  }, []);
  const loadProgress = useCallback(async () => {
    const { data } = await sb.from("daily_progress").select("day,bus,train,weather,traffic,bonus_claimed").order("day", { ascending: false }).limit(1).maybeSingle();
    setProgress(data && data.day === dayIn(tz) ? (data as Progress) : null);
    return data as Progress | null;
  }, [tz]);
  const loadTrophies = useCallback(async () => {
    const { data } = await sb.from("trophies").select("trophy_id");
    const s = new Set((data ?? []).map((r) => r.trophy_id as string));
    setTrophies(s); return s;
  }, []);
  const loadBets = useCallback(async () => {
    const { data } = await sb.from("bets").select("id,pick,stake,odds,status,payout,markets(id,city_id,category,kind,params,closes_at,target_at,odds_yes,odds_no,status,void_reason,outcome)").order("placed_at", { ascending: false }).limit(50);
    setBets((data ?? []) as unknown as MyBet[]);
  }, []);

  // Start-up: events are public and show at once; the guest session is created in the background.
  useEffect(() => {
    const sub = sb.auth.onAuthStateChange((_e, s) => setRegistered(!!s?.user && !s.user.is_anonymous && !!s.user.email));
    (async () => {
      const uid = await ensureGuest();
      if (!uid) return;
      const prefer = store.get("city") || pickCity(cityInfos(), { country: region(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, locale });
      await sb.rpc("ensure_profile", { p_city: prefer, p_locale: locale, p_country: region() });
      await sb.rpc("claim_daily_refill");
      await loadProfile(); await loadTrophies(); await loadBets();
      setReady(true);
    })().catch(() => {});
    return () => sub.data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (ready) loadProgress(); }, [ready, tz]);
  useEffect(() => { if (profile && !profile.country && region()) sb.rpc("set_country", { p_country: region() }).then(loadProfile); }, [profile?.id]);

  const loadMarkets = useCallback(async () => {
    const { data, error } = await sb.from("markets").select("id,city_id,category,kind,params,closes_at,target_at,odds_yes,odds_no,status")
      .eq("status", "open").gt("closes_at", new Date().toISOString()).order("closes_at").limit(300);
    if (!error) setMarkets((data ?? []) as MarketRow[]);
    const { data: h } = await sb.from("feed_health").select("feed_id,last_ok_at");
    const nowMs = Date.now();
    setStale((h ?? []).some((r) => {
      const f = CITIES.flatMap((c) => c.feeds).find((x) => x.id === r.feed_id);
      return f && f.category !== "weather" && f.licenseVerified && r.last_ok_at && nowMs - Date.parse(r.last_ok_at) > f.staleAfterSeconds * 1000 && markets?.some((m) => m.category === f.category);
    }));
  }, [markets === null]);
  const loadResults = useCallback(async () => {
    const { data } = await sb.from("markets").select("id,city_id,kind,status,outcome,void_reason,params,evidence").neq("status", "open").order("target_at", { ascending: false }).limit(14);
    setResults((data ?? []) as ResultRow[]);
  }, []);
  useEffect(() => { loadMarkets(); loadResults(); const a = setInterval(loadMarkets, 30000), b = setInterval(loadResults, 60000); return () => { clearInterval(a); clearInterval(b); }; }, [loadMarkets, loadResults]);

  const trackable = useMemo(() => (markets ?? []).filter((m) => m.kind !== "rain_at" && Date.parse(m.target_at) - Date.now() < 3 * 3600_000).slice(0, 80).map((m) => m.id), [markets]);
  useEffect(() => {
    if (trackable.length === 0) { setLive({}); return; }
    const go = () => sb.rpc("live_delays", { p_markets: trackable }).then(({ data }) => setLive(Object.fromEntries(((data ?? []) as LiveDelay[]).map((d) => [d.market_id, d]))));
    go(); const i = setInterval(go, 15000); return () => clearInterval(i);
  }, [trackable.join()]);

  const open = useMemo(() => (markets ?? []).filter((m) => Date.parse(m.closes_at) > now), [markets, Math.floor(now / 1000)]);
  const inFilter = useMemo(() => open.filter((m) => filter === "world" || m.city_id === filter), [open, filter]);
  const byCat = (c: Cat) => inFilter.filter((m) => m.category === c);
  useEffect(() => {
    if (catChosen || !markets) return;
    const first = (["bus", "train", "weather"] as Cat[]).find((c) => byCat(c).length > 0);
    if (first && byCat(cat).length === 0) setCat(first);
  }, [markets, filter, catChosen]);

  const list = byCat(cat);
  const bombs = new Set([...list].filter((m) => Number(m.odds_yes) >= 5 && m.kind !== "rain_at").sort((a, b) => Number(b.odds_yes) - Number(a.odds_yes)).slice(0, 2).map((m) => m.id));
  const heroLive = inFilter.filter((m) => live[m.id] && live[m.id]!.delay_sec >= 60 && !live[m.id]!.is_forecast).sort((a, b) => live[b.id]!.delay_sec - live[a.id]!.delay_sec)[0];
  const hero = heroLive ?? inFilter[0];
  const boardRows = inFilter.filter((m) => live[m.id]).map((m) => ({ m, live: live[m.id]! })).sort((a, b) => b.live.delay_sec - a.live.delay_sec).slice(0, 6);

  const place = async (m: MarketRow, pick: Pick, stake: number) => {
    const before = { bonus: progress?.bonus_claimed ?? false, trophies: new Set(trophies) };
    const { error } = await sb.rpc("place_bet", { p_market: m.id, p_pick: pick, p_stake: stake });
    if (error) return msg.errors[Object.keys(msg.errors).find((k) => error.message.includes(k)) ?? "generic"]!;
    setSheet(null);
    await loadProfile(); await loadBets();
    const [pr, tr] = [await loadProgress(), await loadTrophies()];
    const won = TROPHY_IDS.filter((id) => tr.has(id) && !before.trophies.has(id));
    if (won.length) { setFresh(new Set(won)); confetti(innerWidth / 2, innerHeight * 0.3, 70); flash(`🏆 ${msg.missions.newTrophy} ${msg.missions.trophy[won[0]!].name}`); }
    else if (pr?.bonus_claimed && !before.bonus) { confetti(innerWidth / 2, innerHeight * 0.3, 90); flash(`🎁 ${msg.missions.bonusDone}`); }
    else flash(msg.sheet.done(Math.floor(stake * Number(pick === "yes" ? m.odds_yes : m.odds_no))));
    if (!store.get("saveDismissed") && !registered) setSaveBar(true); // a quiet bar, never a pop-up
    return null;
  };
  const openSheet = (m: MarketRow, pick: Pick) => setSheet({ m, pick });

  // Ticker: real settled events, interleaved with house tips.
  const tickItems: TickItem[] = useMemo(() => {
    const out: TickItem[] = [];
    for (const r of results) {
      const c = cityOf(r.city_id), route = String(r.params.routeName ?? ""), stop = String(r.params.stopName ?? "");
      if (r.status === "void") out.push({ text: `⚠ ${msg.ticker.void(route || cityName(c, locale), stop)}`, tone: "warn" });
      else if (r.kind === "rain_at") out.push(r.outcome === "yes" ? { text: `🌧 ${msg.ticker.rain(cityName(c, locale))}`, tone: "bad" } : { text: `☀ ${msg.ticker.dry(cityName(c, locale))}`, tone: "good" });
      else if (r.outcome === "yes") out.push({ text: `🐌 ${msg.ticker.late(route, stop, Math.max(1, Math.round((r.evidence?.delaySec ?? 0) / 60)))}`, tone: "bad" });
      else out.push({ text: `✓ ${msg.ticker.onTime(route, stop)}`, tone: "good" });
    }
    msg.ticker.idle.forEach((s, i) => out.splice(Math.min(out.length, 2 + i * 3), 0, { text: `★ ${s}`, tone: "plain" }));
    return out;
  }, [results, locale]);

  const attributions = useMemo(() => {
    const cs = filter === "world" ? CITIES : [cityOf(filter)];
    const map = new Map<string, (typeof CITIES)[number]["feeds"][number]["attribution"]>();
    for (const c of cs) for (const f of c.feeds) if (f.licenseVerified && c.categories[f.category]?.enabled) map.set(f.attribution.name, f.attribution);
    return [...map.values()];
  }, [filter]);

  const ringsLeft = progress ? [progress.bus, progress.train, progress.weather].filter((n) => n === 0).length : 3;
  const season = new Intl.DateTimeFormat(INTL_TAG[locale], { month: "long", year: "numeric" }).format(new Date()).toUpperCase();
  const cityChips = [{ id: "world", label: msg.world, icon: "🌍" }, ...CITIES.filter((c) => enabledCategories(c).length > 0).map((c) => ({ id: c.id, label: cityName(c, locale), icon: flag(c.country) }))];
  const catChips = (["bus", "train", "weather", "traffic"] as Cat[]).map((c) => ({ id: c, label: msg.tabs[c], icon: catIcon[c], count: c === "traffic" ? 0 : byCat(c).length, disabled: c === "traffic" }));

  return (
    <div class="app">
      <header class="top">
        <button class="brand" onClick={() => setNav("events")} aria-label="LateLotto"><Mascot /><span>LATE<b>LOTTO</b></span></button>
        <div class="tools">
          <button class="rb" onClick={() => setNav("ranking")} aria-label={msg.nav.ranking}>{Icon.ranking}</button>
          <button class={`rb gift ${ringsLeft > 0 ? "pulse" : ""}`} onClick={() => setNav("missions")} aria-label={msg.nav.missions}>{Icon.gift}</button>
          <div class="wallet" aria-live="polite" key={profile?.credits}><b>{profile ? wallet.toLocaleString(INTL_TAG[locale]) : "···"}</b><span>{msg.credits}</span></div>
        </div>
      </header>
      <Ticker items={tickItems} />

      {saveBar && !registered && (
        <div class="savebar"><button onClick={() => setShowSave(true)}>💾 {msg.save.title} <span>→</span></button><button class="x" aria-label="×" onClick={() => { store.set("saveDismissed", "1"); setSaveBar(false); }}>×</button></div>
      )}
      {offline && <p class="note">{msg.offline}</p>}
      {stale && <p class="note warn">{msg.feedWarning}</p>}

      {nav === "events" && (
        <main class="view events">
          {markets === null ? <div class="sk hero-sk" /> : hero && <Hero m={hero} live={live[hero.id]} msg={msg} locale={locale} now={now} onPick={openSheet} />}
          <Chips<Cat> value={cat} chips={catChips} onPick={(c) => { setCatChosen(true); setCat(c); }} />
          <Chips<string> small value={filter} chips={cityChips} onPick={(f) => { store.set("filter", f); setFilter(f); }} />
          {cat !== "traffic" && (boardRows.length > 0 || cat !== "weather") && <Board rows={boardRows} msg={msg} locale={locale} now={now} />}
          {markets === null && [0, 1, 2].map((i) => <div class="sk card-sk" key={i} />)}
          {markets !== null && cat === "traffic" && <p class="muted empty">{msg.empty.trafficSoon}</p>}
          {markets !== null && cat !== "traffic" && list.length === 0 && <p class="muted empty">{msg.empty.markets}</p>}
          {list.slice(0, 40).map((m, i) => <MarketCard key={m.id} m={m} msg={msg} locale={locale} now={now} live={live[m.id]} index={i} showCity={filter === "world"} bomb={bombs.has(m.id)} onPick={openSheet} />)}
          <footer>
            <div class="bar2">
              <label><span class="sr">{msg.language}</span><select value={locale} onChange={(e) => { const l = (e.target as HTMLSelectElement).value as Locale; store.set("locale", l); setLocale(l); }}>{LOCALES.map((l) => <option value={l.id}>{l.label}</option>)}</select></label>
              {installEvt && <button class="ghost" onClick={() => (installEvt as Event & { prompt: () => void }).prompt()}>{msg.install}</button>}
            </div>
            <p class="disc"><strong>{msg.disclaimerShort}</strong> {msg.disclaimerFull}</p>
            <details><summary>{msg.attributionTitle}</summary>
              <ul>{attributions.map((a) => <li><a href={a.url} target="_blank" rel="noopener noreferrer">{a.name}</a>{a.via ? ` · ${a.via}` : ""} · <a href={a.licenseUrl} target="_blank" rel="noopener noreferrer">{a.license}</a></li>)}</ul>
            </details>
          </footer>
        </main>
      )}
      {nav === "missions" && <Missions msg={msg} profile={profile} progress={progress} trophies={trophies} fresh={fresh} rank={rank.rank} scope={rank.scope} season={season} onToast={flash} />}
      {nav === "ranking" && <Ranking msg={msg} profile={profile} registered={registered} reload={loadProfile} onToast={flash} onSave={() => setShowSave(true)} onRank={(r, s) => setRank({ rank: r, scope: s })} />}
      {nav === "mine" && <Mine bets={bets} msg={msg} locale={locale} now={now} />}

      <nav class="bottom" role="tablist">
        {([["events", Icon.events, msg.nav.events, 0], ["missions", Icon.missions, msg.nav.missions, ringsLeft], ["ranking", Icon.ranking, msg.nav.ranking, 0], ["mine", Icon.mine, msg.nav.mine, bets.filter((b) => b.status === "open").length]] as const).map(([id, ic, label, badge]) => (
          <button key={id} role="tab" aria-selected={nav === id} class={nav === id ? "on" : ""} onClick={() => { setNav(id); scrollTo({ top: 0 }); }}>
            {ic}<span>{label}</span>{badge > 0 && <em key={badge}>{badge}</em>}
          </button>
        ))}
      </nav>

      {sheet && <BetSheet m={sheet.m} initial={sheet.pick} msg={msg} locale={locale} credits={profile?.credits ?? 0} ready={ready} onClose={() => setSheet(null)} onPlace={place} />}
      {showSave && <SavePrompt msg={msg} onClose={() => setShowSave(false)} />}
      {toast && <div class="toast" role="status">{toast}</div>}
    </div>
  );
}

function SavePrompt({ msg, onClose }: { msg: ReturnType<typeof t>; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async () => {
    const { error } = await sb.auth.updateUser({ email }, { emailRedirectTo: location.origin });
    if (error) setErr(error.message); else setSent(true);
  };
  return (
    <div class="scrim" onClick={onClose}>
      <div class="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div class="grab" />
        <h2>{msg.save.title}</h2><p class="muted">{msg.save.body}</p>
        {sent ? <p>{msg.save.sent}</p> : <input type="email" placeholder={msg.save.email} value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} autocomplete="email" />}
        {err && <p class="err">{err}</p>}
        <div class="actions"><button class="ghost" onClick={onClose}>{msg.save.later}</button>{!sent && <button class="primary shine" disabled={!/.+@.+\..+/.test(email)} onClick={send}>{msg.save.send}</button>}</div>
      </div>
    </div>
  );
}
