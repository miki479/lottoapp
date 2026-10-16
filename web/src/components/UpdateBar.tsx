import { RefreshCw } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";

const T: Record<string, [string, string]> = {
  it: ["Nuova versione pronta", "Aggiorna"], "en-US": ["New version ready", "Update"], "en-GB": ["New version ready", "Update"], ja: ["新しいバージョンがあります", "更新"],
};
const mainScript = (html: string): string | null => html.match(/<script[^>]+type="module"[^>]+src="([^"]*\/assets\/[^"]+)"/)?.[1] ?? null;

/** A phone keeps the app alive in memory for days: now and then (and when it comes back to the front) compare the page the server serves with the one running, and offer a one-tap refresh. */
export function UpdateBar({ locale }: { locale: string }) {
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    const cur = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')?.getAttribute("src");
    if (!cur || !import.meta.env.PROD) return;
    let live = true, last = 0;
    const check = async () => {
      if (Date.now() - last < 60_000) return; last = Date.now();
      try {
        const r = await fetch(`/?u=${Date.now()}`, { cache: "no-store" });
        const next = mainScript(await r.text());
        if (live && next && next !== cur) setFresh(true);
      } catch { /* offline: try again later */ }
    };
    const vis = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", vis);
    const t = window.setInterval(check, 10 * 60_000); void check();
    return () => { live = false; document.removeEventListener("visibilitychange", vis); clearInterval(t); };
  }, []);
  if (!fresh) return null;
  const [msg, btn] = T[locale] ?? T["en-US"]!;
  return <button class="updatebar" onClick={() => location.reload()}><RefreshCw size={16} /><span>{msg}</span><b>{btn}</b></button>;
}
