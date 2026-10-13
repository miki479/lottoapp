/**
 * Sarcastic titles shown under a player's name. A title id is `<subject>:<style>`.
 * The subject is where the player bet most in the last 60 days, the style is how they bet.
 * Derived data only: the server computes the id hourly (public.refresh_titles) with THE SAME thresholds as below.
 */
import { TITLE_TEXT, type TitleLocale } from "./titles-text.ts";

export const SUBJECTS = ["train", "bus", "weather", "nature", "traffic", "finance", "culture", "games", "music", "sport", "law", "mix"] as const;
export type TitleSubject = (typeof SUBJECTS)[number];
/** Order matters: it is the order of the five strings per subject in titles-text.ts. */
export const STYLES = ["risk", "cautious", "lucky", "regular", "highroller"] as const;
export type TitleStyle = (typeof STYLES)[number] | "newbie";

export const TITLE_RULES = {
  /** Window for subject and style, in days. */
  windowDays: 60,
  /** Fewer settled bets than this (all time): the generic newbie title. */
  newbieBelow: 5,
  /** Subject needs at least this share of the bets in the window, else 'mix'. */
  subjectShare: 0.5,
  /** highroller: average stake >= this share of the current balance (balance > 0), or >= highStake. */
  highrollerShare: 0.2,
  highStake: 1000,
  /** lucky: win rate >= luckyRate over at least luckyMin settled bets. */
  luckyRate: 0.58,
  luckyMin: 15,
  /** risk: average odds >= riskOdds; cautious: <= cautiousOdds. */
  riskOdds: 3.0,
  cautiousOdds: 1.6,
  /** Longest title, in characters, in any language. */
  maxLength: 26,
} as const;

export interface TitleStats {
  /** Settled (won or lost) bets, all time. */
  total: number;
  /** Settled bets in the window, per subject key (a markets.category, or 'games'/'music' for culture markets of those series). */
  byCategory: Record<string, number>;
  /** Wins among the settled bets of the window. */
  wins: number;
  avgStake: number;
  avgOdds: number;
  /** Current balance. */
  balance: number;
}

/** A market -> subject: culture splits by the data series (steam: games, lastfm: music, the rest films/series/TV). */
export function subjectOfMarket(category: string, series?: string | null): TitleSubject | null {
  if (category === "culture") return series?.startsWith("steam:") ? "games" : series?.startsWith("lastfm:") ? "music" : "culture";
  return subjectOfCategory(category);
}

/** Category of a market -> subject ('strike' counts as train, unknown categories only count towards the total). */
export function subjectOfCategory(c: string): TitleSubject | null {
  if (c === "strike") return "train";
  return (SUBJECTS as readonly string[]).includes(c) && c !== "mix" ? (c as TitleSubject) : null;
}

export function pickSubject(byCategory: Record<string, number>): TitleSubject {
  const per: Partial<Record<TitleSubject, number>> = {};
  let n = 0;
  for (const [c, k] of Object.entries(byCategory)) {
    n += k;
    const s = subjectOfCategory(c);
    if (s) per[s] = (per[s] ?? 0) + k;
  }
  let best: TitleSubject = "mix", top = 0;
  for (const s of SUBJECTS) if ((per[s] ?? 0) > top) { top = per[s]!; best = s; }
  return n > 0 && top >= n * TITLE_RULES.subjectShare ? best : "mix";
}

export function pickStyle(s: TitleStats): TitleStyle {
  const R = TITLE_RULES;
  if (s.total < R.newbieBelow) return "newbie";
  const n = Object.values(s.byCategory).reduce((a, b) => a + b, 0);
  if (n === 0) return "regular";
  if ((s.balance > 0 && s.avgStake >= R.highrollerShare * s.balance) || s.avgStake >= R.highStake) return "highroller";
  if (n >= R.luckyMin && s.wins >= R.luckyRate * n) return "lucky";
  if (s.avgOdds >= R.riskOdds) return "risk";
  if (s.avgOdds <= R.cautiousOdds) return "cautious";
  return "regular";
}

export function titleId(s: TitleStats): string {
  const style = pickStyle(s);
  return style === "newbie" ? "mix:newbie" : `${pickSubject(s.byCategory)}:${style}`;
}

/** The text of a title id in a language, or null for an unknown id (an old client meeting a newer server). */
export function titleText(id: string | null | undefined, locale: TitleLocale): string | null {
  if (!id) return null;
  const [subject, style] = id.split(":");
  const t = TITLE_TEXT[locale] ?? TITLE_TEXT["en-US"];
  if (id === "mix:newbie") return t.newbie;
  const row = t.subjects[subject as TitleSubject];
  const i = (STYLES as readonly string[]).indexOf(style ?? "");
  return row && i >= 0 ? row[i]! : null;
}

export type { TitleLocale };
