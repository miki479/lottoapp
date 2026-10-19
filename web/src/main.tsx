import { render } from "preact";
import { loadMessages } from "./i18n/index.ts";
import { pickLocale } from "./lib/detect.ts";
import { Boundary } from "./components/Boundary.tsx";
import { UpdateBar } from "./components/UpdateBar.tsx";
import type { Locale } from "./i18n/index.ts";
import "./tokens.css";
import "./app.css";

const loc = (() => { try { return localStorage.getItem("locale") ?? navigator.language; } catch { return navigator.language; } })();
const start = (): Locale => { try { const s = localStorage.getItem("locale"); if (s === "it" || s === "en-US" || s === "en-GB" || s === "ja") return s; } catch { /* storage unavailable */ } return pickLocale(navigator.languages ?? [navigator.language]); };
// the language in use is loaded first (one small chunk), then the app draws
// the app code and the language in use are fetched at the same time
if (location.pathname.replace(/\/$/, "") === "/ritardi") {
  void import("./views/Ritardi.tsx").then(({ Ritardi }) => render(<Boundary><Ritardi /></Boundary>, document.getElementById("app")!));
} else
void Promise.all([import("./App.tsx"), loadMessages(start()).catch(() => loadMessages("en-US"))]).then(([{ App }]) => render(<Boundary><App /><UpdateBar locale={/^it/i.test(loc) ? "it" : /^ja/i.test(loc) ? "ja" : /^en-GB/i.test(loc) ? "en-GB" : "en-US"} /></Boundary>, document.getElementById("app")!)).catch(() => { document.getElementById("app")!.innerHTML = '<p style="padding:24px;font-family:system-ui,sans-serif">LateBet: connessione assente o aggiornamento in corso. <a href="/">Riprova</a></p>'; });
// after a new version a tab that is still open may ask for a file that no longer exists: one automatic reload fixes it
addEventListener("vite:preloadError", () => { try { if (sessionStorage.getItem("ll-reloaded") === "1") return; sessionStorage.setItem("ll-reloaded", "1"); } catch { /* storage unavailable */ } location.reload(); });

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

// A button tapped again within a third of a second is ignored: fast repeated taps would only pile requests on the server.
const lastTap = new WeakMap<Element, number>();
addEventListener("click", (e) => {
  const b = (e.target as Element | null)?.closest?.("button, [role=button], a");
  if (!b || b.closest("[data-repeat]")) return;
  const t = e.timeStamp, prev = lastTap.get(b);
  lastTap.set(b, t);
  if (prev !== undefined && t - prev < 350) { e.stopImmediatePropagation(); e.preventDefault(); }
}, true);
