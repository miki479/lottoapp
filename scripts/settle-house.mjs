// Settle a house question (law, GTA ...) once its date has passed.   node scripts/settle-house.mjs --list
//                                                                    node scripts/settle-house.mjs house:law-ma-q8 yes|no
// It writes the same fact the admin button writes; the resolver pays the bets on its next minute. Unsettled questions are refunded at their deadline.
import { supabaseUrl } from "./lib-env.mjs";

const SB = supabaseUrl(), KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const [a, b] = process.argv.slice(2);
const due = async (series) => {
  const q = `kind=eq.tick_gt&status=eq.open&target_at=lte.${new Date().toISOString()}&params->>series=${series ? `eq.${encodeURIComponent(series)}` : "like.house:law-*"}&select=id,target_at,deadline_at,params`;
  return (await (await fetch(`${SB}/rest/v1/markets?${q}`, { headers: H })).json());
};
if (a === "--list" || !a) {
  for (const m of await due()) console.log(m.params.series, "|", m.params.q?.it ?? "", "| target", m.target_at, "| refund at", m.deadline_at);
} else {
  if (b !== "yes" && b !== "no") { console.error("say yes or no"); process.exit(1); }
  const [m] = await due(a);
  if (!m) { console.error("no open question for that series whose date has passed"); process.exit(1); }
  const r = await fetch(`${SB}/rest/v1/tick_observations?on_conflict=series,at`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ series: a, at: m.target_at, value: b === "yes" ? 1 : 0, fetched_at: new Date().toISOString() }) });
  console.log(r.status, r.ok ? `settled ${a} = ${b}` : await r.text());
}
