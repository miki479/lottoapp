import type { ComponentChildren } from "preact";

export type MeterTone = "brand" | "streak" | "bank" | "season";

/**
 * The one progress bar of the app (experience, streak, the bank's multiplier, the league, the season): a label on the left and a figure on the right, a thick
 * track that stays visible where it is still empty, the fill, and an optional line under it.
 */
export function Meter(p: { value: number; max?: number; tone?: MeterTone; label?: ComponentChildren; end?: ComponentChildren; name: string; foot?: ComponentChildren; class?: string }) {
  const max = p.max ?? 1, ratio = Math.max(0, Math.min(1, max > 0 ? p.value / max : 0));
  return (
    <div class={`pbar t-${p.tone ?? "brand"} ${p.class ?? ""}`}>
      {(p.label || p.end) && <div class="pbhead"><span>{p.label}</span><b class="num">{p.end}</b></div>}
      <div class="pbtrack" role="progressbar" aria-label={p.name} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(p.value * 100) / 100}><i style={`width:${Math.round(ratio * 100)}%`} /></div>
      {p.foot && <p class="pbfoot">{p.foot}</p>}
    </div>
  );
}
