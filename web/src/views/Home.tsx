import { catTiles } from "../lib/countrycats.ts";
import { startChips } from "../lib/startcities.ts";
import { InstallHint } from "../components/InstallHint.tsx";
import { Inbox } from "../components/Inbox.tsx";
import { ForYou } from "../components/ForYou.tsx";
import { PersonalOffer, type OfferUse } from "../components/PersonalOffer.tsx";
import { CLASS_LABEL, trainClass, trainZone, type TrainClass } from "../lib/zones.ts";
import { CloudRain } from "lucide-preact";
import { RainGroup } from "../components/RainGroup.tsx";
import { FilterSheet, filterLabel, ICON as KIND_ICON } from "../components/FilterSheet.tsx";
import { groupMatches, MatchList } from "../components/MatchList.tsx";
import { CatChips, type CatId } from "../components/CatChips.tsx";
import { Empty } from "../components/Empty.tsx";
import { CrowdCard } from "../components/CrowdCard.tsx";
import { EventCard } from "../components/EventCard.tsx";
import { FrisbeeSoon } from "../components/FrisbeeSoon.tsx";
import { GameGroup } from "../components/GameGroup.tsx";
import { Flag } from "../components/Flag.tsx";
import { TopCards, type TopItem } from "../components/TopCards.tsx";
import { FriendsBets } from "../components/FriendsBets.tsx";
import { Car, Coins, Globe, ListChecks, MapPin, ThumbsUp } from "lucide-preact";
import { Fragment } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { cityName, CITIES, enabledCategories } from "../lib/cities.ts";
import { ChevronDown, Flame, Plus, Search, Tv } from "lucide-preact";
import { TrainBoard } from "../components/TrainBoard.tsx";
import { LoadBar } from "../components/LoadBar.tsx";
import { followedShows, type FollowedShow } from "../lib/series.ts";
import { FEATURED_PLACES, type Place } from "../lib/places.ts";
import { isRegionFilter, regionLabel, regionOfCity, regionOfPoint, REGION_FILTER, TOP_REGIONS } from "../lib/regions.ts";
import { RegionPanel } from "../components/RegionPanel.tsx";
import type { MarketRow } from "../lib/format.ts";
import type { LiveDelay, LiveOcc, Pick } from "../lib/types.ts";
import { placeName as placeLabel } from "../lib/names.ts";

/** Only these depend on a place: the city chips are shown for them and nowhere else, so a global category is never emptied by a city. */
const LOCAL_CATS: CatId[] = ["bus", "train", "weather", "traffic"];
const safe = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
export interface Trend { id: string; name: string; country: string; place?: Place }
const REG_MORE: Record<string, string> = { it: "Regioni", "en-US": "Regions", "en-GB": "Regions", ja: "地域" };
const NEAR_WIDE: Record<string, string> = { it: "Niente entro 50 km: ecco le più vicine nel tuo paese.", "en-US": "Nothing within 50 km: here is the closest in your country.", "en-GB": "Nothing within 50 km: here is the closest in your country.", ja: "50km以内にはありません。お住まいの国で一番近いものを表示します。" };
export interface HomeProps {
  msg: Messages; locale: Locale; now: number; markets: MarketRow[] | null; list: MarketRow[]; live: Record<string, LiveDelay>; occ: Record<string, LiveOcc>;
  cat: CatId; counts: Record<CatId, number>; onCat: (c: CatId) => void; filter: string; onFilter: (f: string) => void; mine?: string | null; radiusKm?: number | null; mineWide?: boolean; country?: string | null; homePos?: { lat: number; lon: number } | null;
  onRefreshBoard?: () => void; onQuakeMaker: () => void; onSeries: (s?: FollowedShow) => void; onCreate: () => void; registered: boolean; onAuth: () => void; italian: boolean; nearNode?: preact.ComponentChildren; nearbyNode?: preact.ComponentChildren; trending: Trend[]; places: Place[]; onPlace: (p: Place) => void; onMorePlaces: () => void; ladders: Record<string, MarketRow[]>; outlook: Record<string, number>; top: TopItem[]; onPick: (m: MarketRow, p: Pick) => void;
  stale?: boolean; details: boolean; friendBets: Record<string, number>; onOffer?: (m: MarketRow, o: OfferUse) => void;
  installEvt: Event | null;
}

