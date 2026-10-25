import { Component, type ComponentChildren } from "preact";

const WORDS: Record<string, [string, string, string]> = {
  it: ["Qualcosa non ha funzionato", "Ricarica la pagina: i tuoi dati sono al sicuro.", "Ricarica"],
  ja: ["問題が発生しました", "ページを再読み込みしてください。データは安全です。", "再読み込み"],
  en: ["Something went wrong", "Reload the page: your data is safe.", "Reload"],
};
const lang = (): string => { const l = (typeof document !== "undefined" ? document.documentElement.lang : "") || (typeof navigator !== "undefined" ? navigator.language : ""); return /^it/i.test(l) ? "it" : /^ja/i.test(l) ? "ja" : "en"; };

/** Last line of defence: a screen that crashes shows a calm reload card instead of a blank page. */
export class Boundary extends Component<{ children: ComponentChildren }, { failed: boolean }> {
  state = { failed: false };
  componentDidCatch(e: unknown) { console.error("screen crashed", e); this.setState({ failed: true }); }
  render() {
    if (!this.state.failed) return this.props.children;
    const [h, b, r] = WORDS[lang()]!;
    return (
      <div role="alert" style="min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center;font-family:system-ui,sans-serif">
        <div style="max-width:360px"><h1 style="font-size:var(--fs-xl);margin:0 0 8px">{h}</h1><p style="margin:0 0 16px;opacity:.75">{b}</p><button class="btn primary" onClick={() => location.reload()}>{r}</button></div>
      </div>
    );
  }
}
