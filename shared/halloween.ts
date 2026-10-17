// The five Halloween challenges. The database (supabase/migrations/0160_halloween.sql) counts the wins; this table only names them and says which market category each one watches.
export const HALLOWEEN_TARGET = 3;
export const HALLOWEEN_CHALLENGES = [
  { id: "halloween_treni", category: "train" },
  { id: "halloween_meteo", category: "weather" },
  { id: "halloween_traffico", category: "traffic" },
  { id: "halloween_mercati", category: "finance" },
  { id: "halloween_sport", category: "sport" },
] as const;
export type HalloweenId = (typeof HALLOWEEN_CHALLENGES)[number]["id"];
// the badge pictures that exist; the traffic one has not been delivered yet, so its card shows an empty slot instead of another picture
export const HALLOWEEN_PICTURES: readonly HalloweenId[] = ["halloween_treni", "halloween_meteo", "halloween_mercati", "halloween_sport"];
