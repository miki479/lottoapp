import { useEffect, useState } from "preact/hooks";
import { sb } from "./api.ts";

export interface MyProgress { xp: number; level: number; avatar: string; decoration: string | null; owned: string[] }
export interface LookInfo { avatar: string; decoration: string | null; level: number }
export interface PublicProfileData {
  id: string; name: string | null; avatar: string; decoration: string | null; level: number; streak: number; best_streak: number; best_win: number; month_wins: number;
  trophies: string[]; trophy_count: number; balance: number | null; relation: "me" | "friends" | "sent" | "received" | "none";
}

export async function loadMyProgress(): Promise<MyProgress | null> {
  const { data, error } = await sb.rpc("my_progress");
  return error || !data ? null : (data as MyProgress);
}
export async function saveLook(avatar: string, decoration: string | null): Promise<boolean> {
  const { error } = await sb.rpc("set_look", { p_avatar: avatar, p_decoration: decoration });
  return !error;
}
export async function loadPublicProfile(id: string): Promise<PublicProfileData | null> {
  const { data } = await sb.rpc("public_profile", { p_user: id });
  return (data as PublicProfileData | null) ?? null;
}

const cache = new Map<string, LookInfo>();
/** Avatars of the people in a list, fetched once and remembered. */
export function useLooks(ids: string[]): Record<string, LookInfo> {
  const [, bump] = useState(0);
  const key = ids.join();
  useEffect(() => {
    const need = ids.filter((i) => !cache.has(i));
    if (need.length === 0) return;
    let live = true;
    sb.rpc("looks", { ids: need }).then(({ data }) => {
      for (const r of (data ?? []) as { user_id: string; avatar: string; decoration: string | null; level: number }[]) cache.set(r.user_id, { avatar: r.avatar, decoration: r.decoration, level: r.level });
      if (live) bump((n) => n + 1);
    });
    return () => { live = false; };
  }, [key]);
  return Object.fromEntries(ids.filter((i) => cache.has(i)).map((i) => [i, cache.get(i)!]));
}
export const forgetLook = (id: string) => cache.delete(id);
