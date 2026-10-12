import { BusSide, TrainSide } from "./Vehicles.tsx";

/** A themed loading bar: a bus and a train ride along a road while the bar fills up and starts over. CSS only. */
export function LoadBar({ label }: { label: string }) {
  return (
    <div class="loadbar" role="status" aria-live="polite">
      <div class="lbscene" aria-hidden="true">
        <span class="lbveh bus"><BusSide size={26} /></span>
        <span class="lbveh train"><TrainSide size={22} /></span>
        <i class="lbroad" />
      </div>
      <div class="lbtrack" aria-hidden="true"><i /></div>
      <span class="lbtext">{label}</span>
    </div>
  );
}
