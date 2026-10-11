import { CloudRain } from "lucide-preact";
import { CatChips, type CatId } from "../components/CatChips.tsx";
import { Empty } from "../components/Empty.tsx";
import { CrowdCard } from "../components/CrowdCard.tsx";
import { EventCard } from "../components/EventCard.tsx";
import { Flag } from "../components/Flag.tsx";
import { TopCards, type TopItem } from "../components/TopCards.tsx";
import { Globe, Sparkles } from "lucide-preact";
import { useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { cityName, CITIES, enabledCategories } from "../lib/cities.ts";
import { Flame, Plus } from "lucide-preact";
import { FEATURED_CITY_IDS, FEATURED_PLACES, type Place } from "../lib/places.ts";
import type { MarketRow } from "../lib/format.ts";
import type { LiveDelay, Pick, Progress } from "../lib/types.ts";

export interface Trend { id: string; name: string; country: string; place?: Place }
export interface HomeProps {
  msg: Messages; locale: Locale; now: number; markets: MarketRow[] | null; list: MarketRow[]; live: Record<string, LiveDelay>;
  cat: CatId; counts: Record<CatId, number>; onCat: (c: CatId) => void; filter: string; onFilter: (f: string) => void;
  strikes: MarketRow[]; nearNode?: preact.ComponentChildren; trending: Trend[]; places: Place[]; onPlace: (p: Place) => void; onMorePlaces: () => void; ladders: Record<string, MarketRow[]>; outlook: Record<string, number>; top: TopItem[]; onPick: (m: MarketRow, p: Pick) => void;
  attributions: { name: string; via?: string; license: string; licenseUrl: string; url: string }[]; installEvt: Event | null;
}

export function Home(p: HomeProps) {
  const { msg } = p;
  const tiles = (["bus", "train", "weather", "nature", "traffic"] as CatId[]).map((id) => ({ id, label: msg.tabs[id], count: p.counts[id], disabled: id === "traffic" }));
  // Weather has sub-pills (rain, temperature, wind…) so the category row stays short; only the kinds that exist today are shown.
  const [wxSel, setWx] = useState<string>("all");
  const wxKey = (m: MarketRow) => (m.kind === "rain_at" ? "rain" : m.kind === "metric_gt" ? String(m.params.metric) : "");
  const wxKinds = p.cat === "weather" ? ["rain", "temp", "wind", "snow", "uv", "aqi"].filter((k) => p.list.some((m) => wxKey(m) === k)) : [];
  const wx = wxKinds.includes(wxSel) ? wxSel : "all";
  const shown = p.cat === "weather" && wx !== "all" ? p.list.filter((m) => wxKey(m) === wx) : p.list;
  const topId = shown.reduce<MarketRow | null>((b, m) => (!b || Number(m.odds_yes) > Number(b.odds_yes) ? m : b), null)?.id;
  const cities = CITIES.filter((c) => enabledCategories(c).length > 0);
  return (
    <div class="home screen">
      <section class="hero" aria-label={msg.home.hero.title}>
        <i class="star s1" /><i class="star s2" /><i class="star s3" /><i class="star s4" />
        <span class="hero-ico"><Sparkles size={22} /></span>
        <h1>{msg.home.hero.title}</h1>
        <p>{msg.home.hero.body}</p>
      </section>
      <div class="aside">
        {p.top.length > 0 && (
          <section class="stack" style="gap:8px">
            <div class="sectionhead"><h2>{msg.home.top}</h2></div>
            <TopCards items={p.top} />
          </section>
        )}
        {p.nearNode}
      </div>
      <div class="main stack">
        {p.strikes.length > 0 && (
          <section class="stack" style="gap:8px">
            <div class="sectionhead"><h2>{msg.strikes.title}</h2></div>
            <p class="hint">{msg.strikes.sub}</p>
            <div class="cardgrid">{p.strikes.map((m, i) => <EventCard key={m.id} m={m} msg={msg} locale={p.locale} now={p.now} index={i} hasLadder={false} showCity={false} onPick={p.onPick} />)}</div>
          </section>
        )}
        <div class="sectionhead"><h2>{msg.home.events}</h2></div>
        <CatChips tiles={tiles} value={p.cat} onPick={p.onCat} />
        {wxKinds.length > 1 && <div class="wxpills" role="tablist">{["all", ...wxKinds].map((k) => <button key={k} role="tab" aria-selected={wx === k} class={wx === k ? "on" : ""} onClick={() => setWx(k)}>{k === "all" ? msg.wx.all : k === "rain" ? msg.wx.rain : msg.wx.names[k as "temp"]}</button>)}</div>}
        <div class="chiprow" role="tablist">
          <button class={`chip ${p.filter === "world" ? "on" : ""}`} role="tab" aria-selected={p.filter === "world"} onClick={() => p.onFilter("world")}><Globe size={16} />{msg.world}</button>
          {cities.filter((c) => FEATURED_CITY_IDS.includes(c.id)).map((c) => <button key={c.id} class={`chip ${p.filter === c.id ? "on" : ""}`} role="tab" aria-selected={p.filter === c.id} onClick={() => p.onFilter(c.id)}><Flag cc={c.country} size={13} />{cityName(c, p.locale)}</button>)}
          {FEATURED_PLACES.map((pl) => <button key={pl.id} class={`chip ${p.filter === pl.id ? "on" : ""}`} role="tab" aria-selected={p.filter === pl.id} onClick={() => p.onPlace(pl)}><Flag cc={pl.country} size={13} />{pl.name}</button>)}
          {p.trending.map((t) => <button key={t.id} class={`chip trend ${p.filter === t.id ? "on" : ""}`} role="tab" aria-selected={p.filter === t.id} onClick={() => (t.place ? p.onPlace(t.place) : p.onFilter(t.id))}><Flag cc={t.country} size={13} />{t.name}<Flame size={13} /></button>)}
          {p.places.filter((pl) => !FEATURED_PLACES.some((f) => f.id === pl.id) && !p.trending.some((t) => t.id === pl.id)).map((pl) => <button key={pl.id} class="chip on" role="tab" aria-selected><Flag cc={pl.country} size={13} />{pl.name}</button>)}
          <button class="chip more" onClick={p.onMorePlaces}><Plus size={16} />{msg.places.more}</button>
        </div>
        <div class="cardgrid">
          {p.markets === null && [0, 1, 2].map((i) => <div class="sk" key={i} />)}
          {p.markets !== null && p.cat === "traffic" && <div style="grid-column:1/-1"><Empty icon={CloudRain} title={msg.tabs.traffic} body={msg.home.trafficSoon} /></div>}
          {p.markets !== null && p.cat === "train" && (p.filter === "tokyo" || (p.filter === "world" && p.locale === "ja")) && <div style="grid-column:1/-1"><CrowdCard msg={msg} locale={p.locale} /></div>}
          {p.markets !== null && p.cat !== "traffic" && shown.length === 0 && !(p.cat === "train" && p.filter === "tokyo") && <div style="grid-column:1/-1"><Empty icon={CloudRain} title={msg.home.empty.title} body={msg.home.empty.body} cta={p.filter !== "world" ? msg.home.empty.cta : undefined} onCta={() => p.onFilter("world")} /></div>}
          {shown.slice(0, 40).map((m, i) => <EventCard key={m.id} m={m} msg={msg} locale={p.locale} now={p.now} live={p.live[m.id]} index={i} mm={p.outlook[m.id]} hasLadder={(p.ladders[m.id]?.length ?? 0) > 0} top={m.id === topId && shown.length > 3} showCity={p.filter === "world"} onPick={p.onPick} />)}
        </div>
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
