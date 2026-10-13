export type Locale = "it" | "en-US" | "en-GB" | "ja";
export const LOCALES: { id: Locale; label: string; short: string }[] = [
  { id: "it", label: "Italiano", short: "IT" },
  { id: "en-US", label: "English (US)", short: "EN-US" },
  { id: "en-GB", label: "English (UK)", short: "EN-UK" },
  { id: "ja", label: "日本語", short: "JA" },
];

export interface BusQ { route: string; headsign: string; stop: string; time: string; min: number }
export interface RainQ { city: string; time: string; to: string }
export type MetricKey = "temp" | "wind" | "snow" | "uv" | "aqi" | "hail";
export interface MetricQ { metric: MetricKey; city: string; time: string; to: string; value: number; unit: string }
export type MatchBetKey = import("../../../shared/sport.ts").MatchBet;
export interface MatchQ { bet: MatchBetKey; home: string; away: string; time: string }
export interface ConcertsQ { place: string; from: string; to: string; value: string; time: string }
export interface EpisodeQ { show: string; ep: string; value: string; date: string }
export interface TickQ { kind: "price" | "kp" | "wiki" | "players" | "listeners" | "storm" | "alert" | "fuel" | "oil"; label: string; value: string; time: string; from: string; to: string; day: string }
export interface FullQ { occ: "empty" | "few" | "standing"; route: string; stop: string; time: string }
export interface TrafficQ { site: string; toward: string; from: string; to: string; kmh: number }
export interface StrikeQ { date: string; day: string; who: string; hours: string }
export interface QuakeQ { mag: string; from: string; to: string; region?: string }
export type TrophyId = "first_win" | "long_shot" | "rain_man" | "train_whisperer" | "ghost_feed" | "high_roller" | "all_rings" | "streak_7" | "streak_30" | "wins_100" | "wins_500" | "streak_100" | "bets_500" | "all_categories" | "win_row_10" | "big_odds" | "parlay_5" | "friends_10" | "level_25" | "level_50" | "chest_30" | "collector";
export const TROPHY_IDS: TrophyId[] = ["first_win", "all_rings", "long_shot", "rain_man", "streak_7", "train_whisperer", "high_roller", "streak_30", "ghost_feed", "wins_100", "wins_500", "streak_100", "bets_500", "all_categories", "win_row_10", "big_odds", "parlay_5", "friends_10", "level_25", "level_50", "chest_30", "collector"];
export const TROPHY_RARITY: Record<TrophyId, "common" | "rare" | "epic" | "legendary" | "mythic"> = {
  first_win: "common", all_rings: "common", long_shot: "rare", rain_man: "rare", streak_7: "rare",
  train_whisperer: "epic", high_roller: "epic", streak_30: "epic", ghost_feed: "epic",
  wins_100: "epic", wins_500: "mythic", streak_100: "legendary", bets_500: "legendary", all_categories: "epic", win_row_10: "legendary", big_odds: "epic", parlay_5: "legendary", friends_10: "epic", level_25: "legendary", level_50: "mythic", chest_30: "epic", collector: "mythic",
};

