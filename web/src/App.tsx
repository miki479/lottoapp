import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { payout } from "../../shared/wallet.ts";
import { INTL_TAG, LOCALES, t, type Locale } from "./i18n/index.ts";
import { ensureGuest, sb, type Profile } from "./lib/api.ts";
import { CITIES, cityInfos, cityName, cityOf, enabledCategories } from "./lib/cities.ts";
import { pickCity, pickLocale } from "./lib/detect.ts";
import { formatWhen, minutesUntil, question, type MarketRow } from "./lib/format.ts";

type Tab = "bus" | "train" | "weather" | "traffic" | "mine";
interface MyBet {
  id: string; pick: "yes" | "no"; stake: number; odds: number; status: "open" | "won" | "lost" | "void"; payout: number;
  markets: MarketRow & { void_reason: string | null; outcome: string | null };
}

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export function App() {
  const [locale, setLocale] = useState<Locale>(() => (store.get("locale") as Locale) || pickLocale(navigator.languages ?? [navigator.language]));
  const [cityId, setCityId] = useState<string>(() => store.get("city") || pickCity(cityInfos(), { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, locale: pickLocale(navigator.languages ?? []) }));
  const [tab, setTab] = useState<Tab>("bus");
  const [markets, setMarkets] = useState<MarketRow[] | null>(null);
  const [bets, setBets] = useState<MyBet[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<MarketRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [showSave, setShowSave] = useState(false);
  const [tabChosen, setTabChosen] = useState(false);

  const msg = t(locale);
  const city = cityOf(cityId);
  const cats = useMemo(() => enabledCategories(city), [city]);
  const visibleTabs: Tab[] = useMemo(() => [...cats, "mine"] as Tab[], [cats]);

  // Language: remembered choice wins, otherwise the browser's.
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => { if (!visibleTabs.includes(tab)) setTab(visibleTabs[0] ?? "mine"); }, [visibleTabs]);
  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    addEventListener("online", on); addEventListener("offline", off);
    return () => { removeEventListener("online", on); removeEventListener("offline", off); };
  }, []);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  const loadProfile = useCallback(async () => {
    const { data } = await sb.from("profiles").select("id,credits,city_id,locale,timezone").maybeSingle();
    if (data) setProfile(data as Profile);
  }, []);

  // Start-up: show events immediately (public data), sign in as a guest in the background.
  useEffect(() => {
    (async () => {
      const uid = await ensureGuest();
      if (!uid) return;
      await sb.rpc("ensure_profile", { p_city: store.get("city") || cityId, p_locale: locale, p_country: null });
      await sb.rpc("claim_daily_refill");
      await loadProfile();
      setReady(true);
    })().catch(() => {});
  }, []);

  const loadMarkets = useCallback(async () => {
    const { data, error } = await sb.from("markets").select("id,city_id,category,kind,params,closes_at,target_at,odds_yes,odds_no,status")
      .eq("city_id", cityId).eq("status", "open").gt("closes_at", new Date().toISOString()).order("target_at").limit(80);
    if (!error) setMarkets((data ?? []) as MarketRow[]);
    const feeds = city.feeds.map((f) => f.id);
    const { data: h } = await sb.from("feed_health").select("feed_id,last_ok_at").in("feed_id", feeds);
    const now = Date.now();
    setStale((h ?? []).some((r) => {
      const f = city.feeds.find((x) => x.id === r.feed_id);
      return f && f.category !== "weather" && r.last_ok_at && now - Date.parse(r.last_ok_at) > f.staleAfterSeconds * 1000;
    }));
  }, [cityId, city]);

  const loadBets = useCallback(async () => {
    const { data } = await sb.from("bets").select("id,pick,stake,odds,status,payout,markets(id,city_id,category,kind,params,closes_at,target_at,odds_yes,odds_no,status,void_reason,outcome)")
      .order("placed_at", { ascending: false }).limit(50);
    setBets((data ?? []) as unknown as MyBet[]);
  }, []);

  // Land on the first category that has something to bet on, unless the player already picked one.
  useEffect(() => {
    if (tabChosen || !markets || markets.length === 0) return;
    const first = cats.find((c) => markets.some((m) => m.category === c));
    if (first && !markets.some((m) => m.category === tab)) setTab(first);
  }, [markets, tabChosen]);
  useEffect(() => { loadMarkets(); const i = setInterval(loadMarkets, 30000); return () => clearInterval(i); }, [loadMarkets]);
  useEffect(() => { if (ready) loadBets(); }, [ready, tab === "mine"]);

  const changeCity = async (id: string) => {
    store.set("city", id); setCityId(id); setMarkets(null);
    if (ready) await sb.rpc("set_city", { p_city: id });
  };
  const changeLocale = (l: Locale) => { store.set("locale", l); setLocale(l); };

  const place = async (m: MarketRow, pick: "yes" | "no", stake: number) => {
    const { data, error } = await sb.rpc("place_bet", { p_market: m.id, p_pick: pick, p_stake: stake });
    if (error) {
      const key = Object.keys(msg.errors).find((k) => error.message.includes(k));
      return msg.errors[key ?? "generic"]!;
    }
    const odds = Number((data as { odds: number }).odds);
    setSelected(null); flash(msg.sheet.done(payout(stake, odds)));
    await Promise.all([loadProfile(), loadBets()]);
    if (!store.get("savePrompted")) { store.set("savePrompted", "1"); setTimeout(() => setShowSave(true), 1200); }
    return null;
  };

  const shown = (markets ?? []).filter((m) => m.category === tab);

  return (
    <div class="app">
      <header class="top">
        <div class="brand"><span class="logo" aria-hidden="true">◔</span><div><h1>LateLotto</h1><p>{msg.tagline}</p></div></div>
        <div class="wallet" aria-live="polite"><b>{profile ? profile.credits.toLocaleString(INTL_TAG[locale]) : "…"}</b><span>{msg.credits}</span></div>
      </header>

      <div class="bar">
        <label><span class="sr">{msg.city}</span>
          <select value={cityId} onChange={(e) => changeCity((e.target as HTMLSelectElement).value)}>
            {CITIES.filter((c) => enabledCategories(c).length > 0).map((c) => <option value={c.id}>{cityName(c, locale)}</option>)}
          </select></label>
        <label><span class="sr">{msg.language}</span>
          <select value={locale} onChange={(e) => changeLocale((e.target as HTMLSelectElement).value as Locale)}>
            {LOCALES.map((l) => <option value={l.id}>{l.label}</option>)}
          </select></label>
      </div>

      {offline && <p class="note">{msg.offline}</p>}
      {stale && tab !== "weather" && <p class="note warn">{msg.feedWarning}</p>}

      <nav class="tabs" role="tablist">
        {visibleTabs.map((k) => (
          <button role="tab" aria-selected={tab === k} class={tab === k ? "on" : ""} onClick={() => { setTabChosen(true); setTab(k); }}>{msg.tabs[k]}</button>
        ))}
        {!cats.includes("traffic") && <button role="tab" class="soon" disabled title={msg.empty.trafficSoon}>{msg.tabs.traffic}</button>}
      </nav>

      <main>
        {tab !== "mine" && markets === null && <p class="muted">{msg.loading}</p>}
        {tab !== "mine" && markets !== null && shown.length === 0 && <p class="muted">{msg.empty.markets}</p>}
        {tab !== "mine" && shown.map((m) => (
          <button class="card" key={m.id} onClick={() => setSelected(m)}>
            <span class="q">{question(m, msg, locale, cityName(city, locale), city.timezone)}</span>
            <span class="meta">
              <span class="odds"><i>{msg.pick.yes}</i> {Number(m.odds_yes).toFixed(2)}</span>
              <span class="odds"><i>{msg.pick.no}</i> {Number(m.odds_no).toFixed(2)}</span>
              <span class="timer">{minutesUntil(m.closes_at) < 5 ? msg.closedSoon : msg.closesIn(minutesUntil(m.closes_at))}</span>
            </span>
          </button>
        ))}
        {tab === "mine" && (bets.length === 0 ? <p class="muted">{msg.empty.mine}</p> : bets.map((b) => <BetRow bet={b} msg={msg} locale={locale} city={city} />))}
      </main>

      <footer>
        <p class="disc"><strong>{msg.disclaimerShort}</strong> {msg.disclaimerFull}</p>
        <details><summary>{msg.attributionTitle}</summary>
          <ul>{[...new Map(city.feeds.filter((f) => f.licenseVerified && city.categories[f.category]?.enabled).map((f) => [f.attribution.name, f.attribution])).values()].map((a) => (
            <li><a href={a.url} target="_blank" rel="noopener noreferrer">{a.name}</a>{a.via ? ` · ${a.via}` : ""} · <a href={a.licenseUrl} target="_blank" rel="noopener noreferrer">{a.license}</a></li>
          ))}</ul>
        </details>
      </footer>

      {selected && <BetSheet m={selected} msg={msg} locale={locale} city={city} credits={profile?.credits ?? 0} ready={ready} onClose={() => setSelected(null)} onPlace={place} />}
      {showSave && <SavePrompt msg={msg} onClose={() => setShowSave(false)} />}
      {toast && <div class="toast" role="status">{toast}</div>}
    </div>
  );
}

