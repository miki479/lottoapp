import { createClient } from "@supabase/supabase-js";

export const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/**
 * Calls that change something (a bet, a claim, a purchase…) are never sent twice at once: a second identical call made while the first is
 * still on its way (a double tap, a slow network) gets the same answer instead of a second request to the server.
 */
const CHANGES = /^(place_|claim_|buy_|open_|create_|cancel_|respond_|request_|remove_|set_|join_|vote_|pick_|resolve_|resolve|redeem_|invite_|delete_|toggle_|report_|register_|decline_|read_)/;
const inflight = new Map<string, Promise<unknown>>();
const rpcRaw = sb.rpc.bind(sb) as (fn: string, args?: object, opts?: object) => PromiseLike<unknown>;
(sb as unknown as { rpc: typeof rpcRaw }).rpc = (fn, args, opts) => {
  if (!CHANGES.test(fn)) return rpcRaw(fn, args, opts);
  const key = `${fn}:${JSON.stringify(args ?? {})}`, hit = inflight.get(key);
  if (hit) return hit;
  const run = Promise.resolve(rpcRaw(fn, args, opts)).finally(() => inflight.delete(key));
  inflight.set(key, run);
  return run;
};

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
