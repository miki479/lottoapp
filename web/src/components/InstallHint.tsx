import { Download, X } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import type { Locale } from "../i18n/index.ts";
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

const T: Record<string, { title: string; ios: string; android: string; btn: string; why: string; later: string }> = {
  it: { title: "Installa l'app", ios: "Tocca Condividi, poi «Aggiungi alla schermata Home».", android: "Dal menu del browser scegli «Installa app» o «Aggiungi a schermata Home».", btn: "Installa", why: "Si apre più veloce e ricevi gli avvisi.", later: "Chiudi" },
  "en-US": { title: "Install the app", ios: "Tap Share, then “Add to Home Screen”.", android: "From the browser menu choose “Install app” or “Add to Home screen”.", btn: "Install", why: "It opens faster and you get the alerts.", later: "Close" },
  "en-GB": { title: "Install the app", ios: "Tap Share, then “Add to Home Screen”.", android: "From the browser menu choose “Install app” or “Add to Home screen”.", btn: "Install", why: "It opens faster and you get the alerts.", later: "Close" },
  ja: { title: "アプリをインストール", ios: "共有をタップして「ホーム画面に追加」を選びます。", android: "ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選びます。", btn: "インストール", why: "起動が速く、通知も届きます。", later: "閉じる" },
};
interface InstallEvent extends Event { prompt: () => Promise<void> }
let deferred: InstallEvent | null = null;
if (typeof window !== "undefined") window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallEvent; });

/** True when the page runs as the installed app (home-screen icon) rather than in a browser tab. */
export const isInstalled = (): boolean => {
  try { return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true; } catch { return false; }
};

/** A small, closable hint to put the app on the home screen: only shown in a browser tab on a phone, and not again for a week once closed. */
export function InstallHint({ locale, invited = false }: { locale: Locale; invited?: boolean }) {
  const [shown, setShown] = useState(false);
  const [can, setCan] = useState(false);
  useEffect(() => {
    const phone = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const until = Number(store.get("install_hint") ?? 0);
    setShown(phone && !isInstalled() && (invited || Date.now() > until));
    const f = () => setCan(!!deferred);
    f(); window.addEventListener("beforeinstallprompt", f);
    return () => window.removeEventListener("beforeinstallprompt", f);
  }, [invited]);
  if (!shown) return null;
  const t = T[locale] ?? T["en-US"]!, ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const close = () => { store.set("install_hint", String(Date.now() + 7 * 864e5)); setShown(false); };
  const install = async () => { if (!deferred) return; await deferred.prompt(); deferred = null; setCan(false); close(); };
  return (
    <section class="installhint" role="note">
      <Download size={20} />
      <span class="ihtxt"><b>{t.title}</b><small>{ios ? t.ios : t.android} {t.why}</small></span>
      {can && <button class="btn primary ihbtn" onClick={install}>{t.btn}</button>}
      <button class="iconbtn" onClick={close} aria-label={t.later}><X size={18} /></button>
    </section>
  );
}
