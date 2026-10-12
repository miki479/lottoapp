import { CloudRain } from "lucide-preact";
import { FilterSheet, filterLabel, ICON as KIND_ICON } from "../components/FilterSheet.tsx";
import { groupMatches, MatchList } from "../components/MatchList.tsx";
import { quip } from "../lib/format.ts";
import { CatChips, type CatId } from "../components/CatChips.tsx";
import { Empty } from "../components/Empty.tsx";
import { CrowdCard } from "../components/CrowdCard.tsx";
import { EventCard } from "../components/EventCard.tsx";
import { Flag } from "../components/Flag.tsx";
import { TopCards, type TopItem } from "../components/TopCards.tsx";
import { Car, Coins, Globe, ListChecks, MapPin, SlidersHorizontal, Sparkles, ThumbsUp, X } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { cityName, CITIES, enabledCategories } from "../lib/cities.ts";
import { ChevronDown, Flame, Plus, Search } from "lucide-preact";
import { TrainBoard } from "../components/TrainBoard.tsx";
import { FEATURED_CITY_IDS, FEATURED_PLACES, type Place } from "../lib/places.ts";
import type { MarketRow } from "../lib/format.ts";
import type { LiveDelay, LiveOcc, Pick, Progress } from "../lib/types.ts";

/** Categories tucked away under "More categories" so the main row stays short. */
const EXTRA_CATS: CatId[] = ["finance", "culture", "sport", "gov"];
/** Only these depend on a place: the city chips are shown for them and nowhere else, so a global category is never emptied by a city. */
const LOCAL_CATS: CatId[] = ["bus", "train", "weather", "traffic"];
const safe = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
export interface Trend { id: string; name: string; country: string; place?: Place }
export interface HomeProps {
  msg: Messages; locale: Locale; now: number; markets: MarketRow[] | null; list: MarketRow[]; live: Record<string, LiveDelay>; occ: Record<string, LiveOcc>;
  cat: CatId; counts: Record<CatId, number>; onCat: (c: CatId) => void; filter: string; onFilter: (f: string) => void; mine?: string | null;
  onQuakeMaker: () => void; onCreate: () => void; registered: boolean; onAuth: () => void; italian: boolean; nearNode?: preact.ComponentChildren; nearbyNode?: preact.ComponentChildren; trending: Trend[]; places: Place[]; onPlace: (p: Place) => void; onMorePlaces: () => void; ladders: Record<string, MarketRow[]>; outlook: Record<string, number>; top: TopItem[]; onPick: (m: MarketRow, p: Pick) => void;
  stale?: boolean; details: boolean; friendBets: Record<string, number>;
  attributions: { name: string; via?: string; license: string; licenseUrl: string; url: string }[]; installEvt: Event | null;
}

