/** The TV series a player follows ("Le mie serie"), kept on this device. */
export interface FollowedShow { id: number; name: string }
const KEY = "series.followed";
export function followedShows(): FollowedShow[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v.filter((s) => Number.isInteger(s?.id) && typeof s?.name === "string").slice(0, 30) : []; } catch { return []; }
}
export function setFollowed(list: FollowedShow[]) { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30))); } catch { /* private mode */ } }

const BASE = "https://api.tvmaze.com";
export interface ShowHit { id: number; name: string; year: string; status: string }
export async function searchShows(q: string, signal?: AbortSignal): Promise<ShowHit[]> {
  const r = await fetch(`${BASE}/search/shows?q=${encodeURIComponent(q)}`, { signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return ((await r.json()) as { show: { id: number; name: string; premiered?: string | null; status?: string } }[]).slice(0, 8).map((x) => ({ id: x.show.id, name: x.show.name, year: (x.show.premiered ?? "").slice(0, 4), status: x.show.status ?? "" }));
}
export interface EpisodeHit { id: number; season: number; number: number; name: string; airstamp: string }
/** Episodes aired in the last two days or airing in the next three weeks (the window the server accepts). */
export async function episodesWindow(showId: number, signal?: AbortSignal): Promise<EpisodeHit[]> {
  const r = await fetch(`${BASE}/shows/${showId}/episodes`, { signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const now = Date.now();
  return ((await r.json()) as { id: number; season: number; number: number | null; name: string; airstamp: string | null }[])
    .filter((e) => e.airstamp && Date.parse(e.airstamp) > now - 2 * 86400_000 + 3600_000 && Date.parse(e.airstamp) < now + 21 * 86400_000 - 3600_000)
    .map((e) => ({ id: e.id, season: e.season, number: e.number ?? 0, name: e.name, airstamp: e.airstamp! })).slice(0, 8);
}
