// One-off: stores the finished matches of the season so far (TheSportsDB free tier, one call per league and day)
// so that team strengths do not start from zero. The hourly ingest keeps the table current afterwards.
//   SUPABASE_ACCESS_TOKEN=... SUPABASE_URL=<ref> node scripts/backfill-form.mjs [fromDate] [toDate]
import { projectRef } from "./lib-env.mjs";

const LEAGUES = [["4332", "Serie A"], ["4394", "Serie B"], ["5340", "Serie C - A"], ["5339", "Serie C - B"], ["5341", "Serie C - C"], ["4387", "NBA"], ["4546", "EuroLeague"], ["4380", "NHL"], ["4391", "NFL"], ["4424", "MLB"], ["4328", "Premier League"], ["4335", "La Liga"], ["4331", "Bundesliga"], ["4334", "Ligue 1"], ["4480", "Champions League"], ["4481", "Europa League"], ["5071", "Conference League"], ["4337", "Eredivisie"], ["4344", "Primeira Liga"], ["4330", "Scottish Premiership"]];
// NB: the free TheSportsDB tier returns only 3 matches per day per league, so this stores a sample; the European strengths used for pricing come from the ESPN standings (shared/form.ts).
const ONLY = process.env.ONLY?.split(",");
const from = new Date(`${process.argv[2] ?? "2026-08-15"}T00:00:00Z`), to = new Date(`${process.argv[3] ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`);
const FINISHED = new Set(["FT", "AET", "PEN", "Match Finished"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = async (query) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef()}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
};
let rows = [], calls = 0;
for (const [id, name] of LEAGUES.filter(([, n]) => !ONLY || ONLY.includes(n))) {
  for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 86400_000)) {
    const day = d.toISOString().slice(0, 10);
    let evs = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      try { const r = await fetch(`https://www.thesportsdb.com/api/v1/json/${process.env.SPORTSDB_KEY || "3"}/eventsday.php?d=${day}&l=${id}`); if (r.status === 429) { await sleep(20000); continue; } evs = (await r.json()).events ?? []; break; } catch { await sleep(3000); }
    }
    calls++; await sleep(2300);
    for (const e of evs) {
      const k = Date.parse(`${e.strTimestamp}Z`);
      if (e.idEvent && e.strHomeTeam && e.strAwayTeam && Number.isFinite(k) && FINISHED.has(e.strStatus) && e.intHomeScore !== null && e.intAwayScore !== null)
        rows.push({ event_id: e.idEvent, league: name, season: e.strSeason ?? "", kickoff: new Date(k).toISOString(), home: e.strHomeTeam, away: e.strAwayTeam, hg: Number(e.intHomeScore), ag: Number(e.intAwayScore), api_id: e.idAPIfootball ?? null });
    }
    if (rows.length >= 40) { await sql(`insert into public.team_form select * from jsonb_populate_recordset(null::public.team_form, $j$${JSON.stringify(rows)}$j$::jsonb) on conflict (event_id) do nothing`); rows = []; }
  }
  console.log(`${name} done (${calls} calls)`);
}
if (rows.length) await sql(`insert into public.team_form select * from jsonb_populate_recordset(null::public.team_form, $j$${JSON.stringify(rows)}$j$::jsonb) on conflict (event_id) do nothing`);
console.log("finished");