export function Home(p: HomeProps) {
  const { msg } = p;
  const tiles = (["bus", "train", "weather", "nature", ...(p.italian ? ["strike"] : []), "traffic", "finance", "culture", "sport", "gov"] as CatId[]).map((id) => ({ id, label: msg.tabs[id], count: p.counts[id] ?? 0, disabled: id === "gov", soon: id === "gov" ? msg.tabs.soon : undefined }));
  // Weather has sub-pills (rain, temperature, wind…) so the category row stays short; only the kinds that exist today are shown.
  const [wxSel, setWx] = useState<string>("all");
  const finKey = (m: MarketRow) => { const s = String(m.params.series ?? ""); return s.startsWith("metal:") ? "metals" : s.startsWith("oil:") ? "oil" : s.startsWith("fuel:") ? "fuel" : "crypto"; };
  const wxKey = (m: MarketRow) => (m.kind === "tick_gt" && m.category === "finance" ? finKey(m) : m.kind === "rain_at" ? "rain" : m.kind === "metric_gt" ? String(m.params.metric) : m.kind === "quake_m" ? String(m.params.region ?? "world") : "");
  const order = p.cat === "weather" ? ["rain", "temp", "wind", "snow", "uv", "aqi", "hail"] : p.cat === "nature" ? ["world", "jp", "it", "ca", "tr"] : p.cat === "finance" ? ["crypto", "metals", "oil", "fuel"] : [];
  const [filterOpen, setFilterOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(() => safe.get("how") !== "1");
  // The hero tells the dry jokes: the fixed line first, then one per kind of question that is open right now, rotating.
  const jokes = [...new Set([msg.home.hero.body, ...(p.markets ?? []).map((m) => quip(m, msg)).filter(Boolean)])].slice(0, 12);
  const [jokeIdx, setJokeIdx] = useState(0);
  useEffect(() => { if (jokes.length < 2) return; const i = setInterval(() => setJokeIdx((x) => (x + 1) % jokes.length), 6500); return () => clearInterval(i); }, [jokes.length]);
  const mq = typeof matchMedia === "function" ? matchMedia("(max-width: 560px)") : null;
  const [phone, setPhone] = useState(!!mq?.matches);
  useEffect(() => { if (!mq) return; const f = () => setPhone(mq.matches); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, []);
  useEffect(() => { document.querySelector(".catchips .cc.on")?.scrollIntoView({ inline: "center", block: "nearest" }); }, [p.cat, phone]);
  const [catsOpen, setCatsOpen] = useState(() => EXTRA_CATS.includes(p.cat));
  const extraCount = EXTRA_CATS.reduce((n, c) => n + (p.counts[c] ?? 0), 0);
  useEffect(() => { if (EXTRA_CATS.includes(p.cat)) setCatsOpen(true); }, [p.cat]);
  const wxKinds = order.filter((k) => p.list.some((m) => wxKey(m) === k));
  const wx = wxKinds.includes(wxSel) ? wxSel : "all";
  const picked = wx !== "all" ? p.list.filter((m) => wxKey(m) === wx) : p.list;
  const [teamQ, setTeamQ] = useState("");
  const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const sportQ = p.cat === "sport" ? norm(teamQ.trim()) : "";
  const picked2 = sportQ ? picked.filter((m) => norm(`${m.params.home ?? ""} ${m.params.away ?? ""} ${m.params.league ?? ""}`).includes(sportQ)) : picked;
  const shown0 = picked2;
  const shown = p.cat === "nature" ? [...shown0].sort((a, b) => Date.parse(a.target_at) - Date.parse(b.target_at) || Number(a.params.minMag) - Number(b.params.minMag)) : shown0;
  const topId = shown.reduce<MarketRow | null>((b, m) => (!b || Number(m.odds_yes) > Number(b.odds_yes) ? m : b), null)?.id;
  const cities = CITIES.filter((c) => enabledCategories(c).length > 0);
  const placeName = (() => { const c = CITIES.find((x) => x.id === p.filter); if (c) return cityName(c, p.locale); return [...p.places, ...FEATURED_PLACES, ...p.trending.map((t) => t.place).filter((x): x is Place => !!x)].find((x) => x.id === p.filter)?.name ?? p.filter; })();
  /** What does exist in the chosen place: offered as buttons so nothing switches by itself. */
  const alt = tiles.filter((t) => !t.disabled && t.id !== p.cat && t.count > 0).slice(0, 4);
  return (
    <div class="home screen">
      <section class="hero" aria-label={msg.home.hero.title}>
        <i class="star s1" /><i class="star s2" /><i class="star s3" /><i class="star s4" />
        <span class="hero-ico"><Sparkles size={22} /></span>
        <h1>{msg.home.hero.title}</h1>
        <p class="hero-quip" key={jokeIdx}>{jokes[jokeIdx % jokes.length]}</p>
      </section>
      {howOpen && (
        <section class="howto" aria-label={msg.home.how.title}>
          <div class="howhead"><h2>{msg.home.how.title}</h2><button class="howx" onClick={() => { safe.set("how", "1"); setHowOpen(false); }}>{msg.home.how.close}</button></div>
          <ol class="howgrid">
            {([ListChecks, ThumbsUp, Coins] as const).map((Icon, i) => <li key={i}><span class="hn">{i + 1}</span><span class="hi"><Icon size={22} /></span><span class="ht">{msg.home.how.steps[i]}</span></li>)}
          </ol>
        </section>
      )}
      <div class="aside">
        {p.top.length > 0 && (
          <section class="stack" style="gap:8px">
            <div class="sectionhead"><h2>{msg.home.top}</h2></div>
            <TopCards items={p.top} />
          </section>
        )}
        {p.italian && <TrainBoard open={!phone} markets={p.markets ?? []} live={p.live} msg={msg} locale={p.locale} now={p.now} onPick={p.onPick} />}
      </div>
      <div class="main stack">
        <h2 class="steplabel">{msg.home.whatLabel}</h2>
        <CatChips tiles={tiles.filter((t) => phone || !EXTRA_CATS.includes(t.id) || catsOpen)} value={p.cat} onPick={p.onCat} />
        <button class={`morecats ${catsOpen ? "open" : ""}`} aria-expanded={catsOpen} onClick={() => setCatsOpen(!catsOpen)}>{catsOpen ? msg.home.lessCats : msg.home.moreCats}{!catsOpen && extraCount > 0 && <em>{extraCount}</em>}<ChevronDown size={16} /></button>
        {LOCAL_CATS.includes(p.cat) && <h2 class="steplabel">{msg.home.whereLabel}</h2>}
        {LOCAL_CATS.includes(p.cat) && (
          <div class="chiprow" role="tablist">
            <button class={`chip ${p.filter === "world" ? "on" : ""}`} role="tab" aria-selected={p.filter === "world"} onClick={() => p.onFilter("world")}><Globe size={16} />{msg.world}</button>
            {p.mine && <button class={`chip ${p.filter === "mine" ? "on" : ""}`} role="tab" aria-selected={p.filter === "mine"} onClick={() => p.onFilter("mine")}><Flag cc={p.mine} size={13} />{msg.near.title}</button>}
            {cities.filter((c) => FEATURED_CITY_IDS.includes(c.id)).map((c) => <button key={c.id} class={`chip ${p.filter === c.id ? "on" : ""}`} role="tab" aria-selected={p.filter === c.id} onClick={() => p.onFilter(c.id)}><Flag cc={c.country} size={13} />{cityName(c, p.locale)}</button>)}
            {FEATURED_PLACES.map((pl) => <button key={pl.id} class={`chip ${p.filter === pl.id ? "on" : ""}`} role="tab" aria-selected={p.filter === pl.id} onClick={() => p.onPlace(pl)}><Flag cc={pl.country} size={13} />{pl.name}</button>)}
            {p.trending.filter((t) => !cities.find((c) => c.id === t.id)?.region).map((t) => <button key={t.id} class={`chip trend ${p.filter === t.id ? "on" : ""}`} role="tab" aria-selected={p.filter === t.id} onClick={() => (t.place ? p.onPlace(t.place) : p.onFilter(t.id))}><Flag cc={t.country} size={13} />{t.name}<Flame size={13} /></button>)}
            {p.places.filter((pl) => !FEATURED_PLACES.some((f) => f.id === pl.id) && !p.trending.some((t) => t.id === pl.id)).map((pl) => <button key={pl.id} class="chip on" role="tab" aria-selected><Flag cc={pl.country} size={13} />{pl.name}</button>)}
            <button class="chip more" onClick={p.onMorePlaces}><Plus size={16} />{msg.places.more}</button>
          </div>
        )}
        {wxKinds.length > 1 && (
          <>
            <h2 class="steplabel">{msg.home.typeLabel}</h2>
            <div class="chiprow typerow" role="tablist">
              <button class={`chip ${wx === "all" ? "on" : ""}`} role="tab" aria-selected={wx === "all"} onClick={() => setWx("all")}>{msg.wx.all}<em>{p.list.length}</em></button>
              {wxKinds.map((k) => { const Icon = KIND_ICON[k]; return <button key={k} class={`chip ${wx === k ? "on" : ""}`} role="tab" aria-selected={wx === k} onClick={() => setWx(k)}>{Icon && <Icon size={16} />}{filterLabel(msg, k)}<em>{p.list.filter((m) => wxKey(m) === k).length}</em></button>; })}
            </div>
          </>
        )}
        <div class="sectionhead evhead"><h2>{msg.home.events}</h2>
          <div class="evacts"><button class="createbtn" onClick={p.onCreate}><Plus size={16} />{msg.maker.open}</button>
        </div></div>
        {filterOpen && <FilterSheet msg={msg} options={wxKinds.map((k) => ({ key: k, count: p.list.filter((m) => wxKey(m) === k).length }))} value={wx} onPick={setWx} onClose={() => setFilterOpen(false)} />}
        {p.cat === "nature" && <button class="btn secondary quakecta" onClick={p.onQuakeMaker}><MapPin size={18} />{msg.quakeMaker.cta}</button>}
        {p.cat === "sport" && <label class="searchbox"><Search size={18} /><input class="field" type="search" value={teamQ} placeholder={msg.teamSearch} onInput={(e) => setTeamQ((e.target as HTMLInputElement).value)} /></label>}
        {p.cat === "sport" && p.markets !== null && <MatchList matches={groupMatches(shown)} msg={msg} locale={p.locale} onPick={p.onPick} registered={p.registered} onAuth={p.onAuth} details={p.details} friendBets={p.friendBets} />}
        {p.stale && <p class="note warn">{msg.feedWarning}</p>}
        <div class="cardgrid" style={p.cat === "sport" ? "display:none" : undefined}>
          {p.markets === null && [0, 1, 2].map((i) => <div class="sk" key={i} />)}
          {p.markets !== null && p.cat === "traffic" && shown.length === 0 && <div style="grid-column:1/-1"><Empty icon={Car} title={msg.tabs.traffic} body={msg.home.trafficSoon} /></div>}
          {p.markets !== null && p.cat === "train" && (p.filter === "tokyo" || (p.filter === "world" && p.locale === "ja")) && <div style="grid-column:1/-1"><CrowdCard msg={msg} locale={p.locale} /></div>}
          {p.markets !== null && p.cat !== "traffic" && shown.length === 0 && !(p.cat === "train" && p.filter === "tokyo") && (
            <div style="grid-column:1/-1" class="stack">
              <Empty icon={CloudRain} title={msg.home.empty.title} body={LOCAL_CATS.includes(p.cat) && p.filter !== "world" && p.filter !== "mine" ? msg.home.hereNone(placeName) : `${msg.home.emptyCat[p.cat]} ${msg.home.empty.body}`} cta={p.filter !== "world" ? msg.home.empty.cta : undefined} onCta={() => p.onFilter("world")} />
              {alt.length > 0 && <div class="tryalt"><span>{msg.home.tryInstead}</span>{alt.map((t) => <button key={t.id} class="chip" onClick={() => p.onCat(t.id)}>{t.label}<em>{t.count}</em></button>)}</div>}
            </div>
          )}
          {shown.slice(0, 40).map((m, i) => <EventCard key={m.id} m={m} msg={msg} locale={p.locale} now={p.now} live={p.live[m.id]} occ={p.occ[m.id]} index={i} mm={p.outlook[m.id]} friends={p.friendBets[m.id]} hasLadder={(p.ladders[m.id]?.length ?? 0) > 0} top={m.id === topId && shown.length > 3} showCity={p.filter === "world" || p.filter === "mine"} onPick={p.onPick} />)}
        </div>
        <div class="nearwrap stack">{p.nearbyNode}{p.nearNode}</div>
        <footer class="legal">
          <p><strong style="color:var(--text)">{msg.disclaimerShort}</strong> {msg.disclaimerFull}</p>
          <details style="margin-top:8px"><summary>{msg.attributionTitle}</summary>
            <ul>{p.attributions.map((a) => <li key={a.name}><a href={a.url} target="_blank" rel="noopener noreferrer">{a.name}</a>{a.via ? ` · ${a.via}` : ""} · <a href={a.licenseUrl} target="_blank" rel="noopener noreferrer">{a.license}</a></li>)}</ul>
          </details>
        </footer>
      </div>
    </div>
  );
}
