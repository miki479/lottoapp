import { GoTrueClient } from "@supabase/auth-js";
import { PostgrestClient } from "@supabase/postgrest-js";

/**
 * Every request gets a 25 s limit (a hung connection must not leave a button spinning for ever), and a read that fails because the network dropped is tried once more.
 * Calls that change something are never repeated: they could be applied twice.
 */
const robustFetch: typeof fetch = async (input, init) => {
  const method = String(init?.method ?? (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();
  const reads = method === "GET" || method === "HEAD";
  for (let attempt = 1; ; attempt++) {
    const ctl = typeof AbortController === "function" ? new AbortController() : null, timer = ctl ? setTimeout(() => ctl.abort(), 25_000) : 0;
    try {
      return await fetch(input, ctl && !init?.signal ? { ...init, signal: ctl.signal } : init);
    } catch (e) {
      if (!reads || attempt >= 2 || (e as Error)?.name === "AbortError" && init?.signal?.aborted) throw e;
      await new Promise((r) => setTimeout(r, 400));
    } finally { clearTimeout(timer); }
  }
};
const URL_ = import.meta.env.VITE_SUPABASE_URL as string, KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/** The same read asked twice while the first is still on its way (several parts of the page need the same thing at start) is one request, answered to both. */
const sharing = new Map<string, Promise<Response>>();
const readsOnly = (method: string, url: string, body: unknown): boolean => {
  if (method === "GET" || method === "HEAD") return true;
  if (method !== "POST" || typeof body !== "string") return false;
  const fn = /\/rest\/v1\/rpc\/([a-z0-9_]+)/.exec(url)?.[1];
  return !!fn && !CHANGES.test(fn);
};
const shared: typeof fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url, method = String(init?.method ?? "GET").toUpperCase();
  if (init?.signal || !readsOnly(method, url, init?.body)) return robustFetch(input, init);
  const h = new Headers(init?.headers), key = `${method} ${url} ${h.get("authorization") ?? ""} ${String(init?.body ?? "")}`, hit = sharing.get(key);
  if (hit) return hit.then((r) => r.clone());
  const run = robustFetch(input, init);
  sharing.set(key, run);
  const done = () => { sharing.delete(key); };
  run.then(done, done);
  return run.then((r) => r.clone());
};

// Only what the app uses: sign-in (auth), table and function calls (postgrest). The full supabase-js client also carries realtime and storage code that is never run.
const auth = new GoTrueClient({
  url: `${URL_}/auth/v1`, headers: { Authorization: `Bearer ${KEY}`, apikey: KEY },
  storageKey: `sb-${new globalThis.URL(URL_).hostname.split(".")[0]}-auth-token`,
  persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, fetch: robustFetch,
});
const token = async (): Promise<string> => (await auth.getSession()).data.session?.access_token ?? KEY;
const authed: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers);
  if (!headers.has("apikey")) headers.set("apikey", KEY);
  if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${await token()}`);
  return shared(input, { ...init, headers });
};
const rest = new PostgrestClient<any, any>(`${URL_}/rest/v1`, { fetch: authed });

/** Calls an edge function: `{ data, error }`, where a failed answer keeps its response in `error.context` (what the callers read the error code from). */
async function invoke(name: string, opts: { body?: unknown } = {}): Promise<{ data: any; error: (Error & { context?: Response }) | null }> {
  try {
    const res = await robustFetch(`${URL_}/functions/v1/${name}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" }, body: JSON.stringify(opts.body ?? {}) });
    if (!res.ok) return { data: null, error: Object.assign(new Error(`Edge Function returned a non-2xx status code (${res.status})`), { context: res }) };
    const type = res.headers.get("content-type") ?? "";
    return { data: type.includes("application/json") ? await res.json() : await res.text(), error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export const sb = { auth, from: rest.from.bind(rest), rpc: rest.rpc.bind(rest), functions: { invoke } };

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

/** Facebook sign-in, same rules as Google (a guest with bets keeps the account by linking). */
export function facebookSignIn() {
  const opts = { provider: "facebook" as const, options: { redirectTo: location.origin, scopes: "email" } };
  return guestState.hasProgress ? sb.auth.linkIdentity(opts) : sb.auth.signInWithOAuth(opts);
}

/** After a sign-in the address bar must not keep the long token the provider sent back: once the session is taken, strip it (the other parameters stay). */
const SECRET = ["access_token", "refresh_token", "provider_token", "provider_refresh_token", "token_type", "expires_in", "expires_at", "type", "code"];
function cleanUrl(): void {
  try {
    const u = new URL(location.href), h = new URLSearchParams(u.hash.replace(/^#/, ""));
    let changed = false;
    if (h.has("access_token") || h.has("refresh_token")) { u.hash = ""; changed = true; }
    for (const k of SECRET) if (u.searchParams.has(k) && (k !== "type" || u.searchParams.has("code"))) { u.searchParams.delete(k); changed = true; }
    if (changed) history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
  } catch { /* nothing to clean */ }
}
sb.auth.onAuthStateChange((event) => { if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") setTimeout(cleanUrl, 0); });
setTimeout(cleanUrl, 2500);

/**
 * The e-mail was confirmed in another browser or mail app: this one still holds the guest session. Ask the server who this account is now and, when it has become
 * a registered one, take a fresh session so the app sees it at once. Returns true when that happened.
 */
export async function syncRegistration(): Promise<boolean> {
  const { data } = await sb.auth.getUser();
  const u = data.user;
  if (!u) return false;
  const { data: cur } = await sb.auth.getSession();
  if (!cur.session?.user.is_anonymous || u.is_anonymous || !u.email) return false;
  const { error } = await sb.auth.refreshSession();
  return !error;
}
export const pendingConfirm = {
  mark: () => { try { localStorage.setItem("pend-confirm", String(Date.now())); } catch { /* private mode */ } },
  active: () => { try { return Date.now() - Number(localStorage.getItem("pend-confirm") ?? 0) < 30 * 60_000; } catch { return false; } },
  clear: () => { try { localStorage.removeItem("pend-confirm"); } catch { /* private mode */ } },
};