/** Every locale implements this: add `ja` by creating ja.ts and registering it in index.ts. */
export interface Messages {
  nav: { home: string; bets: string; friends: string; ranking: string; profile: string };
  insight: { how: string; noReadings: string; delayNow: string; chartLabel: string; line: (n: number) => string; goingWell: string; goingBad: string; updated: (n: number) => string; forecast: string; noForm: string; res: { w: string; d: string; l: string }; goalsFor: string; goalsAgainst: string; pointsFor: string; pointsAgainst: string; chance: string; waitMatch: string };
  common: { loading: string; backOnline: string; close: string; cancel: string; save: string; retry: string; soon: string; offline: string; install: string; language: string; credits: string; copied: string; back: string };
  tabs: { law: string; bus: string; train: string; weather: string; nature: string; strike: string; traffic: string; finance: string; culture: string; sport: string; gov: string; soon: string };
  wx: { filter: string; all: string; rain: string; world: string; regions: Record<string, string>; localTime: string; names: Record<MetricKey | "crypto" | "metals" | "oil" | "fuel", string>; forecast: (v: string) => string; quakeArt: string };
  world: string;
  quakeMaker: { cta: string; title: string; body: string; place: string; search: string; radius: string; mag: string; day: string; today: string; tomorrow: string; hour: string; length: string; hours: (n: number) => string; km: (n: number) => string; create: string; creating: string; pickPlace: string; local: (tz: string) => string; limit: string; full: string; usgs: string; time: string; credit: string };
  traffic: { threshold: (kmh: number) => string; jam: string; flow: string };
  /** How full a bus is (GTFS-RT occupancy levels 0..5). */
  occ: { title: string; levels: string[] };
  /** TV series: bets on the rating of an episode. */
  series: { cta: string; title: string; body: string; search: string; followed: string; follow: string; unfollow: string; noEpisodes: string; pickEpisode: string; threshold: string; priced: (ref: string, chance: number, yes: string, no: string) => string; create: string; creating: string; credit: string; certain: string; register: string; noRatings: string; time: string; limit: string; mine: string; all: string };
  /** The board of Italian trains running now (Home). */
  board: { title: string; following: (n: number) => string; meter: string; over5: string; avg: string; late: string; odds: string; worse: string; better: string; steady: string; kinds: { hs: string; ic: string; rg: string }; heads: { train: string; to: string; delay: string }; marquee: string; short: { hs: string; ic: string; rg: string } };
  /** Map of the vehicle behind an open bet. */
  map: { title: string; show: string; hide: string; none: string; estimated: string; stop: string; vehicle: string; updated: (sec: number) => string; credit: string };
  /** The "how full will it be?" bonus on a delay bet. */
  bonus: { title: string; hint: string; none: string; free: string; few: string; standing: string; hit: string; miss: string; unknown: string; line: (what: string) => string };
  strikes: { title: string; sub: string; art: string };
  home: { typeLabel: string; hero: { title: string; body: string }; how: { title: string; steps: [string, string, string]; close: string }; whatLabel: string; whereLabel: string; hereNone: (place: string) => string; tryInstead: string;  missions: string; missionsLeft: (n: number) => string; missionsDone: string; bonusTease: string; top: string; events: string; live: string; idle: string[]; emptyCat: Record<"bus" | "train" | "weather" | "nature" | "strike" | "traffic" | "finance" | "culture" | "sport" | "law" | "gov", string>; empty: { title: string; body: string; cta: string }; trafficSoon: string; satire: string; moreCats: string; lessCats: string };
  streak: { title: string; days: (n: number) => string; next: (day: number, bonus: string) => string; max: string; milestone: (n: number, bonus: string) => string; flash: string };
  meter: { threshold: (min: number) => string; up: (min: number) => string; down: (min: number) => string; steady: string; forecast: string; late: string };
  ticker: { anon: string; won: string; lost: string; placed: string; on: string; late: (route: string, to: string, min: number) => string; closing: string; crowd: (n: number) => string; flash: (x: number) => string; strike: (day: string) => string };
  slip: { bar: (n: number) => string; title: string; add: string; added: string; remove: string; odds: string; confirm: string; maxWin: string; need2: string; placed: (win: string) => string; legs: (n: number) => string; clear: string };
  stake: { label: string; min: string; max: (m: string) => string; ifRight: string };
  join: { step: string; title: string; body: (credits: string) => string; nickname: string; password: string; hint: string; cta: (stake: string) => string; haveProfile: string; newProfile: string; emailInstead: string; checkMail: string };
  referral: { title: string; body: (bonus: string) => string; code: string; copy: string; copied: string; share: string; shareText: (code: string) => string; counts: (invited: number, paid: number) => string; guest: string; accepted: string };
  voice: { on: string; off: string; placed: (win: string) => string; won: (amount: string) => string; lost: string; flash: string; label: string };
  ladder: { title: string; sub: (min: number) => string; estimate: string; chip: string };
  push: { active: string; events: string; friendsPref: string; flashPref: string; streakPref: string; prefsHint: string; title: string; body: string; enable: string; disable: string; on: string; off: string; denied: string; later: string; askTitle: string; askBody: string; yes: string };
  boost: { gain: (from: string, to: string) => string; title: string; toggle: string; hint: string; have: (n: number) => string; none: string; gift: string; explain: string };
  rewards: { title: string; subtitle: string; daily: string; dailyReset: (t: string) => string; once: string; claim: (amount: string) => string; claimed: string; go: string; invite: string; inviteBody: (amount: string, max: number) => string; invited: (n: number, max: number) => string; allDone: string; streakRisk: (n: number) => string; open: string; quest: Record<string, { t: string; d: string }> };
  weather: { clear: string; light: string; heavy: string };
  near: { title: string; ask: string; privacy: string; locate: string; denied: string; zone: (name: string) => string; bets: (n: number) => string; first: string; nothing: string; refresh: string };
  places: { more: string; title: string; hint: string; search: string; recent: string; capitals: string; famous: string; withData: string; none: string; searchError: string; limit: string; full: string; credit: string };
  top: { best: string; late: string; popular: string; city: string; closing: string; draw: string; goal: string; upset: string; coin: string; spotlight: string; wild: string; sky: string; avg: (min: number) => string; players: (n: number) => string; ontime: string; open: string };
  card: { noLive: string; late: string; onTime: string; per10: (win: number) => string; closes: string; forecast: string; live: string; yes: string; no: string; over: (min: number) => string; topOdds: string; hot: string };
  alertNames: { yellow: string; orange: string; red: string };
  nearby: { title: string; hint: string; radius: string; none: string; home: string; homeHint: string; homeSet: string; homeClear: string; homeSearch: string; homeNone: string; askLocate: string; statsTitle: string; statsIntro: string; towns: string; bands: string; yes: string; notEnough: string; people: string; total: string; km: string };
  sportui: { dec: string; searchTeam: string; totalPts: string; totalGoals: string; handicap: string; ptsUnit: string; goalsUnit: string; opp: { notWin: (t: string) => string; noDraw: string; atMost: (n: number) => string; notBoth: string; concede: (t: string) => string; no: string }; all: string; allMarkets: string; result: string; double: string; goals: string; over: string; under: string; goalNo: string; goal: string; noGoal: string; clean: string; cleanHome: string; cleanAway: string; pickOne: string; needAccount: string; busy: string; noMatches: string; firstHalf: string; secondHalf: string; cornersT: string; cardsT: string; redT: string; halfGoal: string; yes: string; no: string; unavailable: string; wins: (t: string) => string; players: string; pgL: string; paL: string; psL: string; noLineup: string; simple: string; advanced: string; halves: string; finalT: string };
  teamSearch: string;
  matchmaker: { tab: string; pick: string; reason: string; exists: string; none: string; open: string; bets: Record<MatchBetKey, string> };
  fx: { visibility: string; vPrivate: string; vPrivateHint: string; vFriends: string; vFriendsHint: string; vPublic: string; vPublicHint: string; world: string; judgeLabel: string; judgeCreator: string; judgeVote: string; judgeHint: string; needHome: string; voteTitle: string; voteWait: string; voteDone: string; votes: string; judgeCant: string; byVote: string; byJudge: string; publicBadge: string; privateBadge: string; report: string; reported: string; nearTitle: string; players: string; errors: Record<"judge_cannot_bet" | "decided_by_vote" | "decided_by_judge" | "not_a_player" | "home_required" | "account_too_new" | "bad_mode", string> };
  friends: { customHint: string; customBad: string; created: string; deleteBtn: string; askSolo: string; askJoined: string; deleteYes: string; deleteNo: string; deleted: string; voidedMsg: string; tab: string; title: string; hint: string; placeholder: string; category: string; moreCats: string; lessCats: string; closes: string; stake: string; noStake: string; customStake: string; stakeNote: string; create: string; creating: string; needAccount: string; judge: string; rules: string; mine: string; none: string; yes: string; no: string; waitJudge: string; decide: string; decideYes: string; decideNo: string; decideVoid: string; pot: string; perHead: string; closesIn: string; closed: string; resolvedYes: string; resolvedNo: string; voided: string; people: string; won: string; share: string; copied: string; join: string; full: string; shareText: string; closeOpts: Record<"h1" | "h3" | "tonight" | "tomorrow" | "d3" | "d7" | "custom", string>; errors: Record<"bad_title" | "title_not_allowed" | "limit" | "too_many_open" | "bad_time" | "registration_required" | "insufficient_credits" | "already_picked" | "challenge_closed" | "challenge_full" | "not_closed_yet" | "generic", string>; cats: Record<"friends" | "family" | "work" | "dinner" | "trip" | "sport" | "games" | "home" | "school" | "party" | "music" | "food" | "pets" | "tech" | "money_fun" | "random", string> };
  maker: { open: string; title: string; hint: string; tabs: Record<"weather" | "crypto" | "games" | "culture" | "quake", string>; place: string; metric: string; day: string; today: string; tomorrow: string; hour: string; line: string; now: string; forecastLbl: string; when: string; pickOne: string; in_h: string; midnightToday: string; midnightTomorrow: string; odds: string; chance: string; create: string; creating: string; needAccount: string; errors: Record<"limit" | "too_many_open" | "full" | "too_certain" | "bad_time" | "source_unavailable" | "generic", string>; by: (n: string) => string; trending: string; trendingNear: string; share: string; copied: string; shareText: string };
  chart: { title: string; min: string; max: string; change: string; above: string };
  quips: Record<"bus" | "train" | "rain" | "temp" | "wind" | "snow" | "uv" | "aqi" | "quake" | "strike" | "traffic" | "price" | "kp" | "wiki" | "game" | "sport" | "storm" | "hail" | "alert" | "metal" | "fuel" | "oil", string[]>;
  question: { episode: (q: EpisodeQ) => string; concerts: (q: ConcertsQ) => string; full: (q: FullQ) => string; bus: (q: BusQ) => string; train: (q: BusQ) => string; rain: (q: RainQ) => string; metric: (q: MetricQ) => string; quake: (q: QuakeQ) => string; strike: (q: StrikeQ) => string; traffic: (q: TrafficQ) => string; tick: (q: TickQ) => string; match: (q: MatchQ) => string; two: (q: { kind: "tot" | "mrg"; line: string; negative: boolean; unit: string; home: string; away: string; time: string }) => string; player: (q: { kind: "pg" | "pa" | "ps"; name: string; home: string; away: string; time: string }) => string };
  sheet: { title: string; pick: string; stake: string; potential: string; confirm: string; confirming: string; odds: string; placed: (win: string) => string };
  bets: { title: string; tabs: { open: string; settled: string }; open: string; won: string; lost: string; void: string; empty: { title: string; body: string; cta: string }; yourPick: (yes: boolean) => string; settles: string; potential: string; waiting: string[]; voidReason: Record<string, string>; details: string };
  result: {
    won: string; lost: string; void: string; amountWon: (n: number) => string; amountLost: (n: number) => string; amountVoid: (n: number) => string;
    subWon: string; subLost: string; subVoid: string;
    fullMeasured: (level: string) => string; measured: (min: number, sec: number) => string; threshold: (min: number) => string; rainMeasured: (mm: number) => string; tickMeasured: (v: string) => string; matchScore: (home: number, away: number) => string; metricMeasured: (name: string, value: string) => string; strikeOn: string; strikeOff: string; trafficMeasured: (avg: number, thr: number) => string; quakeMeasured: (count: number, max: string) => string;
    stake: string; odds: string; share: string; shareText: string; close: string; more: (n: number) => string; saved: string;
  };
  rankTabs: { world: string; local: string; friends: string; near: string; country: string; city: string; km: string; needHome: string; radius: string };
  ranking: {
    title: string; season: (d: number) => string; scopes: { global: string; country: string; city: string; friends: string }; you: string; credits: string;
    empty: { title: string; body: string }; gate: { title: string; body: string; cta: string };
    groups: { create: string; join: string; namePh: string; codePh: string; yourCode: (c: string) => string; none: string };
  };
  profile: { howItWorks: string; terms: string; privacy: string;
    title: string; guest: string; guestHint: string; signIn: string; account: string;
    stats: { title: string; winRate: string; streak: string; best: string; bets: string; net: string; trophies: string; days: (n: number) => string };
    streakHint: string; freezes: (n: number) => string; freezeHint: string;
    trophies: string; locked: string; rarity: { common: string; rare: string; epic: string; legendary: string; mythic: string };
    trophy: Record<TrophyId, { name: string; desc: string }>;
    shareCard: string; shareText: string; settings: string; signOut: string; sources: string;
    delete: { action: string; title: string; body: string; confirm: string; done: string };
    nickname: { title: string; label: string; placeholder: string; rules: string; save: string; needAccount: string };
  };
  auth: {
    title: string; subtitle: string; tabSignin: string; tabSignup: string; email: string; password: string; passwordHint: string; google: string; or: string;
    magic: string; magicSent: string; confirmSent: string; signinCta: string; signupCta: string; guestKeep: string; guestLose: string; welcome: string;
  };
  crowd: { title: string; note: (year: string, avg: number) => string; all: (n: number) => string; less: string; scaleTitle: string; scale: Record<100 | 150 | 180 | 200 | 250, string>; source: string };
  report: { link: string; title: string; kinds: { wrong_data: string; wrong_result: string; other: string }; notePh: string; send: string; sent: string };
  admin: { open: string; title: string; feeds: string; ok: string; late: string; down: string; never: string; markets: string; opened: string; resolved24: string; void24: string; users: string; registered: string; guests: string; bets24: string; places: string; reports: string; noReports: string; resolve: string; refresh: string; forbidden: string; moderation: string; noModeration: string };
  disclaimerShort: string; disclaimerFull: string; attributionTitle: string;
  errors: Record<string, string>;
  feedWarning: string;
  cm: Record<string, string>;
  sup: { badge: string; top: string; fuel_move: (l: string, v: number) => string; price_move: (l: string, v: number) => string; quake: (v: number) => string; storm: (v: number) => string };
  hist: { title: string; empty: string; days: (n: number) => string; best: string; worst: string; byCategory: string; all: string; won: string; lost: string; void: string; more: string; showing: (a: number) => string };
  dm: {
    title: string; resets: (t: string) => string; claim: string; done: string; chest: string; chestBody: (c: string) => string; chestOpen: string; chestOpened: (c: string, b: number) => string; chestLocked: (n: number) => string; got: (c: string) => string;
    streak: (n: number) => string; titles: Record<string, string>; legend: string;
    flash: { title: string; soon: (t: string) => string; live: (left: string) => string; missed: string; prize: (c: string, b: number) => string; claim: string; titles: Record<string, string>; got: (c: string, b: number) => string };
  };
  look: { title: string; avatars: string; apply: string; saved: string; none: string; level: (n: number) => string; xp: (a: number, b: number) => string; unlockAt: (n: number) => string; dropOnly: string; next: (n: number, name: string) => string; newDrop: (name: string) => string; levelUp: (n: number, name: string | null) => string; change: string; locked: string; view: string; addFriend: string; sent: string; accept: string; decline: string; isFriend: string; streak: string; bestWin: string; monthWins: string; trophies: string; balance: (v: string) => string; balanceLabel: string; cancelRequest: string; xpHow: string; xpIntro: string; xpRows: string[]; xpNote: string; declineAll: string; showMore: (n: number) => string; showLess: string; requestCancelled: string; friendsOnly: string; hiddenWord: string; requests: string; requestSent: string; nowFriends: string; noTrophies: string; av: Record<string, string>; deco: Record<string, string>; rarity: Record<string, string> };
  house: { viceTitle: string; viceBody: (n: number) => string; excl: string; inDays: (n: number) => string; daysWord: (n: number) => string; remind: string; reminding: string; needPush: string };
  frd: {
    feedTitle: string; feedEmpty: string; listTitle: string; by: string; noStake: string; credits: string; closesIn: string;
    boardTab: string; groupsTab: string; inviteTitle: string; inviteBody: string; inviteBtn: string; invitedCount: (n: number) => string;
    empty: string; emptyBody: string; anon: string; remove: string; removeAsk: (n: string) => string; removeYes: string; removeNo: string; removed: string; challenge: string; boardHint: string;
    invTitle: string; invHint: string; invNoFriends: string; invSend: (n: number) => string; invSent: (n: number) => string; invNone: string; invDone: string;
    hot: string; friendsOn: (n: number) => string; inboxTitle: string; inboxFrom: (who: string) => string; inboxOpen: string; referralNote: string; errors: Record<"invite_limit" | "too_many_invites" | "not_in_challenge" | "generic", string>;
  };
}
