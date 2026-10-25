import { useEffect, useState } from "preact/hooks";

/** Which extra sign-in providers the server has switched on (read from its public settings): a button appears only when its provider works. */
let facebook = false;
const subs = new Set<(v: boolean) => void>();
export const setFacebookOn = (v: boolean) => { facebook = v; subs.forEach((f) => f(v)); };
export function useFacebookOn(): boolean {
  const [v, setV] = useState(facebook);
  useEffect(() => { subs.add(setV); setV(facebook); return () => { subs.delete(setV); }; }, []);
  return v;
}
