import { Check, Crown, Gem, Lock, Sparkles, Star } from "lucide-preact";
import type { LucideIcon } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { PACK_RARITIES, PACKS, dealOf, dealPrice, lookChance, packRefund, REFUND_PCT, type PackDef, type PackRarity } from "../../../shared/shop.ts";
import { cardById } from "../../../shared/cards.ts";
import { INTL_TAG, type Locale, type Messages } from "../i18n/index.ts";
import { reducedMotion } from "../lib/anim.ts";
import { cardCaption, cardName } from "../lib/cardText.ts";
import { money } from "../lib/format.ts";
import { haptic } from "../lib/haptics.ts";
import { buyPack, errorCode, pending, type AlbumData, type PackOpen } from "../lib/shop.ts";
import { hubText } from "../lib/shopText.ts";
import { Figurine } from "./Figurine.tsx";
import { Card3D } from "./Card3D.tsx";
import "./Pack3D.css";
import { Look } from "./looks/Look.tsx";
import "./RewardsHub.css";

const TIER_ICON: Record<number, LucideIcon> = { 1: Sparkles, 2: Star, 3: Crown, 4: Gem };

/** A sealed pack drawn as two halves with a torn edge between them, so it can split when opened. */
function PackArt({ pack, name, taps = 0, open = false, big = false }: { pack: PackDef; name: string; taps?: number; open?: boolean; big?: boolean }) {
  const Icon = TIER_ICON[pack.tier] ?? Sparkles;
  const face = (
    <span class="pkface" aria-hidden="true"><i class="pkfoil" /><span class="pkico"><Icon /></span><b>{name}</b><i class="pkband" /></span>
  );
  return (
    <span class={`pk pt${pack.tier} ${big ? "big" : ""} ${open ? "open" : ""}`} data-taps={taps}>
      <span class="pkhalf top">{face}</span>
      <span class="pkhalf bot">{face}</span>
      <svg class="pkcrack" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true"><path d="M-2 66 L14 72 L28 64 L44 73 L58 63 L74 72 L88 64 L102 70" /></svg>
    </span>
  );
}

/** A burst of sparks, flying bars, a shock ring and (for the final one) a white flash. Remount it (new key) to play it again. */
function Burst({ n, big = false }: { n: number; big?: boolean }) {
  return (
    <span class="pkfx" aria-hidden="true">
      {big && <i class="flash" />}
      <i class="ring" />
      {Array.from({ length: n }, (_, i) => <i key={i} class={i % 3 === 0 ? "sq" : ""} style={`--a:${Math.round((i * 360) / n + (i % 2) * 7)}deg;--d:${(big ? 110 : 70) + ((i * 37) % (big ? 130 : 60))}px`} />)}
    </span>
  );
}

/** Odds as the player reads them: "77%", "3.5%", "0.5%". */
const pct = (bps: number, locale: Locale): string => new Intl.NumberFormat(INTL_TAG[locale], { maximumFractionDigits: 1 }).format(bps / 100) + "%";

