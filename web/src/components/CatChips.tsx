import { Car } from "lucide-preact";
import { BusSide, CloudRainGhost, TrainSide, TreeGhost } from "./Vehicles.tsx";
import { useState } from "preact/hooks";

export type CatId = "bus" | "train" | "weather" | "nature" | "traffic";
export interface CatTile { id: CatId; label: string; count: number; disabled?: boolean }

/** The chip's picture: big, see-through, filling most of the chip. */
function Art({ id }: { id: CatId }) {
  if (id === "bus") return <BusSide size={44} class="gh gh-veh" />;
  if (id === "train") return <TrainSide size={32} class="gh gh-veh" />;
  if (id === "weather") return <CloudRainGhost />;
  if (id === "nature") return <TreeGhost />;
  return <Car size={44} strokeWidth={1.6} class="gh" />;
}

/** Category chips. Each picture plays one short scene when hovered or tapped (the vehicle drives through, rain falls, leaves blow) and then rests. */
export function CatChips({ tiles, value, onPick }: { tiles: CatTile[]; value: CatId; onPick: (id: CatId) => void }) {
  const [popId, setPopId] = useState<CatId | null>(null);
  return (
    <div class="catchips" role="tablist">
      {tiles.map((t) => {
        const on = value === t.id;
        return (
          <button key={t.id} role="tab" aria-selected={on} disabled={t.disabled} class={`cc ${t.id} ${on ? "on" : ""} ${popId === t.id ? "pop" : ""}`} onClick={() => { setPopId(null); requestAnimationFrame(() => setPopId(t.id)); setTimeout(() => setPopId((x) => (x === t.id ? null : x)), 2600); onPick(t.id); }}>
            <span class="ghost"><Art id={t.id} /></span>
            <span class="lbl">{t.label}</span>
            {t.count > 0 && <em>{t.count}</em>}
          </button>
        );
      })}
    </div>
  );
}
