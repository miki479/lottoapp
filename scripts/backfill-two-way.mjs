// Adds the total-points and handicap lines to the open matches of the sports without a draw (made before those bets existed).
//   node scripts/backfill-two-way.mjs [--apply]
import { LEAGUES, tableFromResults, twoWayPriors } from "../shared/sport.ts";
import { supabaseUrl } from "./lib-env.mjs";

const SB = supabaseUrl(), KEY = process.env.SUPABASE_SERVICE_ROLE_KEY, apply = process.argv.includes("--apply");
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" };
const rest = async (path, init = {}) => { const r = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } }); if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`); return init.method === "PATCH" ? null : r.json(); };
const two = LEAGUES.filter((l) => l.two);
let done = 0;
for (const lg of two) {
  const rows = await rest(`team_form?select=season,home,away,hg,ag&league=eq.${encodeURIComponent(lg.name)}&order=kickoff.desc&limit=600`);
  const table = rows.length ? tableFromResults(rows.filter((r) => r.season === rows[0].season)) : [];
  const by = new Map(table.map((r) => [r.team, r]));
  const ms = await rest(`markets?select=id,params&kind=eq.match_bet&status=eq.open&params->>league=eq.${encodeURIComponent(lg.name)}&limit=500`);
  for (const m of ms) {
    const pr = m.params.priors ?? {};
    if (Object.keys(pr).some((k) => k.startsWith("tot:"))) continue;
    const fresh = twoWayPriors(by.get(m.params.home), by.get(m.params.away), lg.two);
    const add = Object.fromEntries(Object.entries(fresh).filter(([k]) => k.startsWith("tot:") || k.startsWith("mrg:")));
    done++;
    if (apply) await rest(`markets?id=eq.${m.id}`, { method: "PATCH", body: JSON.stringify({ params: { ...m.params, priors: { ...pr, ...add } } }) });
    else if (done <= 3) console.log(lg.name, m.params.home, m.params.away, add);
  }
}
console.log(apply ? "updated" : "would update", done, "markets");
