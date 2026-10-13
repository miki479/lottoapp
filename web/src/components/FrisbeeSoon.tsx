import type { Locale } from "../i18n/index.ts";

const TEXT: Record<string, [string, string, string]> = {
  it: ["Frisbee", "In arrivo", "Le prime partite di ultimate frisbee arrivano con la prossima stagione."],
  "en-US": ["Ultimate frisbee", "Coming soon", "The first ultimate frisbee games arrive with the next season."],
  "en-GB": ["Ultimate frisbee", "Coming soon", "The first ultimate frisbee games arrive with the next season."],
  ja: ["アルティメット", "近日公開", "次のシーズンからアルティメットの試合が登場します。"],
};

/** A quiet "coming soon" card for a sport that has no open games yet. */
export function FrisbeeSoon({ locale }: { locale: Locale }) {
  const [name, tag, note] = TEXT[locale] ?? TEXT["en-US"]!;
  return (
    <div class="soon" role="note">
      <svg class="soondisc" viewBox="0 0 48 48" aria-hidden="true">
        <ellipse cx="24" cy="27" rx="20" ry="9" fill="#ff7a1a" /><ellipse cx="24" cy="24" rx="20" ry="9" fill="#ffb347" />
        <ellipse cx="24" cy="24" rx="12" ry="4.800" fill="none" stroke="#fff" stroke-width="1.500" opacity=".7" />
        <path d="M6 20Q24 10 42 20" stroke="#fff" stroke-width="1.200" fill="none" opacity=".5" />
      </svg>
      <span class="soontxt"><b>{name}</b><small>{note}</small></span>
      <em>{tag}</em>
    </div>
  );
}
