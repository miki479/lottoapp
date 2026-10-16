import { ChevronLeft, Lock } from "lucide-preact";
import { useState } from "preact/hooks";
import { CARDS, CARD_CATS, cardsOfCat, type CardCat } from "../../../shared/cards.ts";
import type { Locale, Messages } from "../i18n/index.ts";
import { cardCaption, cardName } from "../lib/cardText.ts";
import { money } from "../lib/format.ts";
import type { AlbumData } from "../lib/shop.ts";
import { hubText } from "../lib/shopText.ts";
import { Figurine } from "./Figurine.tsx";
import { Look } from "./looks/Look.tsx";
import { Sheet } from "./Sheet.tsx";
import "./RewardsHub.css";

type View = "home" | "looks" | CardCat;

/** The collection: a cover with one tile per category, then the numbered cards of a category (owned or still a silhouette), then the looks. */
export function Album({ locale, msg, data, onRetry }: { locale: Locale; msg: Messages; data: AlbumData | null | undefined; onRetry: () => void }) {
  const t = hubText(locale), a = t.album;
  const [view, setView] = useState<View>("home"), [zoom, setZoom] = useState<number | null>(null);
  if (data === undefined) return <section class="stack"><div class="sk s" /><div class="sk s" /></section>;
  if (!data) return <section class="stack"><p class="hint">{a.loadError}</p><button class="btn secondary" onClick={onRetry}>{a.retry}</button></section>;
  const own = new Map(data.items.map((i) => [`${i.kind}:${i.id}`, i]));
  const has = (id: string) => own.get(`card:${id}`)?.owned ?? false;
  const copies = (id: string) => own.get(`card:${id}`)?.copies ?? 0;
  const looks = data.items.filter((i) => i.kind !== "card");
  const looksOwned = looks.filter((i) => i.owned).length;
  const back = <button class="linkbtn albback" onClick={() => setView("home")}><ChevronLeft size={16} />{a.all}</button>;

  const zc = zoom ? CARDS[zoom - 1] : undefined;
  const sheet = zc && (
    <Sheet onClose={() => setZoom(null)} label={cardName(zc.n, locale)}>
      <div class="stack pkreveal" style="align-items:center;text-align:center">
        <div class={`pkplace halo h-${zc.rarity} shown`}><i class="pkhalo" aria-hidden="true" /><div class="rvcard"><Figurine card={zc} name={cardName(zc.n, locale)} numText={a.number(zc.n)} owned={has(zc.id)} big /></div></div>
        <h3 class="pktitle">{has(zc.id) ? cardName(zc.n, locale) : a.missing}</h3>
        <p class="rvmeta"><span class={`rchip r-${zc.rarity}`}>{a.rar[zc.rarity]}</span><span>{a.number(zc.n)} · {a.cats[zc.cat]}</span></p>
        {has(zc.id) && <p class="rvcap">“{cardCaption(zc.n, locale)}”</p>}
        {copies(zc.id) > 1 && <p class="hint">{a.copies(copies(zc.id))}</p>}
        <button class="btn secondary wide" onClick={() => setZoom(null)}>{msg.common.close}</button>
      </div>
    </Sheet>
  );

  if (view === "home") {
    return (
      <section class="stack albhome">
        <div class="card albtotal">
          <b class="num">{a.progress(data.owned, data.total)}</b>
          <span class="albbar" role="progressbar" aria-valuenow={data.owned} aria-valuemax={data.total}><i style={`width:${Math.round((data.owned / Math.max(1, data.total)) * 100)}%`} /></span>
          {data.owned === 0 && <p class="hint">{a.empty}</p>}
        </div>
        <ul class="albcats">
          {CARD_CATS.map((c) => {
            const list = cardsOfCat(c), n = list.filter((x) => has(x.id)).length;
            return (
              <li key={c}><button class={`albcat fc-${c}`} onClick={() => setView(c)}>
                <span class="albcatname">{a.cats[c]}</span><b class="num">{a.of(n, list.length)}</b>
                <span class="albbar sm"><i style={`width:${Math.round((n / list.length) * 100)}%`} /></span>
              </button></li>
            );
          })}
          <li><button class="albcat looksb" onClick={() => setView("looks")}><span class="albcatname">{a.looks}</span><b class="num">{a.of(looksOwned, looks.length)}</b><span class="albbar sm"><i style={`width:${Math.round((looksOwned / Math.max(1, looks.length)) * 100)}%`} /></span></button></li>
        </ul>
        <p class="hint">{a.stats(money(data.spent, locale), money(data.refunded, locale))}</p>
        <p class="hint">{a.wearHint}</p>
        {sheet}
      </section>
    );
  }

  if (view === "looks") {
    return (
      <section class="stack">
        {back}
        <h3>{a.looks} · {a.of(looksOwned, looks.length)}</h3>
        <div class="alblooks">
          {looks.map((i) => {
            const nm = i.kind === "avatar" ? msg.look.av[i.id] ?? i.id : msg.look.deco[i.id] ?? i.id;
            return (
              <div key={`${i.kind}${i.id}`} class={`alblook ${i.owned ? "" : "miss"}`}>
                <span class="lkpic"><Look avatar={i.kind === "avatar" ? i.id : "conductor"} decoration={i.kind === "decoration" ? i.id : null} size={64} label={nm} />{!i.owned && <span class="lklock"><Lock size={16} /></span>}</span>
                <small>{i.owned ? nm : a.missing}</small>
                <em class={`rchip r-${i.rarity}`}>{a.rar[i.rarity]}</em>
              </div>
            );
          })}
        </div>
        <p class="hint">{a.wearHint}</p>
      </section>
    );
  }

  const list = cardsOfCat(view);
  return (
    <section class="stack">
      {back}
      <h3>{a.cats[view]} · {a.of(list.filter((c) => has(c.id)).length, list.length)}</h3>
      <div class="albgrid">
        {list.map((c) => (
          <button key={c.id} class="albcell" onClick={() => setZoom(c.n)} aria-label={has(c.id) ? `${a.number(c.n)}: ${cardName(c.n, locale)}` : `${a.number(c.n)}: ${a.missing}`}>
            <Figurine card={c} name={cardName(c.n, locale)} numText={a.number(c.n)} owned={has(c.id)} />
            {copies(c.id) > 1 && <span class="albcopies num">×{copies(c.id)}</span>}
          </button>
        ))}
      </div>
      {sheet}
    </section>
  );
}
