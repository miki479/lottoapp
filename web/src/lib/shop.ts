import { useEffect, useState } from "preact/hooks";
import type { ItemKind, PackRarity } from "../../../shared/shop.ts";
import { sb } from "./api.ts";

/** What public.daily_bonus() returns (migration 0107). */
export interface DailyState {
  day: string; streak: number; freezes: number; counted: boolean; claimed: boolean; ready: boolean;
  eff_streak: number; cycle_day: number; amount: number; uses_freeze: boolean; lapsed: boolean; amounts: number[];
}
export interface AlbumItem { kind: ItemKind; id: string; rarity: PackRarity; owned: boolean; copies: number }
/** What public.my_album() returns. */
export interface AlbumData { items: AlbumItem[]; owned: number; total: number; registered: boolean; opened_today: number; daily_cap: number; spent: number; refunded: number }
/** What public.buy_pack() returns. */
export interface PackOpen { id: string; tier: number; price: number; kind: ItemKind; item: string; rarity: PackRarity; duplicate: boolean; refund: number; balance: number; opened_today: number; daily_cap: number }

/** Fired after anything in the Rewards sheet changed credits or the daily claim, so the header dot and wallet can refresh. */
export const HUB_EVENT = "ll-rewards";
const changed = () => { try { dispatchEvent(new Event(HUB_EVENT)); } catch { /* no window */ } };

/** The code the server raised ("insufficient_credits", "pack_limit" ...), or "generic". */
export const errorCode = (message: string | undefined, known: readonly string[]): string => known.find((k) => (message ?? "").includes(k)) ?? "generic";

export async function loadDaily(): Promise<DailyState | null> {
  const { data, error } = await sb.rpc("daily_bonus");
  return error || !data ? null : (data as DailyState);
}
export async function claimDaily(): Promise<{ credits: number; already: boolean; balance: number } | { error: string }> {
  const { data, error } = await sb.rpc("claim_daily_bonus");
  if (error) return { error: error.message };
  changed();
  return data as { credits: number; already: boolean; balance: number };
}
export async function loadAlbum(): Promise<AlbumData | null> {
  const { data, error } = await sb.rpc("my_album");
  return error || !data ? null : (data as AlbumData);
}
export async function buyPack(tier: number): Promise<PackOpen | { error: string }> {
  const { data, error } = await sb.rpc("buy_pack", { p_tier: tier });
  if (error) return { error: error.message };
  changed();
  return data as PackOpen;
}
export interface SupplyBought { item: string; price: number; balance: number; boosts: number; freezes: number }
export async function buySupply(item: string): Promise<SupplyBought | { error: string }> {
  const { data, error } = await sb.rpc("buy_supply", { p_item: item });
  if (error) return { error: error.message };
  changed();
  return data as SupplyBought;
}
export async function buyLimitBreak(): Promise<{ balance: number; until: string; next: string } | { error: string }> {
  const { data, error } = await sb.rpc("buy_limit_break");
  if (error) return { error: error.message };
  changed();
  return data as { balance: number; until: string; next: string };
}
/** Avatars the player can wear: the free ones, the won ones and the one worn now. */
export async function loadMyAvatars(): Promise<string[] | null> {
  const { data, error } = await sb.rpc("my_avatars");
  return error || !Array.isArray(data) ? null : (data as string[]);
}

/** True while today's daily bonus can be collected (a bet counted today and it is not claimed yet): feeds the dot on the wallet. */
export function useDailyReady(profile: { id: string; streak: number; last_play_date: string | null } | null): boolean {
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => { const f = () => setTick((n) => n + 1); addEventListener(HUB_EVENT, f); return () => removeEventListener(HUB_EVENT, f); }, []);
  const key = profile ? `${profile.id}|${profile.streak}|${profile.last_play_date ?? ""}` : "";
  useEffect(() => {
    if (!key) { setReady(false); return; }
    let live = true;
    loadDaily().then((d) => { if (live) setReady(!!d?.ready); });
    return () => { live = false; };
  }, [key, tick]);
  return ready;
}

const PENDING_KEY = "ll-pack-pending";
/** A bought pack that was not opened yet survives closing the sheet (the item is already in the album, only the reveal waits). */
export const pending = {
  get(): PackOpen | null { try { const v = localStorage.getItem(PENDING_KEY); const p = v ? (JSON.parse(v) as PackOpen) : null; return p && typeof p.item === "string" && typeof p.tier === "number" ? p : null; } catch { return null; } },
  set(p: PackOpen) { try { localStorage.setItem(PENDING_KEY, JSON.stringify(p)); } catch { /* storage blocked */ } },
  clear() { try { localStorage.removeItem(PENDING_KEY); } catch { /* storage blocked */ } },
};
