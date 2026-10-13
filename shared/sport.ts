import { computeOdds } from "./odds.ts";

/** Football (soccer): one market = one bet on one match, settled from the final score. One match, many "reasons". */
export type BasicBet = "home_win" | "draw" | "away_win" | "dc_1x" | "dc_x2" | "dc_12" | "over_1_5" | "over_2_5" | "over_3_5" | "btts" | "home_clean" | "away_clean";
/** Bets that need more than the final score: half-time score, corners, cards. Settled from the match details (API-Football) and only offered where those are available. */
export type DetailBet = "ht_home" | "ht_draw" | "ht_away" | "ht_goal" | "st_home" | "st_draw" | "st_away" | "st_goal" | "corners_8_5" | "corners_9_5" | "corners_10_5" | "corners_11_5" | "cards_3_5" | "cards_4_5" | "cards_5_5" | "red_card";
export type MatchBet = BasicBet | DetailBet;
export const MATCH_BETS: BasicBet[] = ["home_win", "draw", "away_win", "dc_1x", "dc_x2", "dc_12", "over_1_5", "over_2_5", "over_3_5", "btts", "home_clean", "away_clean"];
export const DETAIL_BETS: DetailBet[] = ["ht_home", "ht_draw", "ht_away", "ht_goal", "st_home", "st_draw", "st_away", "st_goal", "corners_8_5", "corners_9_5", "corners_10_5", "corners_11_5", "cards_3_5", "cards_4_5", "cards_5_5", "red_card"];
export const ALL_BETS: MatchBet[] = [...MATCH_BETS, ...DETAIL_BETS];

/**
 * Extra bets of the sports without a draw, settled from the final score: "tot:226.5" = more than 226.5 points in total, "mrg:-6.5" = the home side
 * wins by more than -6.5 (that is, wins or loses by 6 or fewer). Lines always end in .5, so there is never a tie.
 */
export type TwoBet = `tot:${number}` | `mrg:${number}`;
export const TWO_BET_RE = /^(tot|mrg):(-?\d{1,3}\.5)$/;
export const isTwoBet = (b: string): b is TwoBet => TWO_BET_RE.test(b);
export const twoBetLine = (b: string): number => Number(TWO_BET_RE.exec(b)?.[2] ?? NaN);

/** A bet on one player of a match: "pg:<id>" scores, "pa:<id>" makes an assist, "ps:<id>" (a starter) is substituted. */
export type PlayerBet = `pg:${number}` | `pa:${number}` | `ps:${number}`;
export const PLAYER_BET_RE = /^(pg|pa|ps):(\d{1,9})$/;
export const isPlayerBet = (b: string): b is PlayerBet => PLAYER_BET_RE.test(b);
export const playerBetId = (b: string): number => Number(PLAYER_BET_RE.exec(b)?.[2] ?? NaN);
/** The bets that are settled from the match details (half-time, corners, cards, players). */
export const needsDetails = (b: string): boolean => isDetailBet(b) || isPlayerBet(b);
export interface LineupPlayer { id: number; name: string; pos: string; side: "home" | "away" }
export type PlayerFacts = { goals: number[]; assists: number[]; subs: number[] };

/** Chance of each player bet from the team's expected goals and the player's position (G, D, M, F). Null when the bet is not worth offering. */
export function playerChance(kind: "pg" | "pa" | "ps", pos: string, teamGoals: number): number | null {
  const share = ({ pg: { F: 0.3, M: 0.1 }, pa: { F: 0.17, M: 0.15 } } as Record<string, Record<string, number>>)[kind]?.[pos];
  if (kind === "ps") { const p = ({ F: 0.65, M: 0.58, D: 0.32 } as Record<string, number>)[pos]; return p === undefined ? null : p; }
  if (share === undefined) return null;
  return Math.round((1 - Math.exp(-teamGoals * share)) * 1000) / 1000;
}
export const isDetailBet = (b: string): b is DetailBet => (DETAIL_BETS as string[]).includes(b);
/** Leagues whose half-time scores, corners and cards are offered (the others only have the final score). */
export const DETAIL_LEAGUES = ["Serie A", "Serie B"];
/** The ones every fixture gets automatically; the rest are created on request, never twice. */
/** Every fixture gets the base 1-X-2 automatically; every other market (goals, double chance, clean sheets) is made on request, never twice. */
export const AUTO_BETS: MatchBet[] = ["home_win", "draw", "away_win"];
export const AUTO_BETS_LOWER: MatchBet[] = AUTO_BETS;

