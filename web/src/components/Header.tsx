import { Clock3, Languages, Volume2, VolumeX } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { LOCALES, type Locale } from "../i18n/index.ts";

/** Sticky top bar: it gains a light blur and a hairline once the page scrolls under it. */
export function Header({ claimable, onWallet, voice, locale, onLocale, wallet, coin, languageLabel, creditsLabel, onHome }: { locale: Locale; onLocale: (l: Locale) => void; wallet: string; coin: string; claimable: number; onWallet: () => void; voice: { on: boolean; label: string; toggle: () => void } | null; languageLabel: string; creditsLabel: string; onHome: () => void }) {
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
        <button class="brand" onClick={onHome} aria-label="LateLotto"><i><Clock3 size={20} strokeWidth={2.4} /></i><span>Late<b>Lotto</b></span></button>
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
