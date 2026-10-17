import { Bell, ExternalLink, Globe, X } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";

const NEW_HOST = "latebet.it", OLD_HOSTS = ["latelotto.web.app", "latelotto.firebaseapp.com"], KEY = "dom-banner";
type Line = { old: string; fresh: string; go: string; close: string };
const T: Record<string, Line> = {
  it: { old: "LateBet ha un nuovo indirizzo: latebet.it. Passa lì e riaccetta le notifiche, altrimenti non ti arrivano più.", fresh: "Benvenuto su latebet.it! Il nostro indirizzo è cambiato: riaccetta le notifiche quando te lo chiediamo.", go: "Vai a latebet.it", close: "Chiudi" },
  "en-US": { old: "LateBet has a new address: latebet.it. Switch over and accept notifications again, or they will stop reaching you.", fresh: "Welcome to latebet.it! Our address changed: accept notifications again when we ask.", go: "Go to latebet.it", close: "Close" },
  "en-GB": { old: "LateBet has a new address: latebet.it. Switch over and accept notifications again, or they will stop reaching you.", fresh: "Welcome to latebet.it! Our address changed: accept notifications again when we ask.", go: "Go to latebet.it", close: "Close" },
  ja: { old: "LateBetの新しいアドレスは latebet.it です。移動して、通知をもう一度許可してください。そうしないと通知が届かなくなります。", fresh: "latebet.it へようこそ！アドレスが変わりました。お願いしたときに、通知をもう一度許可してください。", go: "latebet.it へ移動", close: "閉じる" },
};
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* private mode */ } };

/**
 * The address changed: on the old address it says so (with the link only once the new address answers with a valid certificate), on the new one it welcomes the player and
 * reminds them that notifications belong to an address, so they have to be accepted again. Closed for good with the cross.
 */
export function DomainBanner({ locale }: { locale: string }) {
  const host = location.hostname.replace(/^www\./, ""), isOld = OLD_HOSTS.includes(host), isNew = host === NEW_HOST;
  const [open, setOpen] = useState(() => (isOld || isNew) && !read()), [ready, setReady] = useState(false);
  useEffect(() => {
    if (!open || !isOld) return;
    let live = true;
    // a certificate that is not ready yet makes the request fail: the link then stays hidden instead of sending people to a warning page
    fetch(`https://${NEW_HOST}/manifest.webmanifest`, { mode: "no-cors", cache: "no-store" }).then(() => live && setReady(true), () => {});
    return () => { live = false; };
  }, [open, isOld]);
  if (!open) return null;
  const t = T[locale] ?? T["en-US"]!;
  return (
    <div class="domainbar" role="status">
      <span class="dbi">{isOld ? <Globe size={20} aria-hidden="true" /> : <Bell size={20} aria-hidden="true" />}</span>
      <p>{isOld ? t.old : t.fresh}</p>
      {isOld && ready && <a class="btn primary" href={`https://${NEW_HOST}/`}><ExternalLink size={16} aria-hidden="true" />{t.go}</a>}
      <button type="button" class="iconbtn" aria-label={t.close} title={t.close} onClick={() => { write(); setOpen(false); }}><X size={18} /></button>
    </div>
  );
}
