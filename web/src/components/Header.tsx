import { Languages, Volume2, VolumeX } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { LOCALES, type Locale } from "../i18n/index.ts";

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

export function Header({ satire, claimable, onWallet, voice, locale, onLocale, wallet, coin, languageLabel, creditsLabel, onHome }: { satire?: string; locale: Locale; onLocale: (l: Locale) => void; wallet: string; coin: string; claimable: number; onWallet: () => void; voice: { on: boolean; label: string; toggle: () => void } | null; languageLabel: string; creditsLabel: string; onHome: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const f = () => setScrolled(scrollY > 4);
    f(); addEventListener("scroll", f, { passive: true });
    return () => removeEventListener("scroll", f);
  }, []);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    addEventListener("pointerdown", away); addEventListener("keydown", esc);
    return () => { removeEventListener("pointerdown", away); removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <header class={`header ${scrolled ? "scrolled" : ""}`}>
      <div class="header-in">
        <button class="brand" onClick={onHome} aria-label="LateBet"><i><BrandMark /></i><span class="tx"><span class="wm">Late<b>BET</b></span>{satire && <em class="stag">{satire}</em>}</span></button>
        <div class="grow" />
        {voice && <button class={`iconbtn ${voice.on ? "voiceon" : ""}`} onClick={voice.toggle} aria-pressed={voice.on} aria-label={voice.label}>{voice.on ? <Volume2 size={22} /> : <VolumeX size={22} />}</button>}
        <div class="relative" ref={box}>
          <button class="iconbtn" aria-haspopup="menu" aria-expanded={open} aria-label={languageLabel} onClick={() => setOpen(!open)}><Languages size={22} /></button>
          {open && (
            <div class="langpop" role="menu">
              {LOCALES.map((l) => (
                <button key={l.id} role="menuitemradio" aria-checked={l.id === locale} class={l.id === locale ? "on" : ""} onClick={() => { onLocale(l.id); setOpen(false); }}><b>{l.short}</b><span>{l.label}</span></button>
              ))}
            </div>
          )}
        </div>
        <button class="wallet walletbtn" aria-live="polite" title={creditsLabel} aria-label={creditsLabel} onClick={onWallet}><i class="coin" aria-hidden="true">{coin}</i><span class="num">{wallet}</span>{claimable > 0 && <span class="dotbadge">{claimable}</span>}</button>
      </div>
    </header>
  );
}
