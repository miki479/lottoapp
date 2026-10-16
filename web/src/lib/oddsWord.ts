import type { Locale } from "../i18n/index.ts";

const WORDS: Record<string, [string, string, string, string, string]> = {
  it: ["quasi certo", "probabile", "incerto", "difficile", "succede quasi mai"],
  "en-US": ["all but certain", "likely", "a toss-up", "unlikely", "almost never happens"],
  "en-GB": ["all but certain", "likely", "a toss-up", "unlikely", "almost never happens"],
  ja: ["ほぼ確実", "起こりやすい", "五分五分", "起こりにくい", "ほとんど起こらない"],
};
/** A plain word for how likely a pick is, from its odds (odds ≈ 0.92 / chance). */
export function oddsWord(odds: number, locale: Locale): string {
  const w = WORDS[locale] ?? WORDS["en-US"]!;
  return odds < 1.3 ? w[0] : odds < 1.9 ? w[1] : odds < 3.5 ? w[2] : odds < 9 ? w[3] : w[4];
}
