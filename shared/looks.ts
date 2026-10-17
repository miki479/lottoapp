/**
 * How a player looks: one of the app's cartoon characters, inside a decoration ring made of a material.
 * Ring decorations unlock with the level (copper, bronze ... adamantium) or drop at random from the daily chest and the flash mission.
 */
/** The cartoon characters first; the "Forged" collection (rendered, faceted amber and amethyst) after them. */
export const FORGED_AVATARS = ["pilot", "star", "emerald", "orb", "bear", "ziggurat", "gear", "goldspiral", "falcon", "ninja", "steelspiral", "cobra", "shogun", "cosmonaut", "eagle", "raven", "sculpt", "owl", "lionheart", "wyvern", "tiger", "knight", "drop", "panther", "mech", "vixen", "prism", "twinrings", "ember", "wolf"] as const;
/** The "Routes" collection: the app's own worlds (bus, train, weather) as faceted crystal and steel objects. */
export const ROUTE_AVATARS = ["coach", "rail", "skycloud", "grove", "horn"] as const;
/** The "In the city" collection: the same worlds as soft, bright 3D objects (bus, train, traffic light, loudspeaker, tree, weather). */
export const CITY_AVATARS = ["citybus", "express", "traffic", "loudspeaker", "oak", "sunny", "clapper", "shades", "wheel", "growth", "spark", "xeno", "curve", "fist", "spacesuit", "beats", "leaf", "junction", "greyalien", "capboy", "bull", "shadesgirl", "busstop", "greenalien", "trainwheel", "basket", "greyhoodie", "peak", "reel", "android"] as const;
export const AVATARS = ["conductor", "busbot", "cloud", "fox", "ball", "bolt", "alien", "astro", "clock", "kandinsky", "robot", "panda", "wizard", "samurai", "dragon", "lion", ...FORGED_AVATARS, ...ROUTE_AVATARS, ...CITY_AVATARS] as const;
export const CLASSIC_AVATARS = AVATARS.filter((a) => !(FORGED_AVATARS as readonly string[]).includes(a) && !(ROUTE_AVATARS as readonly string[]).includes(a) && !(CITY_AVATARS as readonly string[]).includes(a));
export type AvatarId = (typeof AVATARS)[number];
export const isAvatar = (s: unknown): s is AvatarId => (AVATARS as readonly string[]).includes(String(s));

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
export interface DecorationDef { id: string; rarity: Rarity; /** Level that unlocks it; absent for the ones that only drop at random. */ level?: number }
export const DECORATIONS: DecorationDef[] = [
  { id: "copper", rarity: "common", level: 2 },
  { id: "bronze", rarity: "common", level: 4 },
  { id: "silver", rarity: "uncommon", level: 6 },
  { id: "gold", rarity: "rare", level: 9 },
  { id: "diamond", rarity: "epic", level: 13 },
  { id: "amethyst", rarity: "epic", level: 18 },
  { id: "platinum", rarity: "legendary", level: 24 },
  { id: "mithril", rarity: "legendary", level: 31 },
  { id: "orichalcum", rarity: "mythic", level: 40 },
  { id: "adamantium", rarity: "mythic", level: 50 },
  { id: "jade", rarity: "rare" },
  { id: "ruby", rarity: "epic" },
  { id: "sapphire", rarity: "epic" },
  { id: "obsidian", rarity: "legendary" },
  { id: "opal", rarity: "legendary" },
];
export type DecorationId = string;
export const isDecoration = (s: unknown): boolean => DECORATIONS.some((d) => d.id === s);
/** The ones that shine (animated light): the more precious materials. */
export const SHINES = new Set(["gold", "diamond", "amethyst", "platinum", "mithril", "orichalcum", "adamantium", "ruby", "sapphire", "obsidian", "opal"]);

/** Experience needed to reach a level: level 2 at 100, level 10 at 3,750, level 50 at about 61,600. */
export const xpForLevel = (level: number): number => (level <= 1 ? 0 : Math.round(100 * Math.pow(level - 1, 1.65)));
export const MAX_LEVEL = 99;
export function levelOfXp(xp: number): number {
  if (!(xp > 0)) return 1;
  let l = Math.min(MAX_LEVEL, 1 + Math.floor(Math.pow(xp / 100, 1 / 1.65)));
  while (l < MAX_LEVEL && xpForLevel(l + 1) <= xp) l++;
  while (l > 1 && xpForLevel(l) > xp) l--;
  return l;
}
/** Progress inside the current level, 0..1, and what is left to the next one. */
export function levelProgress(xp: number): { level: number; into: number; need: number; ratio: number } {
  const level = levelOfXp(xp), a = xpForLevel(level), b = xpForLevel(level + 1);
  return { level, into: Math.max(0, xp - a), need: Math.max(1, b - a), ratio: level >= MAX_LEVEL ? 1 : Math.min(1, Math.max(0, (xp - a) / Math.max(1, b - a))) };
}
/** Decorations a player of this level can wear (the dropped ones are added from what they own). */
export const unlockedByLevel = (level: number): string[] => DECORATIONS.filter((d) => d.level !== undefined && d.level <= level).map((d) => d.id);
/** The next level-based decoration and the level it needs, if any. */
export const nextUnlock = (level: number): DecorationDef | null => DECORATIONS.filter((d) => d.level !== undefined && d.level > level).sort((a, b) => a.level! - b.level!)[0] ?? null;