/** `two` = no draw (basketball, hockey, American football, baseball): the bets are "home wins" and "away wins" only. */
export interface TwoWayCfg { sd: number; /** spread of the total points of a game */ tsd: number; home: number; avg: number; lenSec: number }
/** `deep` = the free TheSportsDB tier lists only 3 matches a day, so the ingest also reads the fixtures from the ESPN scoreboard (see discoverFixtures). `euro` = a UEFA competition: strengths come from the standings of the cup and of the clubs' own leagues. */
export interface LeagueCfg { id: string; name: string; top: boolean; two?: TwoWayCfg; deep?: boolean; euro?: boolean }
export const LEAGUES: LeagueCfg[] = [
  { id: "4332", name: "Serie A", top: true }, { id: "4394", name: "Serie B", top: false },
  { id: "5340", name: "Serie C - A", top: false }, { id: "5339", name: "Serie C - B", top: false }, { id: "5341", name: "Serie C - C", top: false },
  // European football: the Italian clubs' nights (Champions, Europa, Conference League) and the big leagues
  { id: "4480", name: "Champions League", top: true, deep: true, euro: true }, { id: "4481", name: "Europa League", top: true, deep: true, euro: true }, { id: "5071", name: "Conference League", top: false, deep: true, euro: true },
  { id: "4328", name: "Premier League", top: true, deep: true }, { id: "4335", name: "La Liga", top: true, deep: true }, { id: "4331", name: "Bundesliga", top: true, deep: true }, { id: "4334", name: "Ligue 1", top: true, deep: true },
  { id: "4337", name: "Eredivisie", top: false, deep: true }, { id: "4344", name: "Primeira Liga", top: false, deep: true }, { id: "4330", name: "Scottish Premiership", top: false, deep: true },
  // sd = spread of the final margin, home = home advantage in points, avg = points per team per game, lenSec = how long until the result is final
  { id: "4387", name: "NBA", top: true, two: { sd: 12, tsd: 18, home: 2.5, avg: 113, lenSec: 3 * 3600 } },
  { id: "4546", name: "EuroLeague", top: false, two: { sd: 11, tsd: 16, home: 3, avg: 82, lenSec: 3 * 3600 } },
  { id: "4380", name: "NHL", top: true, two: { sd: 2.3, tsd: 2.4, home: 0.25, avg: 3.1, lenSec: 3 * 3600 } },
  { id: "4391", name: "NFL", top: true, two: { sd: 13, tsd: 14, home: 2.3, avg: 22, lenSec: 4 * 3600 } },
  { id: "4424", name: "MLB", top: true, two: { sd: 4.4, tsd: 4.4, home: 0.3, avg: 4.5, lenSec: 4 * 3600 } },
];
export const TWO_WAY_LEAGUES: string[] = LEAGUES.filter((l) => l.two).map((l) => l.name);
/** A UEFA fixture is only offered when both clubs have at least this many games of form (cup + domestic): never a price from nothing. */
export const MIN_FORM_GAMES = 2;
/** Full-time statuses after extra time or penalties: the 90-minute result is not what the score shows (cup ties), so the 1X2 and goal bets are voided rather than guessed. */
export const EXTRA_TIME = new Set(["AET", "PEN", "AP"]);

export interface Fixture { eventId: string; league: string; home: string; away: string; kickoff: number; apiId?: string; lenSec?: number; homeBadge?: string; awayBadge?: string }
export interface TableRow { team: string; played: number; points: number; goalsFor: number; goalsAgainst: number }
export interface Geo { lat: number; lon: number }

export interface MatchMarketInsert {
  city_id: "world"; category: "sport"; kind: "match_bet"; feed_id: "sportsdb"; lat?: number; lon?: number;
  params: { league: string; eventId: string; home: string; away: string; bet: MatchBet | PlayerBet; kickoff: number; priors: Record<MatchBet, number>; apiId?: string; homeBadge?: string; awayBadge?: string; local?: "true"; testOnly?: boolean; player?: { id: number; name: string; side: "home" | "away"; pos: string } };
  closes_at: string; target_at: string; deadline_at: string; odds_yes: number; odds_no: number; dedupe_key: string;
}

