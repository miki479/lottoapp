/**
 * Daily bonus calendar and the pack shop. Fake credits only.
 * Mirrors supabase/migrations/0107_shop_daily.sql (tests/shop.test.ts compares the numbers with the SQL text).
 */
import { CARDS, type PackRarity } from "./cards.ts";
import { AVATARS, DECORATIONS } from "./looks.ts";

export type { PackRarity } from "./cards.ts";

// ---------------------------------------------------------------------------------------------
// Daily bonus: a seven-day calendar driven by the streak the app already keeps (profiles.streak).
// ---------------------------------------------------------------------------------------------

/** Credits for day 1..7 of the calendar. After day 7 the calendar starts again at day 1. */
export const DAILY_AMOUNTS = [100, 200, 300, 400, 500, 600, 700] as const;
export const DAILY_CYCLE = DAILY_AMOUNTS.length;
export const DAILY_WEEK_TOTAL = DAILY_AMOUNTS.reduce((a, b) => a + b, 0);

/** Calendar day (1..7) that a streak length falls on: streak 1 is day 1, streak 7 is day 7, streak 8 is day 1 again. */
export const dailyDay = (streak: number): number => ((Math.max(1, Math.floor(streak) || 1) - 1) % DAILY_CYCLE) + 1;
/** Credits paid by the daily bonus on a given streak length. */
export const dailyAmount = (streak: number): number => DAILY_AMOUNTS[dailyDay(streak) - 1]!;

/** Whole days from `a` to `b` (both "YYYY-MM-DD"). */
export const daysBetween = (a: string, b: string): number => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * The streak length today's bonus belongs to. Same rule as register_play (migration 0010):
 * a bet already counted today -> the streak itself; last bet yesterday -> one more; two days ago with a freeze in stock -> one more
 * (the freeze covers the missed day); otherwise the streak starts over at 1.
 */
export function streakDayToday(streak: number, lastPlayDate: string | null, today: string, freezes: number): { day: number; counted: boolean; usesFreeze: boolean } {
  if (lastPlayDate === today) return { day: Math.max(1, streak), counted: true, usesFreeze: false };
  const gap = lastPlayDate ? daysBetween(lastPlayDate, today) : null;
  if (gap === 1) return { day: streak + 1, counted: false, usesFreeze: false };
  if (gap === 2 && freezes > 0) return { day: streak + 1, counted: false, usesFreeze: true };
  return { day: 1, counted: false, usesFreeze: false };
}

// ---------------------------------------------------------------------------------------------
// Pack shop
// ---------------------------------------------------------------------------------------------

export const PACK_RARITIES: readonly PackRarity[] = ["common", "rare", "epic", "legendary"];
export const isPackRarity = (s: unknown): s is PackRarity => (PACK_RARITIES as readonly string[]).includes(String(s));

export interface PackDef {
  tier: 1 | 2 | 3 | 4;
  /** Credits. */
  price: number;
  /** Chance of each rarity in basis points (1/100 of a percent); the four numbers add up to 10000. */
  odds: Record<PackRarity, number>;
}
export const PACKS: readonly PackDef[] = [
  { tier: 1, price: 60, odds: { common: 7700, rare: 1900, epic: 350, legendary: 50 } },
  { tier: 2, price: 250, odds: { common: 4800, rare: 3500, epic: 1500, legendary: 200 } },
  { tier: 3, price: 700, odds: { common: 1800, rare: 4200, epic: 3300, legendary: 700 } },
  { tier: 4, price: 2000, odds: { common: 500, rare: 2000, epic: 4000, legendary: 3500 } },
];
export const packOf = (tier: number): PackDef | undefined => PACKS.find((p) => p.tier === tier);

