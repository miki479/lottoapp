import { X } from "lucide-preact";
import { useState } from "preact/hooks";
import type { Messages } from "../i18n/index.ts";

const KEY = "promo.pictures";
const read = (): boolean => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };

/** A picture ad for the featured row: profile pictures in the back, new trophies in front, the text laid over it. It can be dismissed for good. */
export function PromoBanner({ msg, onOpen }: { msg: Messages; onOpen: () => void }) {
  const [gone, setGone] = useState(read);
  if (gone) return null;
  const close = (e: Event) => { e.stopPropagation(); try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ } setGone(true); };
  return (
    <div class="promo" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(); }}>
      <img src="/promo-new.webp" alt="" width={1200} height={520} loading="lazy" decoding="async" />
      <div class="promotxt"><b>{msg.home.promo.title}</b><span>{msg.home.promo.sub}</span></div>
      <button class="promox" onClick={close} aria-label={msg.home.promo.close}><X size={16} /></button>
    </div>
  );
}