/** Full time is about 105 minutes after kick-off; the score is read after that. */
export const MATCH_LENGTH_SEC = 110 * 60;

/** Town where a club plays when its name is not the town's name (for the "nearby" lists). */
export const CLUB_TOWN: Record<string, string> = {
  "Inter Milan": "Milano", "AC Milan": "Milano", "Juventus": "Torino", "Lazio": "Roma", "Atalanta": "Bergamo", "Fiorentina": "Firenze", "Hellas Verona": "Verona", "Genoa": "Genova", "Sampdoria": "Genova",
  "Juventus Next Gen": "Torino", "Spezia": "La Spezia", "Reggiana": "Reggio Emilia", "Virtus Entella": "Chiavari", "Carrarese": "Carrara", "Mantova": "Mantova", "Sudtirol": "Bolzano", "SudTirol": "Bolzano",
};

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const factorial = (n: number) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
const pois = (k: number, l: number) => Math.exp(-l) * Math.pow(l, k) / factorial(k);

/** Scoring rates from the league table: goals for/against per game pulled towards the league average (few games played = little trust), a little home advantage. A plain estimate, not a forecast model. */
function rates(home?: TableRow, away?: TableRow, avg = 1.3): [number, number] {
  const K = 4;
  const gf = (r?: TableRow) => (r ? (r.goalsFor + K * avg) / (r.played + K) : avg), ga = (r?: TableRow) => (r ? (r.goalsAgainst + K * avg) / (r.played + K) : avg);
  return [clamp(((gf(home) + ga(away)) / 2) * 1.08, 0.4, 3.2), clamp(((gf(away) + ga(home)) / 2) * 0.94, 0.3, 3)];
}

/** Goals per team per game across a table (1.3 when nothing is known). */
export function leagueAverage(table: TableRow[]): number {
  const played = table.reduce((n, r) => n + r.played, 0);
  return played >= 20 ? clamp(table.reduce((n, r) => n + r.goalsFor, 0) / played, 0.9, 1.8) : 1.3;
}

/** Standing built from played matches (the free table of the data source lists only five teams). */
export function tableFromResults(rows: { home: string; away: string; hg: number; ag: number }[]): TableRow[] {
  const t = new Map<string, TableRow>();
  const get = (team: string) => { let r = t.get(team); if (!r) { r = { team, played: 0, points: 0, goalsFor: 0, goalsAgainst: 0 }; t.set(team, r); } return r; };
  for (const m of rows) {
    const h = get(m.home), a = get(m.away);
    h.played++; a.played++; h.goalsFor += m.hg; h.goalsAgainst += m.ag; a.goalsFor += m.ag; a.goalsAgainst += m.hg;
    if (m.hg > m.ag) h.points += 3; else if (m.hg < m.ag) a.points += 3; else { h.points++; a.points++; }
  }
  return [...t.values()];
}

/** Typical corners and cards per match (rounded league averages), used as the centre of the chance for those bets. */
export const LEAGUE_NORMS = { top: { corners: 8.8, cards: 3.9, red: 0.14 }, other: { corners: 9.5, cards: 4.7, red: 0.19 } };
/** Share of the goals that come in the first half. */
const FIRST_HALF_SHARE = 0.44;

/** Standard normal tail: P(Z > z). */
const upper = (z: number) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)); const d = 0.3989423 * Math.exp((-z * z) / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? p : 1 - p; };
/** Chance that a count (mean m, a bit more spread than Poisson) reaches n or more. */
const atLeast = (n: number, m: number, spread: number) => upper((n - 0.5 - m) / Math.sqrt(m * spread));

