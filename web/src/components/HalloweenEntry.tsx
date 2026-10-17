import { ChevronRight } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { sb } from "../lib/api.ts";
import type { Messages } from "../i18n/index.ts";
import { HalloweenLogo } from "./HalloweenLogo.tsx";
import { HalloweenSheet } from "./HalloweenSheet.tsx";

/** The Halloween row under the daily missions: greyed out until the event starts, then it opens the event page. Hidden while the event is a draft. */
export function HalloweenEntry({ msg, now }: { msg: Messages; now: number }) {
  const [ev, setEv] = useState<{ published?: boolean; starts_at?: string | null } | null>(null), [open, setOpen] = useState(false);
  useEffect(() => { let live = true; sb.rpc("halloween_status").then(({ data }) => { if (live && data) setEv(data as { published?: boolean; starts_at?: string | null }); }); return () => { live = false; }; }, []);
  if (!ev?.published) return null;
  const h = msg.halloween, start = ev.starts_at ? Date.parse(ev.starts_at) : NaN, locked = !(start <= now);
  const date = Number.isFinite(start) ? new Date(start).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
  return (
    <>
      <button class={`hwentry ${locked ? "locked" : ""}`} aria-disabled={locked} onClick={() => { if (!locked) setOpen(true); }}>
        <HalloweenLogo size={40} />
        <span class="hwentrytx"><b>{h.title}</b><small>{locked ? h.soonFrom.replace("{date}", date) : h.entrySub}</small></span>
        {!locked && <ChevronRight size={20} />}
      </button>
      {open && <HalloweenSheet msg={msg} onClose={() => setOpen(false)} />}
    </>
  );
}