/** A duplicate pays back this share of the pack price (rounded down). */
export const REFUND_PCT = 10;
export const packRefund = (price: number): number => Math.floor((price * REFUND_PCT) / 100);
/** Packs opened per local day and the minimum gap between two purchases (seconds): a gentle brake, mirrored by buy_pack. */
export const DAILY_PACK_CAP = 12;
export const PACK_GAP_SEC = 2;

/** Avatars everybody owns. All the others are collectible. */
export const DEFAULT_AVATARS: readonly string[] = ["conductor", "busbot", "cloud", "fox"];
/**
 * Rarity of each collectible avatar (decorations keep the rarity they have in looks.ts). The looks are the rarer pulls:
 * there is no common one, so they only come out of the pools that hold fewer cards.
 */
export const AVATAR_RARITY: Readonly<Record<string, PackRarity>> = { ball: "rare", bolt: "rare", clock: "epic", astro: "epic", alien: "legendary", kandinsky: "legendary", robot: "rare", panda: "rare", wizard: "epic", samurai: "epic", dragon: "legendary", lion: "legendary",
  // the "Routes" collection
  coach: "rare", rail: "epic", skycloud: "epic", grove: "epic", horn: "rare", citybus: "rare", express: "epic", traffic: "rare", loudspeaker: "rare", oak: "epic", sunny: "rare",
  // the "Forged" collection
  gear: "rare", ziggurat: "rare", star: "rare", bear: "rare", owl: "rare", wolf: "rare", tiger: "rare", panther: "rare", raven: "rare", drop: "rare", pilot: "epic", knight: "epic", ninja: "epic", cosmonaut: "epic", mech: "epic", falcon: "epic", cobra: "epic", vixen: "epic", lionheart: "epic", emerald: "epic", prism: "epic", shogun: "legendary", eagle: "legendary", wyvern: "legendary", orb: "legendary", goldspiral: "legendary", steelspiral: "legendary", twinrings: "legendary", ember: "legendary", sculpt: "legendary" };

export type ItemKind = "avatar" | "card" | "decoration";
export interface ShopItem { kind: ItemKind; id: string; rarity: PackRarity }
const byKey = (a: ShopItem, b: ShopItem) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Everything a pack can hold: the 100 figurine cards, the avatars that are not default and the decorations that no level unlocks.
 * Sorted by kind then id: the same order the SQL uses to turn the item roll into an item.
 */
export const SHOP_ITEMS: readonly ShopItem[] = [
  ...CARDS.map((c): ShopItem => ({ kind: "card", id: c.id, rarity: c.rarity })),
  ...AVATARS.filter((a) => !DEFAULT_AVATARS.includes(a)).map((id): ShopItem => ({ kind: "avatar", id, rarity: AVATAR_RARITY[id]! })),
  ...DECORATIONS.filter((d) => d.level === undefined).map((d): ShopItem => ({ kind: "decoration", id: d.id, rarity: d.rarity as PackRarity })),
].sort(byKey);

export const itemKey = (kind: ItemKind, id: string): string => `${kind}:${id}`;
export const itemsOfRarity = (r: PackRarity): ShopItem[] => SHOP_ITEMS.filter((i) => i.rarity === r);

/** Rarity for a roll in 0..9999 (the SQL draws floor(random() * 10000)): the first slice that covers it. */
export function rarityForRoll(pack: PackDef, roll: number): PackRarity {
  let edge = 0;
  for (const r of PACK_RARITIES) { edge += pack.odds[r]; if (roll < edge) return r; }
  return "legendary";
}

export interface PackResult { tier: number; price: number; rarity: PackRarity; item: ShopItem; duplicate: boolean; refund: number }
/**
 * What a pack gives for two draws: `rarityRoll` in 0..9999 and `itemRoll` in [0, 1). `owned` holds itemKey()s.
 * Returns null for an unknown tier. The SQL draws the two numbers with random().
 */
