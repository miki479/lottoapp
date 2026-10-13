import { titleText, type TitleLocale } from "../../../shared/titles.ts";

/** The sarcastic title under a player's name: small, muted, italic, one line. Nothing while the title is unknown. */
export function PlayerTitle({ id, locale }: { id: string | null | undefined; locale: TitleLocale }) {
  const t = titleText(id, locale);
  return t ? <span class="ptitle">{t}</span> : null;
}
