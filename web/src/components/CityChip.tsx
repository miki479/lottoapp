import { MapPin, Plus } from "lucide-preact";
import { useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import type { Place } from "../lib/places.ts";
import { Flag } from "./Flag.tsx";
import { HomePlaceField } from "./HomePlaceField.tsx";
import { Sheet } from "./Sheet.tsx";

/** Small pill under the name: the optional home town with its flag. Tapping it opens the search. */
export function CityChip(p: { msg: Messages; locale: Locale; value: Place | null; onChange: (pl: Place | null) => void }) {
  const [open, setOpen] = useState(false);
  const n = p.msg.nearby;
  return (
    <>
      <button class={`citychip ${p.value ? "set" : ""}`} onClick={() => setOpen(true)} aria-label={n.home}>
        {p.value ? <><Flag cc={p.value.country} size={13} /><span>{p.value.name}</span></> : <><MapPin size={13} /><span>{n.home}</span><Plus size={13} /></>}
      </button>
      {open && (
        <Sheet onClose={() => setOpen(false)} label={n.home}>
          <HomePlaceField msg={p.msg} locale={p.locale} value={p.value} onChange={(pl) => { p.onChange(pl); if (pl) setOpen(false); }} />
        </Sheet>
      )}
    </>
  );
}
