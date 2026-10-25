/**
 * One answer for everybody who asks the same thing: while a result is younger than `ttl` it is returned as it is, and while it is being fetched every other caller
 * waits for the same request. Several cards, sheets and screens that need the same data cost one request, not one each.
 */
const store = new Map<string, { at: number; p: Promise<unknown> }>();
export function memo<T>(key: string, ttl: number, fn: () => PromiseLike<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.p as Promise<T>;
  const p = Promise.resolve(fn()).catch((e) => { if (store.get(key)?.p === p) store.delete(key); throw e; });
  store.set(key, { at: Date.now(), p });
  if (store.size > 300) for (const [k, v] of store) if (Date.now() - v.at > ttl) store.delete(k);
  return p;
}
/** Forget answers whose key starts with `prefix` (after something changed on purpose, e.g. a bet was placed). */
export function forget(prefix: string): void { for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k); }
