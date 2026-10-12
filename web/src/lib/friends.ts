import { sb } from "./api.ts";

export interface FriendRow { rank: number; user_id: string; display_name: string | null; score: number; bets: number; streak: number; is_me: boolean; since: string | null }

/** Me and my friends, ranked by this month's score (friends without bets included). */
export async function loadFriends(): Promise<FriendRow[]> {
  const { data } = await sb.rpc("friends_board");
  return ((data ?? []) as FriendRow[]).map((r) => ({ ...r, rank: Number(r.rank), score: Number(r.score), bets: Number(r.bets) }));
}
