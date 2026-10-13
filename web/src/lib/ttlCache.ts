/**
 * A small answer cache: the same key asked again within `ttlMs` gets the stored answer, callers that ask while the request is still on its
 * way share it, and a failure is never kept. `get(key, true)` skips the stored answer. Keeps the last 100 keys.
 */
export function createTtlCache<V>(ttlMs: number, fetcher: (key: string) => Promise<V>, clock: () => number = Date.now) {
  const done = new Map<string, { at: number; v: V }>(), inflight = new Map<string, Promise<V>>();
  const fresh = (key: string) => { const hit = done.get(key); return hit && clock() - hit.at < ttlMs ? hit : undefined; };
  return {
    /** The stored answer if it is still fresh, without asking. */
    peek(key: string): V | undefined { return fresh(key)?.v; },
    get(key: string, force = false): Promise<V> {
      const hit = force ? undefined : fresh(key);
      if (hit) return Promise.resolve(hit.v);
      const pending = inflight.get(key);
      if (pending) return pending;
      const p = fetcher(key).then((v) => {
        done.delete(key); done.set(key, { at: clock(), v });
        if (done.size > 100) done.delete(done.keys().next().value as string);
        return v;
      }).finally(() => { inflight.delete(key); });
      inflight.set(key, p);
      return p;
    },
  };
}
