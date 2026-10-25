// TV series from TVmaze (no key; data CC BY-SA, credit TVmaze): episode ratings are the thing bets are about.
const BASE = "https://api.tvmaze.com";
const UA = { "User-Agent": "LateLotto/0.1 (satirical fake-credit game; https://latebet.it)" };

export interface TvEpisode { id: number; season: number; number: number; airstamp: string | null; rating: number | null; name: string }

async function get(path: string) {
  const r = await fetch(`${BASE}${path}`, { headers: UA, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`TVmaze HTTP ${r.status}`);
  return await r.json();
}

const ep = (e: { id: number; season: number; number: number; airstamp?: string | null; rating?: { average?: number | null } | null; name?: string }): TvEpisode =>
  ({ id: e.id, season: e.season, number: e.number ?? 0, airstamp: e.airstamp ?? null, rating: typeof e.rating?.average === "number" ? e.rating.average : null, name: e.name ?? "" });

/** One episode with its show (name, id) from TVmaze. */
export async function tvEpisode(id: number): Promise<{ episode: TvEpisode; showId: number; showName: string; language: string } | null> {
  try {
    const j = await get(`/episodes/${id}?embed=show`);
    const s = j?._embedded?.show;
    if (!j?.id || !s?.id) return null;
    return { episode: ep(j), showId: s.id, showName: String(s.name), language: String(s.language ?? "") };
  } catch { return null; }
}

/** The rating TVmaze shows for an episode right now (null until enough votes). */
export async function tvRating(id: number): Promise<number | null> {
  try { const j = await get(`/episodes/${id}`); const v = j?.rating?.average; return typeof v === "number" && v > 0 && v <= 10 ? v : null; } catch { return null; }
}

/**
 * What a new episode of this show is likely to score: the mean of the ratings of the last three rated episodes before it (at least two needed).
 * Null when there are too few ratings to say.
 */
export async function tvReference(showId: number, beforeAirstamp: string): Promise<number | null> {
  try {
    const all = ((await get(`/shows/${showId}/episodes`)) as Parameters<typeof ep>[0][]).map(ep);
    const before = all.filter((e) => e.airstamp && e.airstamp < beforeAirstamp && e.rating !== null).sort((a, b) => (a.airstamp! < b.airstamp! ? 1 : -1)).slice(0, 3);
    if (before.length < 2) return null;
    return before.reduce((a, e) => a + e.rating!, 0) / before.length;
  } catch { return null; }
}

/** English or Italian shows with a good audience that air in the next days (broadcast US/GB and web schedules). */
export async function tvUpcoming(days: number, now: number): Promise<{ showId: number; showName: string; episode: TvEpisode; weight: number }[]> {
  const out = new Map<number, { showId: number; showName: string; episode: TvEpisode; weight: number }>();
  for (let d = 0; d < days; d++) {
    const day = new Date((now + d * 86400) * 1000).toISOString().slice(0, 10);
    for (const path of [`/schedule?country=US&date=${day}`, `/schedule/web?date=${day}`, `/schedule?country=GB&date=${day}`]) {
      try {
        for (const e of (await get(path)) as { id: number; season: number; number: number; airstamp: string; name: string; show?: Record<string, unknown>; _embedded?: { show?: Record<string, unknown> } }[]) {
          const s = (e.show ?? e._embedded?.show) as { id: number; name: string; language?: string; weight?: number; rating?: { average?: number | null } } | undefined;
          if (!s || !["English", "Italian"].includes(String(s.language)) || (s.weight ?? 0) < 85 || typeof s.rating?.average !== "number" || !e.airstamp) continue;
          if (Date.parse(e.airstamp) / 1000 < now + 3600) continue;
          const cur = out.get(s.id);
          if (!cur || e.airstamp < cur.episode.airstamp!) out.set(s.id, { showId: s.id, showName: s.name, episode: ep(e), weight: s.weight ?? 0 });
        }
      } catch { /* a schedule that cannot be read is just skipped */ }
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return [...out.values()].sort((a, b) => b.weight - a.weight);
}