/** Chance of every bet from independent Poisson goals (plus league norms for corners and cards). */
export function matchPriors(home?: TableRow, away?: TableRow, avg = 1.3, top = true): Record<MatchBet, number> {
  const [lh, la] = rates(home, away, avg);
  const p = Object.fromEntries(ALL_BETS.map((b) => [b, 0])) as Record<MatchBet, number>;
  for (let h = 0; h <= 10; h++) for (let a = 0; a <= 10; a++) {
    const w = pois(h, lh) * pois(a, la);
    if (h > a) p.home_win += w; else if (h === a) p.draw += w; else p.away_win += w;
    if (h + a >= 2) p.over_1_5 += w; if (h + a >= 3) p.over_2_5 += w; if (h + a >= 4) p.over_3_5 += w;
    if (h > 0 && a > 0) p.btts += w; if (a === 0) p.home_clean += w; if (h === 0) p.away_clean += w;
  }
  p.dc_1x = p.home_win + p.draw; p.dc_x2 = p.draw + p.away_win; p.dc_12 = p.home_win + p.away_win;
  // each half on its own
  for (const [half, share] of [["ht", FIRST_HALF_SHARE], ["st", 1 - FIRST_HALF_SHARE]] as const) {
    const x = lh * share, y = la * share;
    let w = 0, d = 0, l = 0;
    for (let h = 0; h <= 8; h++) for (let a = 0; a <= 8; a++) { const q = pois(h, x) * pois(a, y); if (h > a) w += q; else if (h === a) d += q; else l += q; }
    p[`${half}_home`] = w; p[`${half}_draw`] = d; p[`${half}_away`] = l; p[`${half}_goal`] = 1 - Math.exp(-(x + y));
  }
  const norm = top ? LEAGUE_NORMS.top : LEAGUE_NORMS.other;
  p.corners_8_5 = atLeast(9, norm.corners, 1.6); p.corners_9_5 = atLeast(10, norm.corners, 1.6); p.corners_10_5 = atLeast(11, norm.corners, 1.6); p.corners_11_5 = atLeast(12, norm.corners, 1.6);
  p.cards_3_5 = atLeast(4, norm.cards, 1.25); p.cards_4_5 = atLeast(5, norm.cards, 1.25); p.cards_5_5 = atLeast(6, norm.cards, 1.25);
  p.red_card = norm.red;
  for (const k of ALL_BETS) p[k] = Math.round(clamp(p[k], 0.04, 0.96) * 1000) / 1000;
  return p;
}

/** What is known about a finished match. Half-time, corners and cards stay undefined when the source does not have them. */
export interface MatchStats { players?: PlayerFacts | null; hg: number; ag: number; htHome?: number | null; htAway?: number | null; corners?: number | null; cards?: number | null; reds?: number | null }

/** The result of a bet, or null when the figure it needs is not available (the market is then voided and refunded, never guessed). */
export function evalMatch(bet: MatchBet | PlayerBet | TwoBet, s: MatchStats): boolean | null {
  if (!isTwoBet(bet) && !isPlayerBet(bet) && !(ALL_BETS as string[]).includes(bet)) return null;
  if (isTwoBet(bet)) { const line = twoBetLine(bet); return bet.startsWith("tot") ? s.hg + s.ag > line : s.hg - s.ag > line; }
  if (isPlayerBet(bet)) {
    if (!s.players) return null;
    const id = playerBetId(bet);
    return bet.startsWith("pg") ? s.players.goals.includes(id) : bet.startsWith("pa") ? s.players.assists.includes(id) : s.players.subs.includes(id);
  }
  if (!isDetailBet(bet)) return evalBet(bet, s.hg, s.ag);
  if (bet.startsWith("ht_") || bet.startsWith("st_")) {
    if (s.htHome === null || s.htHome === undefined || s.htAway === null || s.htAway === undefined) return null;
    const first = bet.startsWith("ht_"), h = first ? s.htHome : s.hg - s.htHome, a = first ? s.htAway : s.ag - s.htAway;
    if (h < 0 || a < 0) return null;
    const k = bet.slice(3);
    return k === "home" ? h > a : k === "draw" ? h === a : k === "away" ? a > h : h + a >= 1;
  }
  if (bet.startsWith("corners_")) { if (s.corners === null || s.corners === undefined) return null; return s.corners > Number(bet.slice(8).replace("_", ".")); }
  if (bet.startsWith("cards_")) { if (s.cards === null || s.cards === undefined) return null; return s.cards > Number(bet.slice(6).replace("_", ".")); }
  if (s.reds === null || s.reds === undefined) return null;
  return s.reds >= 1;
}

