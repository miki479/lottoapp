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
