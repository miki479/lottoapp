import { useEffect, useState } from "preact/hooks";
import { sb } from "../lib/api.ts";
import type { Locale, Messages } from "../i18n/index.ts";
import { HalloweenLogo } from "./HalloweenLogo.tsx";
import { HalloweenSheet } from "./HalloweenSheet.tsx";

const UNITS: Record<string, [string, string, string]> = { it: ["g", "h", "m"], ja: ["日", "時間", "分"] };
/** "3d 5h", "5h 12m", "12m": the short time left, in the language's own letters. */
function left(ms: number, locale: Locale): string {
  const [d, h, m] = UNITS[locale.slice(0, 2)] ?? ["d", "h", "m"], min = Math.max(1, Math.ceil(ms / 60_000));
  if (min >= 1440) return `${Math.floor(min / 1440)}${d} ${Math.floor((min % 1440) / 60)}${h}`;
  if (min >= 60) return `${Math.floor(min / 60)}${h} ${min % 60}${m}`;
  return `${min}${m}`;
}

/** The Halloween icon in the top bar with a small countdown under it (to the start, then to the end): greyed out until the event starts, then it opens the event page. Hidden while the event is a draft. */
export function HalloweenHeaderBtn({ msg, locale }: { msg: Messages; locale: Locale }) {
  const [ev, setEv] = useState<{ published?: boolean; starts_at?: string | null; ends_at?: string | null } | null>(null), [open, setOpen] = useState(false), [now, setNow] = useState(Date.now());
  useEffect(() => { let live = true; sb.rpc("halloween_status").then(({ data }) => { if (live && data) setEv(data as { published?: boolean; starts_at?: string | null; ends_at?: string | null }); }); return () => { live = false; }; }, []);
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);
  if (!ev?.published) return null;
  const start = ev.starts_at ? Date.parse(ev.starts_at) : NaN, end = ev.ends_at ? Date.parse(ev.ends_at) : NaN, locked = !(start <= now);
  if (!locked && Number.isFinite(end) && end <= now) return null;
  const date = Number.isFinite(start) ? new Date(start).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
  const label = locked ? `${msg.halloween.title} · ${msg.halloween.soonFrom.replace("{date}", date)}` : msg.halloween.title;
  const target = locked ? start : end, count = Number.isFinite(target) ? left(target - now, locale) : "";
  return (
    <>
      <button class={`iconbtn hwhdr ${locked ? "locked" : ""}`} aria-label={label} title={label} aria-disabled={locked} onClick={() => { if (!locked) setOpen(true); }}>
        <HalloweenLogo size={22} bare />
        {count && <small class="hwcount num" aria-hidden="true">{count}</small>}
      </button>
      {open && <HalloweenSheet msg={msg} onClose={() => setOpen(false)} />}
    </>
  );
}
