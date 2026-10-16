import { useState } from "preact/hooks";
import { ChevronDown } from "lucide-preact";
import { STEAM } from "../../../shared/ticks.ts";
import type { ComponentChildren } from "preact";

/** One video game, many questions: a single folded row with the Steam cover and the number of questions; it opens on tap. */
export function GameGroup({ appid, count, children }: { appid: string; count: number; children: ComponentChildren }) {
  const [open, setOpen] = useState(false);
  const [noImg, setNoImg] = useState(false);
  return (
    <section class={`gamegrp ${open ? "open" : ""}`} style="grid-column:1/-1">
      <button class="gghead" aria-expanded={open} onClick={() => setOpen(!open)}>
        {noImg ? <span class="ggimg ph" /> : <img class="ggimg" src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`} alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onError={() => setNoImg(true)} />}
        <b>{STEAM[appid as keyof typeof STEAM] ?? appid}</b>
        <em>{count}</em>
        <ChevronDown size={18} />
      </button>
      {open && <div class="ggbody cardgrid">{children}</div>}
    </section>
  );
}
