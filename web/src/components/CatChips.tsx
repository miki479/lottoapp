import { Car } from "lucide-preact";
import { BusSide, CloudRainSide, TrainSide } from "./Vehicles.tsx";
import { useState } from "preact/hooks";

export type CatId = "bus" | "train" | "weather" | "traffic";
export interface CatTile { id: CatId; label: string; count: number; disabled?: boolean }
const ICON = { bus: BusSide, train: TrainSide, weather: CloudRainSide, traffic: Car } as const;

/** Category chips. The picked one plays a short scene: the bus pulls in, the train passes, rain falls. */
export function CatChips({ tiles, value, onPick }: { tiles: CatTile[]; value: CatId; onPick: (id: CatId) => void }) {
  const [burst, setBurst] = useState(0);
  const [popId, setPopId] = useState<CatId | null>(null);
  return (
    <div class="catchips" role="tablist">
      {tiles.map((t) => {
        const Icon = ICON[t.id], on = value === t.id;
        return (
          <button key={t.id} role="tab" aria-selected={on} disabled={t.disabled} class={`cc ${t.id} ${on ? "on" : ""} ${popId === t.id ? "pop" : ""}`} onClick={() => { setBurst((b) => b + 1); setPopId(t.id); setTimeout(() => setPopId((x) => (x === t.id ? null : x)), 1200); onPick(t.id); }}>
            <span class="ico">
              <Icon size={t.id === "train" ? 13 : t.id === "bus" ? 14 : t.id === "weather" ? 20 : 24} strokeWidth={2} />
              {t.id === "train" && <span class="trail" />}
              {t.id === "weather" && <span class="drops"><i /><i /><i /></span>}
            </span>
            <span>{t.label}</span>
            {t.count > 0 && <em>{t.count}</em>}
          </button>
        );
      })}
    </div>
  );
}