/** Only for the bets that need the final score alone. */
export const evalBet = (bet: BasicBet, h: number, a: number): boolean =>
  bet === "home_win" ? h > a : bet === "draw" ? h === a : bet === "away_win" ? a > h : bet === "dc_1x" ? h >= a : bet === "dc_x2" ? a >= h : bet === "dc_12" ? h !== a : bet === "over_1_5" ? h + a >= 2 : bet === "over_2_5" ? h + a >= 3 : bet === "over_3_5" ? h + a >= 4
  : bet === "btts" ? h > 0 && a > 0 : bet === "home_clean" ? a === 0 : bet === "away_clean" ? h === 0 : false;

export function matchMarket(f: Fixture, bet: MatchBet, priors: Record<MatchBet, number>, geo: Geo | undefined, testOnly: boolean, custom?: { by: string | null }): MatchMarketInsert {
  const odds = computeOdds(clamp(priors[bet], 0.1, 0.9));
  return {
    city_id: "world", category: "sport", kind: "match_bet", feed_id: "sportsdb", ...(geo ? { lat: geo.lat, lon: geo.lon } : {}),
    params: { league: f.league, eventId: f.eventId, home: f.home, away: f.away, bet, kickoff: f.kickoff, priors, ...(f.apiId ? { apiId: f.apiId } : {}), ...(f.homeBadge ? { homeBadge: f.homeBadge } : {}), ...(f.awayBadge ? { awayBadge: f.awayBadge } : {}), ...(geo ? { local: "true" as const } : {}), ...(testOnly ? { testOnly: true } : {}), ...(custom ? { custom: "true", by: custom.by } : {}) } as MatchMarketInsert["params"],
    closes_at: new Date((f.kickoff - 300) * 1000).toISOString(), target_at: new Date((f.kickoff + (f.lenSec ?? MATCH_LENGTH_SEC)) * 1000).toISOString(), deadline_at: new Date((f.kickoff + 12 * 3600) * 1000).toISOString(),
    odds_yes: odds.yes, odds_no: odds.no, dedupe_key: `sport|${f.eventId}|${bet}`,
  };
}

/** A bet on one player: priced from the position and the team's expected goals, settled from the match events. */
export function playerMarket(f: Fixture, bet: PlayerBet, player: LineupPlayer, chance: number, priors: Record<MatchBet, number>, geo: Geo | undefined, custom: { by: string | null }): MatchMarketInsert {
  const m = matchMarket(f, "home_win", priors, geo, false, custom);
  const odds = computeOdds(clamp(chance, 0.1, 0.9));
  return { ...m, params: { ...m.params, bet, player: { id: player.id, name: player.name, side: player.side, pos: player.pos } }, odds_yes: odds.yes, odds_no: odds.no, dedupe_key: `sport|${f.eventId}|${bet}` };
}

const phi = (z: number) => 1 - upper(z);
/** Chance that the home side wins a game without draws: normal margin around the difference in strength (points scored and conceded per game, pulled to the average). */
export function twoWayPriors(home: TableRow | undefined, away: TableRow | undefined, cfg: TwoWayCfg): Record<MatchBet, number> {
  const K = 4, net = (r?: TableRow) => (r ? (r.goalsFor - r.goalsAgainst) / (r.played + K) : 0);
  const mu = net(home) - net(away) + cfg.home;
  const p = clamp(phi(mu / cfg.sd), 0.1, 0.9);
  const out = Object.fromEntries(ALL_BETS.map((b) => [b, 0.5])) as Record<MatchBet, number>;
  out.home_win = Math.round(p * 1000) / 1000; out.away_win = Math.round((1 - p) * 1000) / 1000;
  // total points: each side scores about the mean of its own attack and the other's defence
  const rate = (r: TableRow | undefined, k: "goalsFor" | "goalsAgainst") => (r ? (r[k] + K * cfg.avg) / (r.played + K) : cfg.avg);
  const muT = rate(home, "goalsFor") / 2 + rate(away, "goalsAgainst") / 2 + rate(away, "goalsFor") / 2 + rate(home, "goalsAgainst") / 2;
  const half = (x: number) => Math.floor(x) + 0.5, line = (x: number) => String(half(x)), extra = out as unknown as Record<string, number>;
  const put = (key: string, chance: number) => { extra[key] = Math.round(clamp(chance, 0.1, 0.9) * 1000) / 1000; };
  for (const k of [-0.6, 0, 0.6]) { const l = half(muT + k * cfg.tsd); put(`tot:${l}`, upper((l - muT) / cfg.tsd)); }
  for (const l of new Set([-half(cfg.sd), -half(cfg.sd * 0.5), half(cfg.sd * 0.5), half(cfg.sd)])) put(`mrg:${l}`, upper((l - mu) / cfg.sd));
  void line;
  return out;
}

