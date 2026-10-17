import { X } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { sb } from "../lib/api.ts";
import type { Messages } from "../i18n/index.ts";

const KEY = "promo.halloween";
const read = (): boolean => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };

/** Home announcement for the Halloween challenges: avatars with frames in the back, the badges in front. It only shows once the event is published. */
export function HalloweenBanner({ msg, onOpen }: { msg: Messages; onOpen: () => void }) {
  const [gone, setGone] = useState(read);
  const [on, setOn] = useState(false);
  useEffect(() => { let live = true; sb.rpc("halloween_status").then(({ data }) => { if (live) setOn((data as { published?: boolean } | null)?.published === true); }); return () => { live = false; }; }, []);
  if (gone || !on) return null;
  const h = msg.halloween;
  const close = (e: Event) => { e.stopPropagation(); try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ } setGone(true); };
  return (
    <div class="promowrap">
      <div class="promo" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(); }}>
        <img src="/promo-halloween.webp" alt="" width={1200} height={520} loading="lazy" decoding="async" />
        <div class="promotxt"><b>{h.promoTitle}</b><span>{h.promoSub}</span></div>
        <button class="promox" onClick={close} aria-label={h.promoClose}><X size={16} /></button>
      </div>
    </div>
  );
}
