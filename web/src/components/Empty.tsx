import type { LucideIcon } from "lucide-preact";

/** Empty state: what is missing, and what to do about it. */
export function Empty({ icon: Icon, title, body, cta, onCta }: { icon: LucideIcon; title: string; body: string; cta?: string; onCta?: () => void }) {
  return (
    <div class="empty">
      <span class="eic"><Icon size={26} /></span>
      <h3>{title}</h3><p>{body}</p>
      {cta && <button class="btn primary" onClick={onCta}>{cta}</button>}
    </div>
  );
}
