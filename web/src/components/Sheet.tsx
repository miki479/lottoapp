import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";

/** Bottom sheet on phones, centred dialog on larger screens. Closes on Escape and on outside tap. */
export function Sheet({ onClose, label, children }: { onClose: () => void; label: string; children: ComponentChildren }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", key); document.body.style.overflow = ""; };
  }, []);
  return (
    <div class="scrim" onClick={onClose}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div class="grab" />
        {children}
      </div>
    </div>
  );
}
