import { X } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { sb } from "../lib/api.ts";
import type { Messages } from "../i18n/index.ts";
import { HalloweenLogo } from "./HalloweenLogo.tsx";
import { HalloweenSheet } from "./HalloweenSheet.tsx";

const KEY = "promo.halloween";
const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
const read = (): boolean => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };

/** Home announcement for the Halloween challenges: avatars with frames in the back, the badges in front. It only shows once the event is published. */
export function HalloweenBanner({ msg }: { msg: Messages }) {
  const [open, setOpen] = useState(false), onOpen = () => setOpen(true);
  const [gone, setGone] = useState(read);
  const [on, setOn] = useState(false);
  const [when, setWhen] = useState("");
  useEffect(() => { let live = true; sb.rpc("halloween_status").then(({ data }) => { if (!live) return; const d = data as { published?: boolean; starts_at?: string | null; ends_at?: string | null } | null; setOn(d?.published === true); if (d?.starts_at && d.ends_at) setWhen(`${fmt(new Date(d.starts_at))}–${fmt(new Date(+new Date(d.ends_at) - 60_000))}`); }); return () => { live = false; }; }, []);
  if (gone || !on) return null;
  const h = msg.halloween;
  const close = (e: Event) => { e.stopPropagation(); try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ } setGone(true); };
  return (
    <div class="promowrap">
      <div class="promo" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(); }}>
        <img src="/promo-halloween.webp" alt="" width={1200} height={520} loading="lazy" decoding="async" />
        <div class="promotxt"><b class="promologo"><HalloweenLogo size={22} />{h.promoTitle}</b><span>{h.promoSub}</span>{when && <strong class="promodate">{when}</strong>}</div>
        <button class="promox" onClick={close} aria-label={h.promoClose}><X size={16} /></button>
      </div>
      {open && <HalloweenSheet msg={msg} onClose={() => setOpen(false)} />}
    </div>
  );
}
