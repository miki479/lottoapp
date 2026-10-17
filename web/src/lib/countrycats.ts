import type { CatId } from "../components/CatChips.tsx";

const DEFAULT: CatId[] = ["bus", "train", "flights", "weather", "nature", "strike", "traffic", "finance", "culture", "games", "space", "sport", "law", "gov"];
const SPORT_FIRST: CatId[] = ["sport", "weather", "finance", "culture", "games", "space", "train", "bus", "flights", "nature", "strike", "traffic", "law", "gov"];
/** What people in a country look for first: football-and-ball-sport countries open on sport, Japan on its typhoons, quakes and trains, northern Europe on trains and weather. */
const ORDER: Record<string, CatId[]> = {
  US: SPORT_FIRST, CA: SPORT_FIRST, AU: SPORT_FIRST, BR: SPORT_FIRST, MX: SPORT_FIRST, IN: SPORT_FIRST, KR: SPORT_FIRST, GB: SPORT_FIRST, IE: SPORT_FIRST,
  JP: ["nature", "train", "weather", "sport", "bus", "flights", "culture", "games", "space", "finance", "traffic", "strike", "law", "gov"],
  DE: ["train", "weather", "sport", "bus", "flights", "nature", "finance", "culture", "games", "space", "traffic", "strike", "law", "gov"],
  NL: ["train", "weather", "sport", "bus", "flights", "finance", "culture", "games", "space", "nature", "traffic", "strike", "law", "gov"],
  CH: ["train", "weather", "sport", "bus", "flights", "nature", "finance", "culture", "games", "space", "traffic", "strike", "law", "gov"],
  FR: ["train", "weather", "sport", "bus", "flights", "culture", "games", "space", "finance", "nature", "traffic", "strike", "law", "gov"],
  ES: ["sport", "train", "weather", "bus", "flights", "culture", "games", "space", "finance", "nature", "traffic", "strike", "law", "gov"],
};
/** Categories that make no sense, or are touchy, in a country: kept hidden unless they have something to show (and the touchy ones always). */
const HIDE_ALWAYS: Record<string, CatId[]> = { JP: ["law"], KR: ["law"], IN: ["law"] };

/** The category tiles for a country, in the order that fits it: `strike` only where the Italian strike calendar applies, and nothing empty that is irrelevant there. */
export function catTiles(country: string | null | undefined, italian: boolean, counts: Partial<Record<CatId, number>>): CatId[] {
  const order = (country && ORDER[country]) || DEFAULT, hide = new Set<CatId>((country && HIDE_ALWAYS[country]) || []);
  return order.filter((c) => !hide.has(c) && (c !== "strike" || italian) && (c !== "traffic" || (counts.traffic ?? 0) > 0 || country === "FI"));
}
