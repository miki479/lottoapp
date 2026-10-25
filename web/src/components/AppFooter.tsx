import type { Locale, Messages } from "../i18n/index.ts";
import { ContactForm } from "./ContactForm.tsx";

const isDark = () => { const t = document.documentElement.dataset.theme; return t === "dark" || (t !== "light" && typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches); };
/** The Stripe Climate badge (the business sends part of its income to carbon removal): in the footer, small, loaded only when it scrolls into view, in the colours of the theme. */
function ClimateBadge({ locale }: { locale: Locale }) {
  const dark = isDark(), lang = locale === "it" ? "it-IT" : locale === "ja" ? "ja-JP" : locale === "en-GB" ? "en-GB" : "en-US";
  const src = dark ? `https://climate.stripe.com/badge/ASV9RU?theme=dark&size=small&locale=${lang}` : `https://climate.stripe.com/badge/EYeziI?theme=light&size=small&locale=${lang}`;
  return <p class="climate"><iframe title="Stripe Climate" src={src} width={dark ? 380 : 420} height="38" loading="lazy" referrerpolicy="no-referrer" /></p>;
}

const BUSONE: Record<string, [string, string]> = { it: ["Dati di trasporto: ", " e la fonte originale dei dati."], "en-US": ["Transport data: ", " and the original data source."], "en-GB": ["Transport data: ", " and the original data source."], ja: ["交通データ：", "および各データの提供元。"] };

export interface Source { name: string; via?: string; license: string; licenseUrl: string; url: string }

/** The one footer of the app, under every screen: the disclaimer (once, small and muted), the full wording, the pages that explain the game and the sources of the data. */
export function AppFooter({ msg, sources, locale }: { msg: Messages; sources: Source[]; locale: Locale }) {
  return (
    <footer class="legal">
      <p class="legalshort"><b class="age18" title="18+">18+</b> {msg.disclaimerShort}</p>
      <p class="legalfull">{msg.disclaimerFull}</p>
      <p class="legallinks"><a href="/how-it-works.html">{msg.profile.howItWorks}</a><a href="/terms.html">{msg.profile.terms}</a><a href="/privacy.html">{msg.profile.privacy}</a></p>
      <p class="busone">{(BUSONE[locale] ?? BUSONE["en-US"]!)[0]}<a href="https://busone.app" target="_blank" rel="noopener noreferrer">BusOne (https://busone.app)</a>{(BUSONE[locale] ?? BUSONE["en-US"]!)[1]}</p>
      <ContactForm locale={locale} />
      <ClimateBadge locale={locale} />
      <details><summary>{msg.attributionTitle}</summary>
        {sources.some((a) => a.url.includes("developer.odpt.org")) && <p class="odptnote">{msg.odptNotice.text} {msg.odptNotice.fresh}</p>}
        <ul>{sources.map((a) => <li key={a.name}><a href={a.url} target="_blank" rel="noopener noreferrer">{a.name}</a>{a.via ? ` · ${a.via}` : ""} · <a href={a.licenseUrl} target="_blank" rel="noopener noreferrer">{a.license}</a></li>)}</ul>
      </details>
    </footer>
  );
}
