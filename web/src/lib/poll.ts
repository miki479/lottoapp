/**
 * Runs `fn` every `ms` while the page is visible. Nothing runs in a background tab; when the player comes back the work is done at once
 * if it has been due, so the screen is fresh without hammering the server. Returns the cleanup function.
 */
export function every(fn: () => void, ms: number): () => void {
  let last = Date.now();
  const tick = () => { if (document.visibilityState === "visible") { last = Date.now(); fn(); } };
  const id = setInterval(tick, ms);
  const onVis = () => { if (document.visibilityState === "visible" && Date.now() - last >= ms) tick(); };
  document.addEventListener("visibilitychange", onVis);
  return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
}
