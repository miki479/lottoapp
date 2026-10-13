import { useEffect, useState } from "preact/hooks";
import { sb } from "./api.ts";

export interface MyProgress { granted?: string[]; xp: number; level: number; avatar: string; decoration: string | null; owned: string[] }
export interface LookInfo { avatar: string; decoration: string | null; level: number }
export interface PublicProfileData {
  id: string; name: string | null; avatar: string; decoration: string | null; level: number; streak: number; best_streak: number; best_win: number; month_wins: number;
  trophies: string[]; trophy_count: number; hidden: number; balance: number | null; relation: "me" | "friends" | "sent" | "received" | "none";
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
let version = 0;
/** Ids already asked for, so someone the server returns nothing for is not asked again in a loop. */
const asked = new Set<string>();
const subs = new Set<(v: number) => void>();
const changed = () => { version++; subs.forEach((f) => f(version)); };
/** Avatars of the people in a list, fetched once and remembered; a change anywhere (own look saved, a profile opened) refreshes every list. */
export function useLooks(ids: string[]): Record<string, LookInfo> {
  const [v, setV] = useState(version);
  useEffect(() => { subs.add(setV); return () => { subs.delete(setV); }; }, []);
  const key = ids.join();
  useEffect(() => {
    const need = ids.filter((i) => !cache.has(i) && !asked.has(i));
    if (need.length === 0) return;
    need.forEach((i) => asked.add(i));
    let live = true;
    sb.rpc("looks", { ids: need }).then(({ data }) => {
      for (const r of (data ?? []) as { user_id: string; avatar: string; decoration: string | null; level: number }[]) cache.set(r.user_id, { avatar: r.avatar, decoration: r.decoration, level: r.level });
      if (live) setV((n) => n + 1);
    });
    return () => { live = false; };
  }, [key, v]);
  return Object.fromEntries(ids.filter((i) => cache.has(i)).map((i) => [i, cache.get(i)!]));
}
/** The look of someone changed (their own save): drop it and let every list fetch it again. */
export const forgetLook = (id: string) => { cache.delete(id); asked.delete(id); changed(); };
/** A fresh look is known (a profile was just opened): keep it for the lists instead of dropping it. */
export const rememberLook = (id: string, l: LookInfo) => { cache.set(id, l); changed(); };
