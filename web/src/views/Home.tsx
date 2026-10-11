import { CloudRain } from "lucide-preact";
import { CatChips, type CatId } from "../components/CatChips.tsx";
import { Empty } from "../components/Empty.tsx";
import { EventCard } from "../components/EventCard.tsx";
import { Flag } from "../components/Flag.tsx";
import { LiveLine } from "../components/LiveLine.tsx";
import { Missions } from "../components/Missions.tsx";
import { TopCards, type TopItem } from "../components/TopCards.tsx";
import { Globe } from "lucide-preact";
import type { Locale, Messages } from "../i18n/index.ts";
import { cityName, CITIES, enabledCategories } from "../lib/cities.ts";
import type { MarketRow } from "../lib/format.ts";
import type { LiveDelay, Pick, Progress } from "../lib/types.ts";

export interface HomeProps {
  msg: Messages; locale: Locale; now: number; markets: MarketRow[] | null; list: MarketRow[]; live: Record<string, LiveDelay>;
  cat: CatId; counts: Record<CatId, number>; onCat: (c: CatId) => void; filter: string; onFilter: (f: string) => void;
  top: TopItem[]; progress: Progress | null; liveItems: string[]; onPick: (m: MarketRow, p: Pick) => void;
  attributions: { name: string; via?: string; license: string; licenseUrl: string; url: string }[]; installEvt: Event | null;
}

export function Home(p: HomeProps) {
  const { msg } = p;
  const tiles = (["bus", "train", "weather", "traffic"] as CatId[]).map((id) => ({ id, label: msg.tabs[id], count: p.counts[id], disabled: id === "traffic" }));
  const cities = CITIES.filter((c) => enabledCategories(c).length > 0);
  return (
    <div class="home screen">
      <LiveLine items={p.liveItems} label={msg.home.live} />
      <div class="aside">
        <Missions progress={p.progress} msg={msg} />
        {p.top.length > 0 && (
          <section class="stack" style="gap:8px">
            <div class="sectionhead"><h2>{msg.home.top}</h2></div>
            <TopCards items={p.top} />
          </section>
        )}
      </div>
      <div class="main stack">
        <div class="sectionhead"><h2>{msg.home.events}</h2></div>
        <CatChips tiles={tiles} value={p.cat} onPick={p.onCat} />
        <div class="chiprow" role="tablist">
          <button class={`chip ${p.filter === "world" ? "on" : ""}`} role="tab" aria-selected={p.filter === "world"} onClick={() => p.onFilter("world")}><Globe size={16} />{msg.world}</button>
          {cities.map((c) => <button key={c.id} class={`chip ${p.filter === c.id ? "on" : ""}`} role="tab" aria-selected={p.filter === c.id} onClick={() => p.onFilter(c.id)}><Flag cc={c.country} size={13} />{cityName(c, p.locale)}</button>)}
        </div>
        <div class="cardgrid">
          {p.markets === null && [0, 1, 2].map((i) => <div class="sk" key={i} />)}
          {p.markets !== null && p.cat === "traffic" && <div style="grid-column:1/-1"><Empty icon={CloudRain} title={msg.tabs.traffic} body={msg.home.trafficSoon} /></div>}
          {p.markets !== null && p.cat !== "traffic" && p.list.length === 0 && <div style="grid-column:1/-1"><Empty icon={CloudRain} title={msg.home.empty.title} body={msg.home.empty.body} cta={p.filter !== "world" ? msg.home.empty.cta : undefined} onCta={() => p.onFilter("world")} /></div>}
          {p.list.slice(0, 40).map((m, i) => <EventCard key={m.id} m={m} msg={msg} locale={p.locale} now={p.now} live={p.live[m.id]} index={i} showCity={p.filter === "world"} onPick={p.onPick} />)}
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
