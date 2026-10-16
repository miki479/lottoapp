import { BarChart3, ChevronDown } from "lucide-preact";
import { useRef, useState } from "preact/hooks";
import type { Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";

interface Stats { total: number; located: number; yes_pct: number | null; towns: { name: string; n: number; yes_pct: number; km: number }[]; bands: { label: string; n: number; yes_pct: number }[] }

/** Expandable "area statistics" of a local question: the share of Yes by town and by distance, groups under 3 people hidden by the server. */
export function AreaStats({ marketId, msg }: { marketId: string; msg: Messages }) {
  const n = msg.nearby;
  const [open, setOpen] = useState(false), [st, setSt] = useState<Stats | null | undefined>(undefined);
  const asked = useRef(false);
  const toggle = async () => {
    const next = !open; setOpen(next);
    if (next && !asked.current) {
      asked.current = true; setSt(undefined);
      try { const { data, error } = await sb.rpc("market_area_stats", { p_market: marketId }); if (error) throw error; setSt((data as Stats | null) ?? null); } catch { asked.current = false; setSt(null); }
    }
  };
  const bar = (label: string, pct: number, count: number, extra?: string) => (
    <div class="asrow" key={label}><span class="aslbl">{label}{extra && <small>{extra}</small>}</span><span class="asbar"><i style={`width:${pct}%`} /></span><b class="num">{pct}% {n.yes}</b><small class="num">{count}</small></div>
  );
  return (
    <div class="areastats">
      <button class="asbtn" onClick={toggle} aria-expanded={open}><BarChart3 size={16} />{n.statsTitle}<ChevronDown size={16} class={open ? "up" : ""} /></button>
      {open && <div class="asbody">
        <p class="hint">{n.statsIntro}</p>
        {st === undefined && <div class="sk" />}
        {st === null && <p class="formerr" role="alert">{msg.errors.generic}</p>}
        {st && st.yes_pct === null && <p class="hint">{n.notEnough}</p>}
        {st && st.yes_pct !== null && bar(`${st.total} ${n.people}`, st.yes_pct, st.total)}
        {st && st.towns.length > 0 && <><span class="detail">{n.towns}</span>{st.towns.map((t) => bar(t.name, t.yes_pct, t.n, `${t.km} ${n.km}`))}</>}
        {st && st.bands.length > 0 && <><span class="detail">{n.bands}</span>{st.bands.map((b) => bar(`${b.label} ${n.km}`, b.yes_pct, b.n))}</>}
      </div>}
    </div>
  );
}
