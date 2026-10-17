/**
 * Runs `fn` every `ms` while the page is visible. Nothing runs in a background tab; when the player comes back the work is done at once
 * if it has been due, so the screen is fresh without hammering the server. Returns the cleanup function.
 */
export function every(fn: () => void, wanted: number): () => void {
  const ms = Math.max(wanted, MIN_MS); // nothing asks the server more often than every 30 seconds
  let last = Date.now();
  // a page left open and untouched for five minutes stops asking the server; the first touch brings it back, up to date
  const tick = () => { if (document.visibilityState === "visible" && Date.now() - lastTouch < IDLE_MS) { last = Date.now(); fn(); } };
  const id = setInterval(tick, ms);
  const catchUp = () => { if (document.visibilityState === "visible" && Date.now() - last >= ms) { last = Date.now(); fn(); } };
  const onTouch = () => { lastTouch = Date.now(); catchUp(); };
  document.addEventListener("visibilitychange", catchUp);
  for (const e of TOUCH) document.addEventListener(e, onTouch, { passive: true });
  return () => { clearInterval(id); document.removeEventListener("visibilitychange", catchUp); for (const e of TOUCH) document.removeEventListener(e, onTouch); };
}
const MIN_MS = 30_000, IDLE_MS = 5 * 60_000, TOUCH = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
let lastTouch = Date.now();
