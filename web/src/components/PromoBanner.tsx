import { Bell, X } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Messages } from "../i18n/index.ts";

const KEY = "promo.pictures";
const read = (): boolean => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };

/**
 * A picture ad for the home page: profile pictures in the back, new trophies in front, the text laid over it. It can be dismissed for good,
 * and a push opens the app right on it (`reopen` changes): then it comes back if it was closed and scrolls into view.
 * While notifications are off it carries a reminder to turn them on.
 */
export function PromoBanner({ msg, onOpen, pushOff, onPush, reopen }: { msg: Messages; onOpen: () => void; pushOff: boolean; onPush: () => void; reopen: number }) {
  const [gone, setGone] = useState(read);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!reopen) return;
    try { localStorage.removeItem(KEY); } catch { /* private mode */ }
    setGone(false);
    setTimeout(() => root.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 350);
  }, [reopen]);
  if (gone) return null;
  const close = (e: Event) => { e.stopPropagation(); try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ } setGone(true); };
  return (
    <div class="promowrap" ref={root}>
      <div class="promo" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(); }}>
        <img src="/promo-new.webp" alt="" width={1200} height={520} loading="lazy" decoding="async" />
        <div class="promotxt"><b>{msg.home.promo.title}</b><span>{msg.home.promo.sale}</span></div>
        <button class="promox" onClick={close} aria-label={msg.home.promo.close}><X size={16} /></button>
      </div>
      {pushOff && <div class="promopush"><Bell size={18} /><span>{msg.home.promo.push}</span><button class="btn primary" onClick={onPush}>{msg.home.promo.pushBtn}</button></div>}
    </div>
  );
}
