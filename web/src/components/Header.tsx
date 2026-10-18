import { ShoppingBag, Volume2, VolumeX } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { LOCALES, type Locale } from "../i18n/index.ts";
import { reducedMotion, useCountUp } from "../lib/anim.ts";
import { fmtInt, fmtSigned } from "../lib/num.ts";

/** Sticky top bar: it gains a light blur and a hairline once the page scrolls under it. */
/** The mark: a gold betting chip with the clock hands in it. */
export function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
      <defs><linearGradient id="bm-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe27a" /><stop offset=".6" stop-color="#ffb000" /><stop offset="1" stop-color="#c46a00" /></linearGradient></defs>
      <rect width="32" height="32" rx="9" fill="#1d0f55" />
      <circle cx="16" cy="16" r="11" fill="url(#bm-g)" />
      <g stroke="#fff6d6" stroke-width="2.6">{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <path key={a} d="M16 5.2v2.6" transform={`rotate(${a} 16 16)`} />)}</g>
      <circle cx="16" cy="16" r="7.2" fill="#1d0f55" />
      <path d="M16 11.3v5.2l3.4 2" fill="none" stroke="#ffd24a" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

/** A balance written with more characters than this (a million and up) steps down one size, so it never runs out of the bar on a phone. */
const LONG_FIGURE = 6;

/**
 * The balance, a group of its own in the top bar: every change counts up or down in 400 ms, flashes green or red and leaves a chip with the difference for
 * a moment (all of it off for people who ask for less motion). A different player (signing in or out) is not a change.
 */
function Balance({ credits, who, locale, coin, label, claimable, onClick }: { credits: number | null; who: string | null; locale: Locale; coin: string; label: string; claimable: number; onClick: () => void }) {
  const shown = useCountUp(credits ?? 0, 400);
  const [tap, setTap] = useState(0);
  const press = () => { if (!reducedMotion()) { setTap(Date.now()); } onClick(); };
  const last = useRef<{ who: string | null; credits: number | null }>({ who: null, credits: null });
  const [change, setChange] = useState<{ n: number; at: number } | null>(null);
  useEffect(() => {
    if (credits === null) return;
    const before = last.current;
    last.current = { who, credits };
    if (before.credits === null || before.who !== who || before.credits === credits || reducedMotion()) return;
    setChange({ n: credits - before.credits, at: Date.now() });
    const t = window.setTimeout(() => setChange(null), 1500);
    return () => window.clearTimeout(t);
  }, [credits, who]);
  const kind = change ? (change.n > 0 ? "gain" : "loss") : "";
  const figure = credits === null ? "···" : fmtInt(shown, locale);
  return (
    <>
      <button class={`wallet walletbtn ${kind} ${figure.length > LONG_FIGURE ? "long" : ""} ${tap ? "tapped" : ""}`} key={tap ? `t${tap}` : "w"} title={label} aria-label={credits === null ? label : `${label}: ${fmtInt(credits, locale)}`} onClick={press}>
        <i class="coin" aria-hidden="true">{coin}</i>
        {tap > 0 && <span class="coinburst" aria-hidden="true"><b /><b /><b /><b /><b /><b /></span>}
        <span class="num bal" aria-hidden="true">{figure}</span>
        {claimable > 0 && <span class="dotbadge" aria-hidden="true">{claimable}</span>}
        {change && <span class={`deltachip ${kind}`} key={change.at} aria-hidden="true">{fmtSigned(change.n, locale)}</span>}
      </button>
      <span class="sr" role="status">{credits === null ? "" : `${label}: ${fmtInt(credits, locale)}`}</span>
    </>
  );
}

export function Header({ satire, claimable, onWallet, onShop, shopNew, shopLabel, shopDeal, voice, locale, onLocale, credits, who, coin, languageLabel, creditsLabel, onHome }: { satire?: string; locale: Locale; onLocale: (l: Locale) => void; credits: number | null; who: string | null; coin: string; claimable: number; onWallet: () => void; onShop: () => void; shopNew: boolean; shopLabel: string; shopDeal?: number; voice: { on: boolean; label: string; toggle: () => void } | null; languageLabel: string; creditsLabel: string; onHome: () => void }) {
  const [scrolled, setScrolled] = useState(false), [compact, setCompact] = useState(false);
  useEffect(() => {
    // the bar shrinks past 56 px and grows back under 16, so it never flickers at the edge
    const f = () => { setScrolled(scrollY > 4); setCompact((c) => (c ? scrollY > 16 : scrollY > 56)); };
    f(); addEventListener("scroll", f, { passive: true });
    return () => removeEventListener("scroll", f);
  }, []);
  return (
    <header class={`header ${scrolled ? "scrolled" : ""} ${compact ? "compact" : ""}`}>
      <div class="header-in">
        <button class="brand" onClick={onHome} aria-label="LateBet.it"><i><BrandMark /></i><span class="tx"><span class="wm">Late<b>BET</b><span class="tld">.it</span></span>{satire && <em class="stag">{satire}</em>}</span></button>
        <div class="grow" />
        <div class="hdr-tools">
        <button class={`iconbtn shopbtn ${shopNew ? "new" : ""}`} onClick={onShop} aria-label={shopLabel} title={shopLabel}><ShoppingBag size={22} />{(shopNew || !!shopDeal) && <i class={`shopdot ${shopDeal ? "deal" : ""}`} aria-hidden="true">{shopDeal ? `-${shopDeal}%` : ""}</i>}</button>
        {voice && <button class={`iconbtn voicebtn ${voice.on ? "voiceon" : ""}`} onClick={voice.toggle} aria-pressed={voice.on} aria-label={voice.label}>{voice.on ? <Volume2 size={22} /> : <VolumeX size={22} />}</button>}
        </div>
        <Balance credits={credits} who={who} locale={locale} coin={coin} label={creditsLabel} claimable={claimable} onClick={onWallet} />
      </div>
    </header>
  );
}
