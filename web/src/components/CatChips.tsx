import { BusGhost, CloudRainGhost, CryptoGhost, CultureGhost, GovGhost, SportGhost, StrikeGhost, TrafficGhost, TrainGhost, TreeGhost } from "./Vehicles.tsx";
import { LawGhost } from "./Cannabis.tsx";
import { useState } from "preact/hooks";

export type CatId = "bus" | "train" | "weather" | "nature" | "strike" | "traffic" | "finance" | "culture" | "sport" | "law" | "gov";
export interface CatTile { id: CatId; label: string; count: number; disabled?: boolean; soon?: string }

/** The chip's picture: big, see-through, filling most of the chip. */
function Art({ id }: { id: CatId }) {
  if (id === "bus") return <BusGhost />;
  if (id === "train") return <TrainGhost />;
  if (id === "weather") return <CloudRainGhost />;
  if (id === "nature") return <TreeGhost />;
  if (id === "strike") return <StrikeGhost />;
  if (id === "finance") return <CryptoGhost />;
  if (id === "culture") return <CultureGhost />;
  if (id === "sport") return <SportGhost />;
  if (id === "law") return <LawGhost />;
  if (id === "gov") return <GovGhost />;
  return <TrafficGhost />;
}

/** Category chips. Each picture plays one short scene when hovered or tapped (the vehicle drives through, rain falls, leaves blow) and then rests. */
export function CatChips({ tiles, value, onPick, baseCols }: { tiles: CatTile[]; value: CatId; onPick: (id: CatId) => void; baseCols?: number }) {
  const [popId, setPopId] = useState<CatId | null>(null);
  return (
    <div class={`catchips ${(baseCols ?? tiles.length) > 5 ? "many" : ""}`} role="tablist" style={`--n:${tiles.length};--dn:${baseCols ?? tiles.length}`}>
      {tiles.map((t) => {
        const on = value === t.id;
        return (
          <button key={t.id} role="tab" aria-selected={on} disabled={t.disabled} class={`cc ${t.id} ${on ? "on" : ""} ${popId === t.id ? "play" : ""}`} onClick={() => { setPopId(null); requestAnimationFrame(() => setPopId(t.id)); setTimeout(() => setPopId((x) => (x === t.id ? null : x)), 2600); onPick(t.id); }}>
            <span class="ghost"><Art id={t.id} /></span>
            <span class="lbl">{t.label}</span>
            {t.count > 0 && <em>{t.count}</em>}
            {t.soon && <em class="soon">{t.soon}</em>}
          </button>
        );
      })}
    </div>
  );
}
