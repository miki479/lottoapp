/**
 * The collectible "figurine" cards of the pack shop: 100 numbered cards across every category of the app.
 * Pure data, no text (the names and captions are in web/src/lib/cardText.ts, in four languages).
 * Mirrored by supabase/migrations/0107_shop_daily.sql (tests/shop.test.ts compares the ids and rarities with the SQL).
 */
export type PackRarity = "common" | "rare" | "epic" | "legendary";
export type CardCat = "transport" | "weather" | "nature" | "sport" | "games" | "finance" | "culture" | "law";
/** Album order. */
export const CARD_CATS: readonly CardCat[] = ["transport", "weather", "nature", "sport", "games", "finance", "culture", "law"];
export const CARD_TOTAL = 100;

export interface CardDef {
  /** 1..100: the number printed on the card ("n. 17 of 100"). */
  n: number;
  /** "c001".."c100": the id stored in the database. */
  id: string;
  cat: CardCat;
  rarity: PackRarity;
  /** Name of a lucide icon (the web app maps it to the component). */
  icon: string;
}

const C = "common", R = "rare", E = "epic", L = "legendary";
/** Category, rarity and icon of each card, in number order (card n is row n). Texts live in web/src/lib/cardText.ts, same order. */
const ROWS: [CardCat, PackRarity, string][] = [
  // transport 1-24
  ["transport", C, "TrainFront"], ["transport", C, "TramFront"], ["transport", C, "Bike"], ["transport", C, "Bus"], ["transport", C, "TrainTrack"], ["transport", C, "Building2"], ["transport", C, "Building"],
  ["transport", C, "Footprints"], ["transport", C, "Car"], ["transport", C, "Signpost"], ["transport", C, "Clock"], ["transport", C, "Users"], ["transport", C, "BusFront"], ["transport", C, "Route"],
  ["transport", R, "Zap"], ["transport", R, "Navigation"], ["transport", R, "Waypoints"], ["transport", R, "Moon"], ["transport", R, "Megaphone"], ["transport", R, "Ban"],
  ["transport", E, "Ghost"], ["transport", E, "Rabbit"], ["transport", E, "TimerOff"], ["transport", L, "Crown"],
  // weather 25-36
  ["weather", C, "CloudRain"], ["weather", C, "Umbrella"], ["weather", C, "Sun"], ["weather", C, "Wind"], ["weather", C, "Cloud"], ["weather", C, "Thermometer"],
  ["weather", R, "CloudSnow"], ["weather", R, "CloudLightning"], ["weather", R, "Rainbow"], ["weather", E, "Tornado"], ["weather", E, "CloudFog"], ["weather", L, "Snowflake"],
  // nature 37-46
  ["nature", C, "Mountain"], ["nature", C, "Waves"], ["nature", C, "Flower2"], ["nature", C, "Moon"], ["nature", C, "Bird"],
  ["nature", R, "Activity"], ["nature", R, "Orbit"], ["nature", E, "Flame"], ["nature", E, "Sparkles"], ["nature", L, "CircleDot"],
  // sport 47-58
  ["sport", C, "Goal"], ["sport", C, "Timer"], ["sport", C, "Flag"], ["sport", C, "Swords"], ["sport", C, "Dumbbell"], ["sport", C, "Camera"],
  ["sport", R, "Target"], ["sport", R, "TrendingUp"], ["sport", R, "Gauge"], ["sport", E, "RectangleVertical"], ["sport", E, "Bell"], ["sport", L, "Trophy"],
  // games 59-68
  ["games", C, "Gamepad2"], ["games", C, "Dices"], ["games", C, "Puzzle"], ["games", C, "Save"], ["games", C, "Loader"], ["games", C, "Skull"], ["games", C, "Rabbit"],
  ["games", R, "Gem"], ["games", R, "Users"], ["games", E, "Crown"],
  // finance 69-78
  ["finance", C, "Coins"], ["finance", C, "PiggyBank"], ["finance", C, "Fuel"], ["finance", C, "TrendingDown"], ["finance", C, "Receipt"], ["finance", C, "Banknote"],
  ["finance", R, "Droplet"], ["finance", R, "TrendingUp"], ["finance", E, "Bitcoin"], ["finance", L, "Gem"],
  // culture 79-90
  ["culture", C, "Music"], ["culture", C, "Tv"], ["culture", C, "Popcorn"], ["culture", C, "Mic"], ["culture", C, "BookOpen"], ["culture", C, "Radio"],
  ["culture", R, "Clapperboard"], ["culture", R, "Music2"], ["culture", R, "Theater"], ["culture", E, "Palette"], ["culture", E, "Disc3"], ["culture", L, "Star"],
  // law 91-100
  ["law", C, "Gavel"], ["law", C, "Stamp"], ["law", C, "FileText"], ["law", C, "Ticket"], ["law", C, "Hourglass"],
  ["law", R, "Landmark"], ["law", R, "Vote"], ["law", R, "Scale"], ["law", R, "ScrollText"], ["law", E, "BadgeCheck"],
];

export const CARDS: readonly CardDef[] = ROWS.map(([cat, rarity, icon], i) => ({ n: i + 1, id: `c${String(i + 1).padStart(3, "0")}`, cat, rarity, icon }));
export const cardById = (id: string): CardDef | undefined => CARDS.find((c) => c.id === id);
export const cardsOfCat = (cat: CardCat): CardDef[] => CARDS.filter((c) => c.cat === cat);
