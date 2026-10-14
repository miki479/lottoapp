import type { Messages } from "../i18n/index.ts";

export interface Source { name: string; via?: string; license: string; licenseUrl: string; url: string }

/** The one footer of the app, under every screen: the disclaimer (once, small and muted), the full wording, the pages that explain the game and the sources of the data. */
export function AppFooter({ msg, sources }: { msg: Messages; sources: Source[] }) {
  return (
    <footer class="legal">
      <p class="legalshort">{msg.disclaimerShort}</p>
      <p>{msg.disclaimerFull}</p>
      <p class="legallinks"><a href="/how-it-works.html">{msg.profile.howItWorks}</a><a href="/terms.html">{msg.profile.terms}</a><a href="/privacy.html">{msg.profile.privacy}</a></p>
      <details><summary>{msg.attributionTitle}</summary>
        <ul>{sources.map((a) => <li key={a.name}><a href={a.url} target="_blank" rel="noopener noreferrer">{a.name}</a>{a.via ? ` · ${a.via}` : ""} · <a href={a.licenseUrl} target="_blank" rel="noopener noreferrer">{a.license}</a></li>)}</ul>
      </details>
    </footer>
  );
}
