// The house question "will Grand Theft Auto VI come out on 19 November?". Odds from the news: Take-Two repeated the date in its earnings reports,
// pre-orders are open, but the game already slipped twice, so about 90% for Yes.   node scripts/create-house-gta6.mjs [--apply]
import { computeOdds } from "../shared/odds.ts";
import { supabaseUrl } from "./lib-env.mjs";

const SB = supabaseUrl(), KEY = process.env.SUPABASE_SERVICE_ROLE_KEY, apply = process.argv.includes("--apply");
const closes = Date.parse("2026-11-18T23:00:00Z"), at = Date.parse("2026-11-20T00:00:00Z") / 1000, p = 0.9, odds = computeOdds(p);
const row = {
  city_id: "world", category: "culture", kind: "tick_gt", feed_id: "tick-house:gta6",
  params: {
    series: "house:gta6", at, unit: "", label: "Grand Theft Auto VI", threshold: 0.5, house: true, art: "gta6", releaseAt: closes / 1000,
    viceBonus: 8, q: { it: "Grand Theft Auto VI uscirà il 19 novembre?", en: "Will Grand Theft Auto VI be released on November 19?", ja: "『グランド・セフト・オートVI』は11月19日に発売される？" },
  },
  closes_at: new Date(closes).toISOString(), target_at: new Date(at * 1000).toISOString(), deadline_at: "2026-12-20T00:00:00Z",
  odds_yes: odds.yes, odds_no: odds.no, dedupe_key: `world|tick_house:gta6|${at}|0.5`,
};
console.log(row.dedupe_key, odds);
if (apply) {
  const r = await fetch(`${SB}/rest/v1/markets?on_conflict=dedupe_key`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(row) });
  console.log(r.status, (await r.text()).slice(0, 200));
}
