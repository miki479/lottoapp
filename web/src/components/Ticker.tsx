import type { ComponentChildren } from "preact";
import { useMemo } from "preact/hooks";

/** The moment the first strip started: a strip that is rebuilt (its lines changed) picks the animation up at the same point instead of starting over. */
const T0 = Date.now(), MAX_LINES = 4;

/**
 * Thin scrolling strip under the top bar: what the lines and markets are doing and a few things other players did. Pauses on touch/hover.
 * The strip is built only when its lines really change (not on every tick of the app's clock): rebuilding the moving strip all the time made phones
 * draw it half empty for a moment.
 */
export function Ticker({ items, label }: { items: { id: string; text?: string; node: ComponentChildren; pin?: boolean }[]; label: string }) {
  // At most four distinct lines at a time (a different four every two minutes): the moving strip is drawn as one picture, and iPhones cannot draw one that is wider
  // than about 16,000 device pixels (the text past that point goes missing until the strip comes round again). Four lines twice over (about 3,600 CSS pixels) stay well under it.
  const pins = items.filter((i) => i.pin).slice(0, 2), rest = items.filter((i) => !i.pin), room = MAX_LINES - pins.length;
  const win = items.length <= MAX_LINES ? items : [...pins, ...Array.from({ length: room }, (_, k) => rest[(Math.floor(Date.now() / 120_000) * room + k) % rest.length]!)];
  const sig = win.map((i) => `${i.id}:${i.text ?? ""}`).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => {
    if (win.length === 0) return null;
    // a strip of one line stands still: starting over would put the same sentence twice in a row
    if (win.length === 1) return <div class="ticker still" role="status" aria-label={label}><span class="tk">{win[0]!.node}</span></div>;
    // enough copies for each half to be wider than a phone, so the strip never shows a gap before the first item comes back from the right
    const reps = Math.max(1, Math.ceil(2 / win.length)), half = Array.from({ length: reps }, () => win).flat(), run = [...half, ...half];
    const dur = Math.max(40, half.length * 7), phase = (((Date.now() - T0) / 1000) % dur).toFixed(1);
    return (
      <div class="ticker" aria-label={label}>
        <div class="track" style={`animation-duration:${dur}s;animation-delay:-${phase}s`}>
          {run.map((it, i) => <span class="tk" key={`${it.id}-${i}`} aria-hidden={i >= win.length}>{it.node}</span>)}
        </div>
      </div>
    );
  }, [sig, label]);
}
