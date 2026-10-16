import { render } from "preact";
import { App } from "./App.tsx";
import { UpdateBar } from "./components/UpdateBar.tsx";
import "./tokens.css";
import "./app.css";

const loc = (() => { try { return localStorage.getItem("locale") ?? navigator.language; } catch { return navigator.language; } })();
render(<><App /><UpdateBar locale={/^it/i.test(loc) ? "it" : /^ja/i.test(loc) ? "ja" : /^en-GB/i.test(loc) ? "en-GB" : "en-US"} /></>, document.getElementById("app")!);

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
