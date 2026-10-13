// Team strengths for the European competitions, from the ESPN public standings (unofficial, personal non-commercial use, same as the live scores).
// The free TheSportsDB tier lists only 3 matches a day, so its stored results are too thin for the Champions League clubs: the standings give every club's
// games, goals for and goals against in one call. Pure parsing and matching; the fetching is in the Edge Function.
import type { TableRow } from "./sport.ts";

/** Standings path (under /apis/v2/sports/soccer/) of every league whose clubs may play in the UEFA competitions, with how its goals compare to the big five (1). */
export const FORM_SOURCES: { slug: string; tier: number }[] = [
  { slug: "eng.1", tier: 1 }, { slug: "esp.1", tier: 1 }, { slug: "ger.1", tier: 1 }, { slug: "ita.1", tier: 1 }, { slug: "fra.1", tier: 1 },
  { slug: "ned.1", tier: 0.88 }, { slug: "por.1", tier: 0.88 }, { slug: "bel.1", tier: 0.85 }, { slug: "tur.1", tier: 0.85 }, { slug: "sco.1", tier: 0.82 },
  { slug: "gre.1", tier: 0.82 }, { slug: "aut.1", tier: 0.82 }, { slug: "den.1", tier: 0.8 }, { slug: "nor.1", tier: 0.8 }, { slug: "swe.1", tier: 0.8 }, { slug: "isr.1", tier: 0.78 }, { slug: "cyp.1", tier: 0.75 },
];
/** The UEFA competition's own standings (the league phase), counted at full weight. */
export const UEFA_SLUG: Record<string, string> = { "Champions League": "uefa.champions", "Europa League": "uefa.europa", "Conference League": "uefa.europa.conf" };

const STOP = new Set(["fc", "cf", "ac", "as", "sc", "us", "ssc", "afc", "calcio", "club", "the", "de", "la", "le", "ud", "cd", "sd", "rc", "ca", "and", "sk", "fk", "bk", "if", "ik", "sv", "fsv", "vfb", "vfl", "tsg", "rb"]);
/** Spellings that differ completely between the two sources. */
const ALIAS: Record<string, string> = { internazionale: "inter milan", "inter": "inter milan", "paris saint germain": "paris saint germain", psg: "paris saint germain", "sporting": "sporting cp", "sporting lisbon": "sporting cp", "man city": "manchester city", "man united": "manchester united", "manchester utd": "manchester united", "bayer leverkusen": "bayer leverkusen", "atletico": "atletico madrid" };
const norm = (s: string) => {
  const t = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((x) => x && !STOP.has(x)).join(" ");
  return ALIAS[t] ?? t;
};

/** The row of a club in a table: the same name, or a name that is a whole-word part of the other ("Napoli" / "SSC Napoli", never "Real Madrid" / "Real Sociedad"). Null when unknown or ambiguous. */
export function findRow(name: string, rows: readonly TableRow[]): TableRow | null {
  const n = norm(name);
  if (!n) return null;
  const exact = rows.filter((r) => norm(r.team) === n);
  if (exact.length === 1) return exact[0]!;
  if (exact.length > 1) return null;
  const nt = n.split(" ");
  const part = rows.filter((r) => { const rt = norm(r.team).split(" "); const [s, l] = nt.length <= rt.length ? [nt, rt] : [rt, nt]; return s.length >= 1 && s.every((t) => l.includes(t)) && (s.length >= 2 || s[0]!.length >= 5); });
  return part.length === 1 ? part[0]! : null;
}

type Standings = { children?: { standings?: { entries?: { team?: { displayName?: string; name?: string }; stats?: { name?: string; value?: number }[] }[] } }[] };
/** A standings answer as table rows (every group of it). */
export function parseEspnTable(j: unknown): TableRow[] {
  const out: TableRow[] = [];
  for (const c of (j as Standings)?.children ?? []) for (const e of c.standings?.entries ?? []) {
    const s = (k: string) => Number(e.stats?.find((x) => x.name === k)?.value);
    const team = e.team?.displayName ?? e.team?.name ?? "";
    const row = { team, played: s("gamesPlayed"), points: s("points"), goalsFor: s("pointsFor"), goalsAgainst: s("pointsAgainst") };
    if (team && [row.played, row.goalsFor, row.goalsAgainst].every((x) => Number.isFinite(x) && x >= 0)) out.push({ ...row, points: Number.isFinite(row.points) ? row.points : 0 });
  }
  return out;
}

/** One table renamed to the spellings of the fixtures (every row stays; the ones that are not in `names` keep their own name). */
export function alignNames(table: readonly TableRow[], names: readonly string[]): TableRow[] {
  const rename = new Map<TableRow, string>();
  for (const n of names) { const r = findRow(n, table); if (r) rename.set(r, n); }
  return table.map((r) => ({ ...r, team: rename.get(r) ?? r.team }));
}

/**
 * The form of each named club from several tables at once (its own competition and its domestic league): games and goals added up, goals of the
 * weaker leagues scaled by their tier (a goal against a weaker league is worth less). Clubs found in no table are left out.
 */
export function mergeForm(names: readonly string[], tables: readonly { rows: readonly TableRow[]; tier: number }[]): TableRow[] {
  const out: TableRow[] = [];
  for (const name of new Set(names)) {
    const sum: TableRow = { team: name, played: 0, points: 0, goalsFor: 0, goalsAgainst: 0 };
    for (const t of tables) {
      const r = findRow(name, t.rows);
      if (!r) continue;
      sum.played += r.played; sum.points += r.points; sum.goalsFor += r.goalsFor * t.tier; sum.goalsAgainst += r.goalsAgainst / t.tier;
    }
    if (sum.played > 0) out.push(sum);
  }
  return out;
}
