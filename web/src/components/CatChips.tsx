import { CloudRain, Car } from "lucide-preact";
import { BusSide, TrainSide } from "./Vehicles.tsx";
import { useState } from "preact/hooks";

export type CatId = "bus" | "train" | "weather" | "traffic";
export interface CatTile { id: CatId; label: string; count: number; disabled?: boolean }
const ICON = { bus: BusSide, train: TrainSide, weather: CloudRain, traffic: Car } as const;

/** Category chips. The picked one plays a short scene: the bus pulls in, the train passes, rain falls. */
export function CatChips({ tiles, value, onPick }: { tiles: CatTile[]; value: CatId; onPick: (id: CatId) => void }) {
  const [burst, setBurst] = useState(0);
  return (
    <div class="catchips" role="tablist">
      {tiles.map((t) => {
        const Icon = ICON[t.id], on = value === t.id;
        return (
          <button key={t.id} role="tab" aria-selected={on} disabled={t.disabled} class={`cc ${t.id} ${on ? "on" : ""}`} onClick={() => { setBurst((b) => b + 1); onPick(t.id); }}>
            <span class="ico" key={on ? `on${burst}` : "off"}>
              <Icon size={24} strokeWidth={2} />
              {on && t.id === "train" && <span class="trail" />}
              {on && t.id === "weather" && <span class="drops"><i /><i /><i /></span>}
            </span>
            <span>{t.label}</span>
            {t.count > 0 && <em>{t.count}</em>}
          </button>
        );
      })}
    </div>
  );
}