export function rollPack(tier: number, rarityRoll: number, itemRoll: number, owned: ReadonlySet<string>): PackResult | null {
  const pack = packOf(tier);
  if (!pack) return null;
  const rarity = rarityForRoll(pack, rarityRoll);
  const pool = itemsOfRarity(rarity);
  const item = pool[Math.min(pool.length - 1, Math.floor(itemRoll * pool.length))]!;
  const duplicate = owned.has(itemKey(item.kind, item.id));
  return { tier, price: pack.price, rarity, item, duplicate, refund: duplicate ? packRefund(pack.price) : 0 };
}

/** Chance (0..1) that the next pack of this tier gives something already owned. */
export function duplicateChance(tier: number, owned: ReadonlySet<string>): number {
  const pack = packOf(tier);
  if (!pack) return 0;
  let p = 0;
  for (const r of PACK_RARITIES) {
    const pool = itemsOfRarity(r);
    if (pool.length === 0) continue;
    p += (pack.odds[r] / 10000) * (pool.filter((i) => owned.has(itemKey(i.kind, i.id))).length / pool.length);
  }
  return p;
}
/** Average credits a pack of this tier gives back (only duplicates pay), given what is already owned. */
export const expectedRefund = (tier: number, owned: ReadonlySet<string>): number => duplicateChance(tier, owned) * packRefund(packOf(tier)?.price ?? 0);
/** Average cost of a pack once the refund is counted. Always positive: the shop only takes credits out of the game. */
export const expectedNetCost = (tier: number, owned: ReadonlySet<string>): number => (packOf(tier)?.price ?? 0) - expectedRefund(tier, owned);
/** The most a pack can ever give back on average: the whole album already owned. */
export const maxExpectedRefund = (tier: number): number => expectedRefund(tier, new Set(SHOP_ITEMS.map((i) => itemKey(i.kind, i.id))));

/** Chance (0..1) that a pack of this tier holds a look (avatar or decoration) instead of a card. */
export function lookChance(tier: number): number {
  const pack = packOf(tier);
  if (!pack) return 0;
  let p = 0;
  for (const r of PACK_RARITIES) {
    const pool = itemsOfRarity(r);
    if (pool.length > 0) p += (pack.odds[r] / 10000) * (pool.filter((i) => i.kind !== "card").length / pool.length);
  }
  return p;
}

/**
 * The deal of the day: one of the 250 / 700 / 2000 packs costs 20 / 25 / 30% less until midnight UTC, rotating every day.
 * Mirrors public.shop_deal() (tested against the SQL).
 */
export function dealOf(ms: number): { tier: number; pct: number } {
  const d = Math.floor(ms / 86_400_000);
  return { tier: 2 + (d % 3), pct: [20, 30, 25][Math.floor(d / 3) % 3]! };
}
export const dealPrice = (price: number, pct: number): number => price - Math.floor((price * pct) / 100);

/**
 * Supplies sold for credits. A boost doubles the net win of one bet (extra capped at 1000: worth up to ~800 on the best bet), so it is priced above that
 * and credits cannot be printed by buying them; a freeze saves a streak. Bundles are about 13% cheaper than the singles. Stock caps: 20 boosts, 2 freezes.
 * Mirrors public.shop_supplies() (tested).
 */
export interface Supply { id: "boost1" | "boost5" | "freeze1" | "kit"; price: number; boosts: number; freezes: number }
export const SUPPLIES: readonly Supply[] = [
  { id: "boost1", price: 750, boosts: 1, freezes: 0 },
  { id: "boost5", price: 3250, boosts: 5, freezes: 0 },
  { id: "freeze1", price: 400, boosts: 0, freezes: 1 },
  { id: "kit", price: 2650, boosts: 3, freezes: 2 },
];
export const MAX_BOOSTS = 20, MAX_FREEZES = 2;
/** True when buying this supply would go past the stock caps. */
export const supplyFull = (s: Supply, boosts: number, freezes: number): boolean => boosts + s.boosts > MAX_BOOSTS || freezes + s.freezes > MAX_FREEZES;
