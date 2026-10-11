import { render } from "preact";
import { App } from "./App.tsx";
import "./fonts.css";
import "./styles.css";

render(<App />, document.getElementById("app")!);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
