/** Tiny clock mascot: the hands tick, the whole thing wiggles now and then. */
export function Mascot({ size = 34 }: { size?: number }) {
  return (
    <svg class="mascot" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="34" r="22" fill="#0e1017" stroke="#f0ff3a" stroke-width="5" />
      <rect x="27" y="6" width="10" height="6" rx="2" fill="#f0ff3a" />
      <circle cx="12" cy="14" r="6" fill="#ff2d95" /><circle cx="52" cy="14" r="6" fill="#ff2d95" />
      <g class="hand-m" style="transform-origin:32px 34px"><rect x="30.5" y="20" width="3" height="15" rx="1.5" fill="#f2ede0" /></g>
      <g class="hand-h" style="transform-origin:32px 34px"><rect x="30.5" y="26" width="3" height="9" rx="1.5" fill="#2ef5b4" /></g>
      <circle cx="32" cy="34" r="2.6" fill="#f0ff3a" />
      <circle cx="23" cy="45" r="1.6" fill="#ff4d62" /><circle cx="41" cy="45" r="1.6" fill="#ff4d62" />
    </svg>
  );
}

export const Icon = {
  events: <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>,
  missions: <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>,
  ranking: <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></svg>,
  mine: <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z" /><path d="M14 7v12" stroke-dasharray="2 3" /></svg>,
  gift: <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M5 12v9h14v-9M12 8S11 3 8 3a2.5 2.5 0 0 0 0 5zm0 0s1-5 4-5a2.5 2.5 0 0 1 0 5z" /></svg>,
};
