import { createClient } from "@supabase/supabase-js";

export const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export interface Profile { id: string; credits: number; city_id: string; locale: string; timezone: string }

/** Best-effort country from the edge (Cloudflare Pages function); never blocks start-up. */
export async function fetchCountry(): Promise<string | null> {
  try {
    const r = await fetch("/api/geo", { signal: AbortSignal.timeout(1200) });
    if (!r.ok) return null;
    return ((await r.json()) as { country: string | null }).country;
  } catch {
    return null;
  }
}

export async function ensureGuest(): Promise<string | null> {
  const { data } = await sb.auth.getSession();
  if (data.session) return data.session.user.id;
  const res = await sb.auth.signInAnonymously();
  return res.data.user?.id ?? null;
}
