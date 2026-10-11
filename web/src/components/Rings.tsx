/** Three daily rings: each fills when you place a bet in that category today. */
export interface RingData { id: string; label: string; icon: string; done: boolean; color: string }

export function Rings({ rings }: { rings: RingData[] }) {
  return (
    <div class="rings">
      {rings.map((r, i) => (
        <div class={`ringbox ${r.done ? "done" : ""}`} key={r.id} style={`--c:${r.color};--i:${i}`}>
          <svg viewBox="0 0 80 80" width="92" height="92" aria-hidden="true">
            <circle class="track" cx="40" cy="40" r="32" />
            <circle class="arc" cx="40" cy="40" r="32" pathLength="100" stroke-dasharray={r.done ? "100 100" : "0 100"} />
          </svg>
          <span class="ico">{r.done ? "✓" : r.icon}</span>
          <b>{r.label}</b>
        </div>
      ))}
    </div>
  );
}
