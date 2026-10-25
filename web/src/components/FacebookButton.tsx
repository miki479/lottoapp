import { useFacebookOn } from "../lib/providers.ts";

/** "Continue with Facebook": shown only when the server has the provider switched on. */
export function FacebookButton({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  if (!useFacebookOn()) return null;
  return (
    <button class="btn secondary wide" disabled={busy} aria-busy={busy} onClick={onClick}>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.900 11.900v-8.400H7.100V12h3V9.400c0-3 1.800-4.700 4.500-4.700 1.300 0 2.700.2 2.700.2v3h-1.500c-1.500 0-2 .9-2 1.900V12h3.400l-.5 3.500h-2.800v8.400A12 12 0 0 0 24 12z" /></svg>{label}
    </button>
  );
}
