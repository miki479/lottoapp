import { ChevronDown } from "lucide-preact";
import { useState } from "preact/hooks";

/** A section that folds away to its title (the choice is remembered), so long lists do not push everything else out of view. */
export function Collapse(p: { id: string; title: string; count?: number; open?: boolean; children: preact.ComponentChildren; class?: string }) {
  const key = `fold.${p.id}`;
  const [open, setOpen] = useState(() => { try { const v = localStorage.getItem(key); return v === null ? p.open !== false : v === "1"; } catch { return p.open !== false; } });
  const toggle = () => { const n = !open; setOpen(n); try { localStorage.setItem(key, n ? "1" : "0"); } catch { /* private mode */ } };
  return (
    <section class={`stack collapse ${open ? "open" : ""} ${p.class ?? ""}`}>
      <button class="colhead" aria-expanded={open} onClick={toggle}><h2>{p.title}</h2>{p.count !== undefined && <em>{p.count}</em>}<ChevronDown size={18} /></button>
      {open && <div class="colbody stack">{p.children}</div>}
    </section>
  );
}
