import { createClient } from "@supabase/supabase-js";

export const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});


/**
 * Returns the current user id, creating a guest when there is none.
 * A stored session whose user no longer exists on the server (deleted account, reset database) is dropped and replaced.
 */
export async function ensureGuest(): Promise<string | null> {
  const { data } = await sb.auth.getSession();
  if (data.session) {
    const { error } = await sb.auth.getUser();
    const gone = error && (error.status === 401 || error.status === 403 || error.status === 404 || /does not exist|user_not_found|bad_jwt/i.test(`${error.code ?? ""} ${error.message}`));
    if (!gone) return data.session.user.id;
    await sb.auth.signOut({ scope: "local" });
  }
  const res = await sb.auth.signInAnonymously();
  return res.data.user?.id ?? null;
}

/** Set by the app: true when the current guest already played (bets to keep), so Google must be linked instead of replacing the guest. */
export const guestState = { hasProgress: false };

/**
 * Google sign-in. A guest who has not played yet simply signs in (works for new and returning Google users);
 * a guest with bets links Google to the same account so nothing is lost.
 */
export function googleSignIn() {
  const opts = { provider: "google" as const, options: { redirectTo: location.origin } };
  return guestState.hasProgress ? sb.auth.linkIdentity(opts) : sb.auth.signInWithOAuth(opts);
}