export function PackShop({ locale, msg, album, credits, registered, onBought, onAlbum, onAuth, extra }: {
  locale: Locale; msg: Messages; album: AlbumData | null; credits: number; registered: boolean; extra?: preact.ComponentChildren;
  onBought: (r: PackOpen) => void; onAlbum: () => void; onAuth: () => void;
}) {
  const t = hubText(locale), s = t.shop;
  type Stage = { phase: "confirm"; tier: number } | { phase: "buying"; tier: number } | { phase: "sealed" | "opening" | "revealed"; r: PackOpen; taps: number };
  const [stage, setStage] = useState<Stage | null>(() => { const p = pending.get(); return p ? { phase: "sealed", r: p, taps: 0 } : null; });
  const [err, setErr] = useState<string | null>(null), [shake, setShake] = useState(0);
  const timer = useRef<number | undefined>(undefined), tapsRef = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  // the deal of the day (UTC): one pack costs less, the server charges the same price
  const deal = dealOf(Date.now()), priceOf = (pk: PackDef): number => (pk.tier === deal.tier ? dealPrice(pk.price, deal.pct) : pk.price);
  const packOf = (tier: number): PackDef => PACKS.find((p) => p.tier === tier) ?? PACKS[0]!;
  const full = (album?.opened_today ?? 0) >= (album?.daily_cap ?? 12);

  const buying = useRef(false);
  const buy = async (tier: number) => {
    if (buying.current) return;
    buying.current = true; setErr(null); setStage({ phase: "buying", tier });
    let r: PackOpen | { error: string };
    try { r = await buyPack(tier); } catch { r = { error: "generic" }; } finally { buying.current = false; }
    if ("error" in r) { setErr(s.errors[errorCode(r.error, Object.keys(s.errors))] ?? s.errors.generic!); setStage({ phase: "confirm", tier }); return; }
    pending.set(r); onBought(r); haptic.tap(); tapsRef.current = 0;
    setStage({ phase: "sealed", r, taps: 0 });
  };
  const tap = () => {
    if (!stage || stage.phase !== "sealed") return;
    // the count lives in a ref: very fast taps never read a stale number and none is lost
    const taps = ++tapsRef.current;
    haptic.tap(); setShake((n) => n + 1);
    if (taps < 3) { setStage((s) => (s && s.phase === "sealed" ? { ...s, taps } : s)); return; }
    haptic.success();
    if (reducedMotion()) { pending.clear(); setStage({ phase: "revealed", r: stage.r, taps }); return; }
    setStage({ phase: "opening", r: stage.r, taps });
    timer.current = window.setTimeout(() => { pending.clear(); setStage({ phase: "revealed", r: stage.r, taps }); }, 900);
  };
  const close = () => { tapsRef.current = 0; setStage(null); setErr(null); };

  // ---------- confirm ----------
  if (stage && (stage.phase === "confirm" || stage.phase === "buying")) {
    const pack = packOf(stage.tier), name = s.packs[pack.tier - 1]!, ok = credits >= priceOf(pack) && !full && registered;
    return (
      <section class="stack pkstage">
        <div class="pkplace"><PackArt pack={pack} name={name} big /></div>
        <h3 class="pktitle">{name}</h3>
        <p class="pkodds">{s.oddsLine(Object.fromEntries(PACK_RARITIES.map((r) => [r, pct(pack.odds[r], locale)])) as Record<PackRarity, string>)}</p>
        <p class="hint">{s.confirm}</p>
        <p class="hint">{s.looksShare(pct(Math.round(lookChance(pack.tier) * 10000), locale))}</p>
        <p class="hint">{s.dupRule(REFUND_PCT, money(packRefund(priceOf(pack)), locale))}</p>
        {err && <p class="dberr" role="alert">{err}</p>}
        {!ok && credits < priceOf(pack) && <p class="dberr">{s.notEnough}</p>}
        <button class="btn primary wide" disabled={!ok || stage.phase === "buying"} aria-busy={stage.phase === "buying"} onClick={() => buy(pack.tier)}>{s.pay(money(priceOf(pack), locale))}</button>
        <button class="btn secondary wide" disabled={stage.phase === "buying"} onClick={close}>{s.notNow}</button>
      </section>
    );
  }

  // ---------- sealed / opening ----------
  if (stage && (stage.phase === "sealed" || stage.phase === "opening")) {
    const r = stage.r, pack = packOf(r.tier), left = 3 - stage.taps, opening = stage.phase === "opening";
    return (
      <section class="stack pkstage">
        <p class={`pkcount halo h-${r.rarity}`} aria-live="polite"><span class="sr">{s.tap(left)}</span>{!opening && <b key={left} aria-hidden="true">{left}</b>}</p>
        <div class={`pkplace pk3d halo h-${r.rarity} ${opening ? "burst" : ""}`} data-taps={stage.taps}>
          <i class="pkhalo" aria-hidden="true" />
          <button class="pkbtn" onClick={tap} disabled={opening} aria-label={s.tapAria(left)}>
            <span class={`pkwrap s${shake % 2}`} key={shake}><PackArt pack={pack} name={s.packs[pack.tier - 1]!} taps={stage.taps} open={opening} big /></span>
          </button>
          {shake > 0 && <Burst key={`b${shake}${opening}`} n={opening ? 44 : 8 + stage.taps * 6} big={opening} />}
        </div>
      </section>
    );
  }

  // ---------- revealed ----------
  if (stage && stage.phase === "revealed") {
    const r = stage.r, card = r.kind === "card" ? cardById(r.item) : undefined;
    const lookName = r.kind === "avatar" ? msg.look.av[r.item] ?? r.item : msg.look.deco[r.item] ?? r.item;
    return (
      <section class="stack pkstage pkreveal">
        <div class={`pkplace pk3dplace halo h-${r.rarity} shown`}>
          <i class="pkhalo" aria-hidden="true" />
          <Burst n={36} big />
          {card ? <Card3D rarity={r.rarity} front={<Figurine card={card} name={cardName(card.n, locale)} numText={t.album.number(card.n)} big />} /> : null}
          {card ? <span class={`rvtag inl ${r.duplicate ? "dup" : "new"}`}>{r.duplicate ? s.duplicate : s.isNew}</span>
            : <div class="rvcard">
              <div class="rvlook"><Look avatar={r.kind === "avatar" ? r.item : "conductor"} decoration={r.kind === "decoration" ? r.item : null} size={168} label={lookName} /></div>
              <span class={`rvtag ${r.duplicate ? "dup" : "new"}`}>{r.duplicate ? s.duplicate : s.isNew}</span>
            </div>}
        </div>
        <h3 class="pktitle">{card ? cardName(card.n, locale) : lookName}</h3>
        <p class="rvmeta"><span class={`rchip r-${r.rarity}`}>{t.album.rar[r.rarity]}</span><span>{card ? t.album.number(card.n) : r.kind === "avatar" ? t.album.avatar : t.album.decoration}</span></p>
        {card && <p class="rvcap">“{cardCaption(card.n, locale)}”</p>}
        <p class={`rvline ${r.duplicate ? "dup" : ""}`}><Check size={16} strokeWidth={3} />{r.duplicate ? s.dupBack(money(r.refund, locale)) : s.added}</p>
        <button class="btn primary wide" onClick={close}>{s.done}</button>
        <button class="btn secondary wide" onClick={() => { close(); onAlbum(); }}>{s.seeAlbum}</button>
      </section>
    );
  }

  // ---------- list ----------
  return (
    <section class="stack pkshop">
      <p class="hint">{s.intro}</p>
      {!registered && <div class="card pkguest"><Lock size={18} /><p>{s.needAccount}</p><button class="btn primary" onClick={onAuth}>{s.makeProfile}</button></div>}
      <ul class="pklist">
        {PACKS.map((pack) => {
          const name = s.packs[pack.tier - 1]!, price = priceOf(pack), onDeal = pack.tier === deal.tier, can = registered && credits >= price && !full;
          return (
            <li key={pack.tier} class={`pkrow pt${pack.tier} ${onDeal ? "deal" : ""} ${full ? "off" : ""}`}>
              <div class="pkmini"><PackArt pack={pack} name={name} />{onDeal && <span class="dealtag" aria-hidden="true">-{deal.pct}%</span>}</div>
              <div class="pkinfo">
                <b>{name}{onDeal && <em class="dealname">{s.deal}</em>}</b>
                <span class="pkbar" role="img" aria-label={s.odds}>{PACK_RARITIES.filter((r) => pack.odds[r] > 0).map((r) => <i key={r} class={`r-${r}`} style={`flex:${pack.odds[r]}`} />)}</span>
                <span class="pkodds">{s.oddsLine(Object.fromEntries(PACK_RARITIES.map((r) => [r, pct(pack.odds[r], locale)])) as Record<PackRarity, string>)}</span>
              </div>
              <button class="btn primary pkbuy" disabled={!registered || full} onClick={() => { setErr(null); setStage({ phase: "confirm", tier: pack.tier }); }} aria-label={`${name}: ${s.buy(money(price, locale))}${onDeal ? ` (-${deal.pct}%)` : ""}`}>
                {onDeal && <s class="was">{money(pack.price, locale)}</s>}<span>{money(price, locale)}</span>{!can && registered && !full && <em>{s.notEnough}</em>}
              </button>
            </li>
          );
        })}
      </ul>
      {album && <p class="hint">{full ? s.limitHit : s.limit(album.opened_today, album.daily_cap)}</p>}
      <p class="hint">{s.dupRule(REFUND_PCT, `${money(packRefund(60), locale)}–${money(packRefund(2000), locale)}`)}</p>
      <p class="hint">{s.sink}</p>
      {extra}
    </section>
  );
}
