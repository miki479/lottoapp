export type Locale = "it" | "en-US" | "en-GB";
export const LOCALES: { id: Locale; label: string }[] = [
  { id: "it", label: "Italiano" },
  { id: "en-US", label: "English (US)" },
  { id: "en-GB", label: "English (UK)" },
];

export interface BusQ { route: string; headsign: string; stop: string; time: string; min: number }
export interface RainQ { city: string; time: string }
export type TrophyId = "first_win" | "long_shot" | "rain_man" | "train_whisperer" | "ghost_feed" | "high_roller" | "all_rings" | "streak_7" | "streak_30";
export const TROPHY_IDS: TrophyId[] = ["first_win", "all_rings", "long_shot", "rain_man", "streak_7", "train_whisperer", "high_roller", "streak_30", "ghost_feed"];
export const TROPHY_RARITY: Record<TrophyId, "common" | "rare" | "epic"> = {
  first_win: "common", all_rings: "common", long_shot: "rare", rain_man: "rare", streak_7: "rare",
  train_whisperer: "epic", high_roller: "epic", streak_30: "epic", ghost_feed: "epic",
};

/** Every locale implements this: add `ja` by creating ja.ts and registering it in index.ts. */
export interface Messages {
  tagline: string;
  nav: { events: string; missions: string; ranking: string; mine: string };
  tabs: { bus: string; train: string; weather: string; traffic: string };
  world: string;
  credits: string;
  city: string;
  language: string;
  disclaimerShort: string;
  disclaimerFull: string;
  attributionTitle: string;
  loading: string;
  retry: string;
  empty: { markets: string; mine: string; trafficSoon: string };
  closesIn: (min: number) => string;
  closedSoon: string;
  card: { late: string; onTime: string; per10: (win: number) => string; closes: string; live: string; forecast: string; bomb: string; sooner: string };
  hero: { kicker: string; lateNow: string; closingSoon: string; cta: string; threshold: string };
  board: { title: string; sub: string; none: string };
  ticker: { late: (r: string, s: string, min: number) => string; onTime: (r: string, s: string) => string; void: (r: string, s: string) => string; rain: (c: string) => string; dry: (c: string) => string; idle: string[] };
  question: { bus: (q: BusQ) => string; train: (q: BusQ) => string; rain: (q: RainQ) => string };
  pick: { yes: string; no: string };
  sheet: { stake: string; potential: string; place: string; placing: string; cancel: string; odds: string; done: (win: number) => string; flashOdds: string };
  mine: { open: string; won: (n: number) => string; lost: string; void: string; voidReason: Record<string, string>; yourPick: (yes: boolean) => string; stamp: { won: string; lost: string; void: string }; settles: string };
  missions: {
    title: string; rings: { bus: string; train: string; weather: string; traffic: string }; ringsHint: (left: number) => string; bonusDone: string; bonusTease: string;
    streak: (n: number) => string; streakHint: string; freezes: (n: number) => string; freezeHint: string;
    trophies: string; locked: string; rarity: { common: string; rare: string; epic: string };
    trophy: Record<TrophyId, { name: string; desc: string }>;
    share: { button: string; title: string; text: string; saved: string };
    newTrophy: string;
  };
  ranking: {
    title: string; season: (days: number) => string; scopes: { global: string; country: string; city: string; friends: string }; you: string;
    empty: string; pts: string; needAccount: { title: string; body: string };
    name: { label: string; save: string; placeholder: string };
    groups: { create: string; join: string; namePh: string; codePh: string; yourCode: (c: string) => string; copied: string; none: string; pick: string };
  };
  errors: Record<string, string>;
  feedWarning: string;
  save: { title: string; body: string; email: string; send: string; sent: string; later: string };
  offline: string;
  install: string;
}