export function Home(p: HomeProps) {
  const { msg } = p;
  const catOrder = catTiles(p.country, p.italian, p.counts);
  const tiles = catOrder.map((id) => ({ id, label: msg.tabs[id], count: p.counts[id] ?? 0, disabled: id === "gov", soon: id === "gov" ? msg.tabs.soon : undefined }));
  // the first five or six (the ones this country looks at first) are always on show, the rest fold away
  const EXTRA_CATS: CatId[] = catOrder.slice(p.italian ? 6 : 5);
  // Weather has sub-pills (rain, temperature, wind…) so the category row stays short; only the kinds that exist today are shown.
  const [wxSel, setWx] = useState<string>("all");
  const finKey = (m: MarketRow) => { const s = String(m.params.series ?? ""); return s.startsWith("metal:") ? "metals" : s.startsWith("oil:") ? "oil" : s.startsWith("fuel:") ? "fuel" : s.startsWith("fx:") ? "fx" : s.startsWith("power:") ? "power" : "crypto"; };
  const wxKey = (m: MarketRow) => (m.kind === "tick_gt" && m.category === "finance" ? finKey(m) : m.kind === "rain_at" ? "rain" : m.kind === "metric_gt" ? String(m.params.metric) : m.kind === "quake_m" ? String(m.params.region ?? "world") : "");
  const order = p.cat === "weather" ? ["rain", "temp", "wind", "snow", "uv", "aqi", "hail"] : p.cat === "nature" ? ["world", "jp", "it", "ca", "tr"] : p.cat === "finance" ? ["crypto", "metals", "fx", "oil", "fuel", "power"] : [];
  const [filterOpen, setFilterOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(() => safe.get("how") !== "1");
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
  const [seriesSel, setSeriesSel] = useState<number | null>(null);
  const [classSel, setClassSel] = useState<TrainClass | null>(null);
  const classes = p.cat === "train" ? (["hs", "ic", "reg"] as TrainClass[]).map((c) => [c, picked2.filter((m) => trainClass(m) === c).length] as const).filter(([, n]) => n > 0) : [];
  const cls = classes.some(([c]) => c === classSel) ? classSel : null;
  const [zoneSel, setZoneSel] = useState<string | null>(null);
  const zones = p.cat === "train" ? [...picked2.filter((m) => !cls || trainClass(m) === cls).reduce((acc, m) => { const z = trainZone(m); if (z) acc.set(z, (acc.get(z) ?? 0) + 1); return acc; }, new Map<string, number>())].sort((x, y) => x[0].localeCompare(y[0], "it")) : [];
  const zone = zones.some(([z]) => z === zoneSel) ? zoneSel : null;
  const followed = p.cat === "culture" ? followedShows() : [];
  const shown00 = (cls || zone) ? picked2.filter((m) => (!cls || trainClass(m) === cls) && (!zone || trainZone(m) === zone)) : picked2;
  const shown0 = seriesSel !== null && p.cat === "culture" ? shown00.filter((m) => Number(m.params.showId) === seriesSel) : shown00;
  const shown = p.cat === "nature" ? [...shown0].sort((a, b) => Date.parse(a.target_at) - Date.parse(b.target_at) || Number(a.params.minMag) - Number(b.params.minMag)) : shown0;
  const topId = shown.reduce<MarketRow | null>((b, m) => (!b || Number(m.odds_yes) > Number(b.odds_yes) ? m : b), null)?.id;
  const steamOf = (m: MarketRow) => { const sr = String(m.params.series ?? ""); return m.kind === "tick_gt" && sr.startsWith("steam:") ? sr.slice(6) : null; };
  const gameGroups = new Map<string, MarketRow[]>();
  if (p.cat === "culture") for (const m of shown) { const a = steamOf(m); if (a) gameGroups.set(a, [...(gameGroups.get(a) ?? []), m].sort((x, y) => Date.parse(x.target_at) - Date.parse(y.target_at))); }
  const plain0 = gameGroups.size ? shown.filter((m) => !steamOf(m)) : shown;
  // the hours of one city's rain question are one card (only when there are more than five hours), not a card for each
  const rainBy = new Map<string, MarketRow[]>();
  if (p.cat === "weather") for (const m of plain0) if (m.kind === "rain_at") rainBy.set(m.city_id, [...(rainBy.get(m.city_id) ?? []), m]);
  const rainGroups = [...rainBy.values()].filter((g) => g.length > 5);
  const grouped = new Set(rainGroups.flat().map((m) => m.id));
  const plain = grouped.size ? plain0.filter((m) => !grouped.has(m.id)) : plain0;
  const card = (m: MarketRow, i: number) => <EventCard key={m.id} m={m} msg={msg} locale={p.locale} now={p.now} live={p.live[m.id]} occ={p.occ[m.id]} index={i} mm={p.outlook[m.id]} friends={p.friendBets[m.id]} hasLadder={(p.ladders[m.id]?.length ?? 0) > 0} top={m.id === topId && shown.length > 3} showCity={p.filter === "world" || p.filter === "mine"} onPick={p.onPick} />;
  const cities = CITIES.filter((c) => enabledCategories(c).length > 0);
  // the flag of the chosen place is its own country (a place picked from "More cities" is not Italian), and it is shown once: a place of the list below is not repeated here
  const selCountry = CITIES.find((x) => x.id === p.filter)?.country ?? [...p.places, ...FEATURED_PLACES, ...p.trending.map((t) => t.place).filter((x): x is Place => !!x)].find((x) => x.id === p.filter)?.country ?? "IT";
  const placeName = (() => { const c = CITIES.find((x) => x.id === p.filter); if (c) return cityName(c, p.locale); return [...p.places, ...FEATURED_PLACES, ...p.trending.map((t) => t.place).filter((x): x is Place => !!x)].find((x) => x.id === p.filter)?.name ?? p.filter; })();
  /** What does exist in the chosen place: offered as buttons so nothing switches by itself. */
  const alt = tiles.filter((t) => !t.disabled && t.id !== p.cat && t.count > 0).slice(0, 4);
  // Italian players pick a region (up to five chips: their own first, then the biggest) or open the full alphabetical list
  const [regOpen, setRegOpen] = useState(false);
  const homeRegion = p.homePos ? regionOfPoint(p.homePos.lat, p.homePos.lon) : null, curRegion = isRegionFilter(p.filter) ? p.filter.slice(REGION_FILTER.length) : null;
  const regionChips = p.italian ? [...new Set([curRegion, homeRegion, ...TOP_REGIONS].filter((x): x is string => !!x))].slice(0, 5) : [];
  const regionCounts = useMemo(() => { const out: Record<string, number> = {}; if (regOpen) for (const m of p.markets ?? []) if (m.category === p.cat && Date.parse(m.closes_at) > p.now) { const r = regionOfCity(m.city_id); if (r) out[r] = (out[r] ?? 0) + 1; } return out; }, [regOpen, p.markets, p.cat]);
  return (
    <div class="home screen">
      <section class="hero" aria-label={msg.home.hero.title}>
        <i class="star s1" /><i class="star s2" />
        <h1>{msg.home.hero.title}</h1>
        <p>{msg.home.hero.body}</p>
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
        {p.onOffer && <PersonalOffer msg={msg} locale={p.locale} now={p.now} registered={p.registered} onUse={p.onOffer} />}
        <InstallHint locale={p.locale} invited={!!safe.get("ref")} />
        <Inbox registered={p.registered} ok={msg.common.close} locale={p.locale} />
        {p.italian && p.markets !== null && <TrainBoard variant="strip" markets={p.markets} live={p.live} msg={msg} locale={p.locale} now={p.now} onPick={p.onPick} onRefresh={p.onRefreshBoard} />}
        {p.top.length > 0 && (
          <section class="stack featured" style="gap:8px">
            <div class="sectionhead"><h2>{msg.home.top}</h2></div>
            <TopCards items={p.top} />
          </section>
        )}
      </div>
      <div class="main stack">
        <div class="chooser stack">
          <h2 class="steplabel">{msg.home.whatLabel}</h2>
          <CatChips baseCols={tiles.filter((t) => !EXTRA_CATS.includes(t.id)).length} tiles={tiles.filter((t) => phone || !EXTRA_CATS.includes(t.id) || catsOpen)} value={p.cat} onPick={p.onCat} />
          <button class={`morecats ${catsOpen ? "open" : ""}`} aria-expanded={catsOpen} onClick={() => setCatsOpen(!catsOpen)}>{catsOpen ? msg.home.lessCats : msg.home.moreCats}{!catsOpen && extraCount > 0 && <em>{extraCount}</em>}<ChevronDown size={16} /></button>
          {LOCAL_CATS.includes(p.cat) && <h2 class="steplabel">{msg.home.whereLabel}</h2>}
          {LOCAL_CATS.includes(p.cat) && (
            <div class="chiprow" role="tablist">
              <button class={`chip ${p.filter === "world" ? "on" : ""}`} role="tab" aria-selected={p.filter === "world"} onClick={() => p.onFilter("world")}><Globe size={16} />{msg.world}</button>
              {p.mine && <button class={`chip ${p.filter === "mine" ? "on" : ""}`} role="tab" aria-selected={p.filter === "mine"} onClick={() => p.onFilter("mine")}><Flag cc={p.mine} size={13} />{msg.near.title}{p.radiusKm ? ` · ${p.radiusKm} km` : ""}</button>}
              {regionChips.map((r) => <button key={r} class={`chip ${p.filter === REGION_FILTER + r ? "on" : ""}`} role="tab" aria-selected={p.filter === REGION_FILTER + r} onClick={() => p.onFilter(REGION_FILTER + r)}>{regionLabel(r, p.locale)}</button>)}
              {p.italian && <button class="chip more" aria-haspopup="dialog" onClick={() => setRegOpen(true)}><ChevronDown size={16} />{REG_MORE[p.locale] ?? REG_MORE["en-US"]}</button>}
              {p.italian && p.filter !== "world" && p.filter !== "mine" && !isRegionFilter(p.filter) && !p.places.some((pl) => pl.id === p.filter) && <button class="chip on" role="tab" aria-selected><Flag cc={selCountry} size={13} />{placeLabel(placeName, p.locale)}</button>}
              {(p.italian ? [] : startChips(p.country, p.locale)).map((ch) => { const pl = ch.place; return ch.city
                ? <button key={ch.city.id} class={`chip ${p.filter === ch.city.id ? "on" : ""}`} role="tab" aria-selected={p.filter === ch.city.id} onClick={() => p.onFilter(ch.city!.id)}><Flag cc={ch.city.country} size={13} />{cityName(ch.city, p.locale)}</button>
                : <button key={pl!.id} class={`chip ${p.filter === pl!.id ? "on" : ""}`} role="tab" aria-selected={p.filter === pl!.id} onClick={() => p.onPlace(pl!)}><Flag cc={pl!.country} size={13} />{placeLabel(pl!.name, p.locale)}</button>; })}
              {p.trending.filter((t) => !cities.find((c) => c.id === t.id)?.region && !startChips(p.country, p.locale).some((ch) => (ch.city?.id ?? ch.place?.id) === t.id)).map((t) => <button key={t.id} class={`chip trend ${p.filter === t.id ? "on" : ""}`} role="tab" aria-selected={p.filter === t.id} onClick={() => (t.place ? p.onPlace(t.place) : p.onFilter(t.id))}><Flag cc={t.country} size={13} />{placeLabel(t.name, p.locale)}<Flame size={13} /></button>)}
              {p.places.filter((pl) => !FEATURED_PLACES.some((f) => f.id === pl.id) && !p.trending.some((t) => t.id === pl.id)).map((pl) => <button key={pl.id} class="chip on" role="tab" aria-selected><Flag cc={pl.country} size={13} />{placeLabel(pl.name, p.locale)}</button>)}
              <button class="chip more" onClick={p.onMorePlaces}><Plus size={16} />{msg.places.more}</button>
            </div>
          )}
        </div>
        <ForYou msg={msg} locale={p.locale} now={p.now} markets={p.markets} registered={p.registered} home={p.homePos ?? null} onPick={p.onPick} onCreate={p.onCreate} />
        <div class="events stack">
          <div class="sectionhead evhead"><h2>{msg.home.events}</h2>
            <div class="evacts"><button class="createbtn" onClick={p.onCreate}><Plus size={16} />{msg.maker.open}</button>
          </div></div>
          {wxKinds.length > 1 && (
            <>
              <h2 class="steplabel">{msg.home.typeLabel}</h2>
              <div class="chiprow typerow" role="tablist">
                <button class={`chip ${wx === "all" ? "on" : ""}`} role="tab" aria-selected={wx === "all"} onClick={() => setWx("all")}>{msg.wx.all}<em>{p.list.length}</em></button>
                {wxKinds.map((k) => { const Icon = KIND_ICON[k]; return <button key={k} class={`chip ${wx === k ? "on" : ""}`} role="tab" aria-selected={wx === k} onClick={() => setWx(k)}>{Icon && <Icon size={16} />}{filterLabel(msg, k)}<em>{p.list.filter((m) => wxKey(m) === k).length}</em></button>; })}
              </div>
            </>
          )}
          {filterOpen && <FilterSheet msg={msg} options={wxKinds.map((k) => ({ key: k, count: p.list.filter((m) => wxKey(m) === k).length }))} value={wx} onPick={setWx} onClose={() => setFilterOpen(false)} />}
          {p.cat === "culture" && (
            <>
              <button class="btn secondary quakecta" onClick={() => p.onSeries()}><Tv size={18} />{msg.series.cta}</button>
              {followed.length > 0 && <div class="mkchips wrap" role="tablist" aria-label={msg.series.mine}>
                <button role="tab" aria-selected={seriesSel === null} class={`mkchip ${seriesSel === null ? "on" : ""}`} onClick={() => setSeriesSel(null)}>{msg.series.all}</button>
                {followed.map((f) => <button key={f.id} role="tab" aria-selected={seriesSel === f.id} class={`mkchip ${seriesSel === f.id ? "on" : ""}`} onClick={() => setSeriesSel(seriesSel === f.id ? null : f.id)} onDblClick={() => p.onSeries(f)}>{f.name}</button>)}
              </div>}
            </>
          )}
          {classes.length > 1 && <div class="mkchips" role="tablist" aria-label={msg.home.typeLabel}>
            <button role="tab" aria-selected={cls === null} class={`mkchip ${cls === null ? "on" : ""}`} onClick={() => setClassSel(null)}>{msg.series.all}</button>
            {classes.map(([c, n]) => <button key={c} role="tab" aria-selected={cls === c} class={`mkchip ${cls === c ? "on" : ""}`} onClick={() => setClassSel(cls === c ? null : c)}>{(CLASS_LABEL[p.locale] ?? CLASS_LABEL.it!)[c]} · {n}</button>)}
          </div>}
          {zones.length > 1 && <div class="mkchips" role="tablist" aria-label={msg.home.whereLabel}>
            <button role="tab" aria-selected={zone === null} class={`mkchip ${zone === null ? "on" : ""}`} onClick={() => setZoneSel(null)}>{msg.series.all}</button>
            {zones.map(([z, n]) => <button key={z} role="tab" aria-selected={zone === z} class={`mkchip ${zone === z ? "on" : ""}`} onClick={() => setZoneSel(zone === z ? null : z)}>{z} · {n}</button>)}
          </div>}
          {p.cat === "nature" && <button class="btn secondary quakecta" onClick={p.onQuakeMaker}><MapPin size={18} />{msg.quakeMaker.cta}</button>}
          {p.cat === "sport" && <label class="searchbox"><Search size={18} /><input class="field" type="search" value={teamQ} placeholder={msg.teamSearch} onInput={(e) => setTeamQ((e.target as HTMLInputElement).value)} /></label>}
          {p.cat === "sport" && p.markets !== null && !sportQ && <FrisbeeSoon locale={p.locale} />}
          {p.cat === "sport" && p.markets !== null && <MatchList matches={groupMatches(shown)} msg={msg} locale={p.locale} onPick={p.onPick} registered={p.registered} onAuth={p.onAuth} details={p.details} friendBets={p.friendBets} />}
          {p.stale && <p class="note warn">{msg.feedWarning}</p>}
          <div class="cardgrid" style={p.cat === "sport" ? "display:none" : undefined}>
            {p.filter === "mine" && p.mineWide && p.markets !== null && shown.length > 0 && <p class="hint" style="grid-column:1/-1;margin:0" role="note">{NEAR_WIDE[p.locale] ?? NEAR_WIDE["en-US"]}</p>}
            {p.markets === null && <div style="grid-column:1/-1"><LoadBar label={msg.common.loading} /></div>}
            {p.markets === null && [0, 1].map((i) => <div class="sk" key={i} />)}
            {p.markets !== null && p.cat === "traffic" && shown.length === 0 && <div style="grid-column:1/-1"><Empty icon={Car} title={msg.tabs.traffic} body={msg.home.trafficSoon} /></div>}
            {p.markets !== null && p.cat === "train" && (p.filter === "tokyo" || (p.filter === "world" && p.locale === "ja")) && <div style="grid-column:1/-1"><CrowdCard msg={msg} locale={p.locale} /></div>}
            {p.markets !== null && p.cat !== "traffic" && shown.length === 0 && !(p.cat === "train" && p.filter === "tokyo") && (
              <div style="grid-column:1/-1" class="stack">
                <Empty icon={CloudRain} title={msg.home.empty.title} body={LOCAL_CATS.includes(p.cat) && p.filter !== "world" && p.filter !== "mine" ? msg.home.hereNone(placeName) : `${msg.home.emptyCat[p.cat]} ${msg.home.empty.body}`} cta={p.filter !== "world" ? msg.home.empty.cta : undefined} onCta={() => p.onFilter("world")} />
                {alt.length > 0 && <div class="tryalt"><span>{msg.home.tryInstead}</span>{alt.map((t) => <button key={t.id} class="chip" onClick={() => p.onCat(t.id)}>{t.label}<em>{t.count}</em></button>)}</div>}
              </div>
            )}
            {rainGroups.map((g) => <RainGroup key={g[0]!.city_id} markets={g} locale={p.locale} now={p.now} onPick={p.onPick} />)}
            {[...gameGroups].map(([appid, ms]) => <GameGroup key={appid} appid={appid} count={ms.length}>{ms.map((m, i) => card(m, i))}</GameGroup>)}
            {p.markets !== null && p.cat === "train" && p.italian && plain.length === 0 && <div style="grid-column:1/-1"><TrainBoard variant="full" markets={p.markets ?? []} live={p.live} msg={msg} locale={p.locale} now={p.now} onPick={p.onPick} onRefresh={p.onRefreshBoard} /></div>}
            {plain.slice(0, 40).map((m, i) => <Fragment key={m.id}>{card(m, i)}{i === Math.min(2, plain.length - 1) && p.cat === "train" && p.italian && <div style="grid-column:1/-1"><TrainBoard variant="full" markets={p.markets ?? []} live={p.live} msg={msg} locale={p.locale} now={p.now} onPick={p.onPick} onRefresh={p.onRefreshBoard} /></div>}</Fragment>)}
          </div>
          <div class="nearwrap stack">{p.nearbyNode}{p.nearNode}</div>
        </div>
        <FriendsBets msg={msg} locale={p.locale} now={p.now} markets={p.markets} bets={p.friendBets} onPick={p.onPick} />
      </div>
      {regOpen && <RegionPanel locale={p.locale} current={curRegion} counts={regionCounts} onPick={(id) => { setRegOpen(false); p.onFilter(REGION_FILTER + id); }} onClose={() => setRegOpen(false)} />}
    </div>
  );
}
