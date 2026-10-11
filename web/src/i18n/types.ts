export type Locale = "it" | "en-US" | "en-GB";
export const LOCALES: { id: Locale; label: string; short: string }[] = [
  { id: "it", label: "Italiano", short: "IT" },
  { id: "en-US", label: "English (US)", short: "EN-US" },
  { id: "en-GB", label: "English (UK)", short: "EN-UK" },
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
  nav: { home: string; bets: string; ranking: string; profile: string };
  common: { close: string; cancel: string; save: string; retry: string; soon: string; offline: string; install: string; language: string; credits: string; copied: string; back: string };
  tabs: { bus: string; train: string; weather: string; traffic: string };
  world: string;
  home: { hero: { title: string; body: string }; missions: string; missionsLeft: (n: number) => string; missionsDone: string; bonusTease: string; top: string; events: string; live: string; idle: string[]; empty: { title: string; body: string; cta: string }; trafficSoon: string };
  streak: { title: string; days: (n: number) => string; next: (day: number, bonus: string) => string; max: string; milestone: (n: number, bonus: string) => string; flash: string };
  meter: { threshold: (min: number) => string; up: (min: number) => string; down: (min: number) => string; steady: string; forecast: string; late: string };
  ticker: { anon: string; won: string; lost: string; placed: string; on: string };
  slip: { bar: (n: number) => string; title: string; add: string; added: string; remove: string; odds: string; confirm: string; maxWin: string; need2: string; placed: (win: string) => string; legs: (n: number) => string; clear: string };
  stake: { label: string; min: string; max: (m: string) => string; ifRight: string };
  join: { step: string; title: string; body: (credits: string) => string; nickname: string; password: string; hint: string; cta: (stake: string) => string; haveProfile: string; newProfile: string; emailInstead: string; checkMail: string };
  referral: { title: string; body: (bonus: string) => string; code: string; copy: string; copied: string; share: string; shareText: (code: string) => string; counts: (invited: number, paid: number) => string; guest: string; accepted: string };
  voice: { on: string; off: string; placed: (win: string) => string; won: (amount: string) => string; lost: string; flash: string; label: string };
  ladder: { title: string; sub: (min: number) => string; estimate: string; chip: string };
  push: { flashPref: string; streakPref: string; prefsHint: string; title: string; body: string; enable: string; disable: string; on: string; off: string; denied: string; later: string; askTitle: string; askBody: string; yes: string };
  boost: { gain: (from: string, to: string) => string; title: string; toggle: string; hint: string; have: (n: number) => string; none: string; gift: string; explain: string };
  rewards: { title: string; subtitle: string; daily: string; dailyReset: (t: string) => string; once: string; claim: (amount: string) => string; claimed: string; go: string; invite: string; inviteBody: (amount: string, max: number) => string; invited: (n: number, max: number) => string; allDone: string; streakRisk: (n: number) => string; open: string; quest: Record<string, { t: string; d: string }> };
  weather: { clear: string; light: string; heavy: string };
  top: { late: string; popular: string; city: string; closing: string; avg: (min: number) => string; players: (n: number) => string; ontime: string; open: string };
  card: { late: string; onTime: string; per10: (win: number) => string; closes: string; forecast: string; live: string; yes: string; no: string; over: (min: number) => string; topOdds: string; hot: string };
  question: { bus: (q: BusQ) => string; train: (q: BusQ) => string; rain: (q: RainQ) => string };
  sheet: { title: string; pick: string; stake: string; potential: string; confirm: string; confirming: string; odds: string; placed: (win: string) => string };
  bets: { title: string; tabs: { open: string; settled: string }; open: string; won: string; lost: string; void: string; empty: { title: string; body: string; cta: string }; yourPick: (yes: boolean) => string; settles: string; voidReason: Record<string, string>; details: string };
  result: {
    won: string; lost: string; void: string; amountWon: (n: number) => string; amountLost: (n: number) => string; amountVoid: (n: number) => string;
    subWon: string; subLost: string; subVoid: string;
    measured: (min: number, sec: number) => string; threshold: (min: number) => string; rainMeasured: (mm: number) => string;
    stake: string; odds: string; share: string; shareText: string; close: string; more: (n: number) => string; saved: string;
  };
  ranking: {
    title: string; season: (d: number) => string; scopes: { global: string; country: string; city: string; friends: string }; you: string; credits: string;
    empty: { title: string; body: string }; gate: { title: string; body: string; cta: string };
    groups: { create: string; join: string; namePh: string; codePh: string; yourCode: (c: string) => string; none: string };
  };
  profile: {
    title: string; guest: string; guestHint: string; signIn: string; account: string;
    stats: { title: string; winRate: string; streak: string; best: string; bets: string; net: string; trophies: string; days: (n: number) => string };
    streakHint: string; freezes: (n: number) => string; freezeHint: string;
    trophies: string; locked: string; rarity: { common: string; rare: string; epic: string };
    trophy: Record<TrophyId, { name: string; desc: string }>;
    shareCard: string; shareText: string; settings: string; signOut: string; sources: string;
    delete: { action: string; title: string; body: string; confirm: string; done: string };
    nickname: { title: string; label: string; placeholder: string; rules: string; save: string; needAccount: string };
  };
  auth: {
    title: string; subtitle: string; tabSignin: string; tabSignup: string; email: string; password: string; passwordHint: string; google: string; or: string;
    magic: string; magicSent: string; confirmSent: string; signinCta: string; signupCta: string; guestKeep: string; guestLose: string; welcome: string;
  };
  disclaimerShort: string; disclaimerFull: string; attributionTitle: string;
  errors: Record<string, string>;
  feedWarning: string;
}