export type BookQuotes = { name: string; bets?: { name: string; values: { value: string; odd: string }[] }[] }[];

/**
 * The chance of each bet implied by what bookmakers quote: the quotes of every bookmaker are turned into chances, the margin is taken out
 * of each market, and the bookmakers are averaged. Only the bets bookmakers quote directly (1X2, double chance, goals over/under, both score).
 */
export function bookPriors(books: BookQuotes): Partial<Record<MatchBet, number>> {
  const market = (name: string, keys: string[]) => {
    const rows: number[][] = [];
    for (const b of books) {
      const vals = b.bets?.find((x) => x.name === name)?.values; if (!vals) continue;
      const odds = keys.map((k) => Number(vals.find((v) => v.value === k)?.odd));
      if (odds.every((o) => Number.isFinite(o) && o > 1)) { const inv = odds.map((o) => 1 / o), s = inv.reduce((a, x) => a + x, 0); rows.push(inv.map((x) => x / s)); }
    }
    return rows.length >= 3 ? keys.map((_, i) => rows.reduce((a, r) => a + r[i]!, 0) / rows.length) : null;
  };
  const out: Partial<Record<MatchBet, number>> = {};
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  const x12 = market("Match Winner", ["Home", "Draw", "Away"]);
  if (x12) { out.home_win = r3(x12[0]!); out.draw = r3(x12[1]!); out.away_win = r3(x12[2]!); out.dc_1x = r3(x12[0]! + x12[1]!); out.dc_x2 = r3(x12[1]! + x12[2]!); out.dc_12 = r3(x12[0]! + x12[2]!); }
  for (const [line, bet] of [["1.5", "over_1_5"], ["2.5", "over_2_5"], ["3.5", "over_3_5"]] as const) { const ou = market("Goals Over/Under", [`Over ${line}`, `Under ${line}`]); if (ou) out[bet] = r3(ou[0]!); }
  const bt = market("Both Teams Score", ["Yes", "No"]); if (bt) out.btts = r3(bt[0]!);
  return out;
}

/** `geo` is looked up by event id first (a fixture of a foreign league is "local" at the Italian club's town, home or away), then by home team. `minPlayed`: skip fixtures of clubs with less form than that. */
export function buildMatchMarkets(fixtures: Fixture[], table: TableRow[], now: number, testOnly: boolean, geo: Map<string, Geo>, top: boolean, two?: TwoWayCfg, book?: Map<string, Partial<Record<MatchBet, number>>>, minPlayed = 0): MatchMarketInsert[] {
  const by = new Map(table.map((r) => [r.team, r]));
  const avg = leagueAverage(table);
  const out: MatchMarketInsert[] = [];
  for (const f of fixtures) {
    if (f.kickoff - 600 <= now + 300 || f.kickoff > now + 7 * 86400) continue;
    if (minPlayed > 0 && ((by.get(f.home)?.played ?? 0) < minPlayed || (by.get(f.away)?.played ?? 0) < minPlayed)) continue;
    const modelPri = two ? twoWayPriors(by.get(f.home), by.get(f.away), two) : matchPriors(by.get(f.home), by.get(f.away), avg, top);
    const pri = { ...modelPri, ...(book?.get(f.eventId) ?? {}) } as typeof modelPri;
    const fx = two ? { ...f, lenSec: two.lenSec } : f;
    for (const bet of two ? (["home_win", "away_win"] as MatchBet[]) : top ? AUTO_BETS : AUTO_BETS_LOWER) out.push(matchMarket(fx, bet, pri, geo.get(f.eventId) ?? geo.get(f.home), testOnly));
  }
  return out;
}

export interface MatchObservation { players?: PlayerFacts | null; eventId: string; homeGoals: number | null; awayGoals: number | null; status: string; fetchedAt: number; htHome?: number | null; htAway?: number | null; corners?: number | null; cards?: number | null; reds?: number | null }
export const FINISHED = new Set(["FT", "AET", "PEN", "AOT", "AP", "Match Finished"]);