function BetRow({ bet, msg, locale, city }: { bet: MyBet; msg: ReturnType<typeof t>; locale: Locale; city: ReturnType<typeof cityOf> }) {
  const m = bet.markets;
  const status = bet.status === "open" ? msg.mine.open : bet.status === "won" ? msg.mine.won(bet.payout - bet.stake) : bet.status === "lost" ? msg.mine.lost : msg.mine.void;
  return (
    <div class={`card static ${bet.status}`}>
      <span class="q">{question(m, msg, locale, cityName(city, locale), city.timezone)}</span>
      <span class="meta"><span>{msg.mine.yourPick(bet.pick === "yes")} · {bet.stake} @ {Number(bet.odds).toFixed(2)}</span><b class={`pill ${bet.status}`}>{status}</b></span>
      {bet.status === "void" && m.void_reason && <small class="muted">{msg.mine.voidReason[m.void_reason] ?? ""}</small>}
    </div>
  );
}

function BetSheet(p: { m: MarketRow; msg: ReturnType<typeof t>; locale: Locale; city: ReturnType<typeof cityOf>; credits: number; ready: boolean; onClose: () => void; onPlace: (m: MarketRow, pick: "yes" | "no", stake: number) => Promise<string | null> }) {
  const [pick, setPick] = useState<"yes" | "no">("yes");
  const [stake, setStake] = useState(50);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const odds = Number(pick === "yes" ? p.m.odds_yes : p.m.odds_no);
  const submit = async () => { setBusy(true); setErr(null); const e = await p.onPlace(p.m, pick, stake); if (e) { setErr(e); setBusy(false); } };
  const chips = [25, 50, 100, 250].filter((c) => c <= Math.max(25, p.credits));
  return (
    <div class="scrim" onClick={p.onClose}>
      <div class="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <p class="q">{question(p.m, p.msg, p.locale, cityName(p.city, p.locale), p.city.timezone)}</p>
        <div class="pick">
          {(["yes", "no"] as const).map((k) => (
            <button class={pick === k ? "on" : ""} onClick={() => setPick(k)}><b>{p.msg.pick[k]}</b><span>{p.msg.sheet.odds} {Number(k === "yes" ? p.m.odds_yes : p.m.odds_no).toFixed(2)}</span></button>
          ))}
        </div>
        <p class="label">{p.msg.sheet.stake}</p>
        <div class="chips">{chips.map((c) => <button class={stake === c ? "on" : ""} onClick={() => setStake(c)}>{c}</button>)}</div>
        <p class="win">{p.msg.sheet.potential}: <b>{payout(stake, odds)}</b> {p.msg.credits}</p>
        {err && <p class="err" role="alert">{err}</p>}
        <div class="actions">
          <button class="ghost" onClick={p.onClose}>{p.msg.sheet.cancel}</button>
          <button class="primary" disabled={busy || !p.ready} onClick={submit}>{busy ? p.msg.sheet.placing : p.msg.sheet.place}</button>
        </div>
      </div>
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
        <h2>{msg.save.title}</h2><p class="muted">{msg.save.body}</p>
        {sent ? <p>{msg.save.sent}</p> : <input type="email" placeholder={msg.save.email} value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} autocomplete="email" />}
        {err && <p class="err">{err}</p>}
        <div class="actions"><button class="ghost" onClick={onClose}>{msg.save.later}</button>{!sent && <button class="primary" disabled={!/.+@.+\..+/.test(email)} onClick={send}>{msg.save.send}</button>}</div>
      </div>
    </div>
  );
}
