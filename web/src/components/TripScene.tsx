import { Hourglass, MapPin } from "lucide-preact";
import { useEffect, useRef } from "preact/hooks";
import type { MarketRow } from "../lib/format.ts";
import { BusSide, isMetroLine, MetroSide, TrainSide } from "./Vehicles.tsx";

/**
 * The little trip of a bus/train question: the vehicle shows where the trip is now and, while a choice is hovered or selected,
 * plays it out ("on time" = nitro run, "late" = a slow crawl). Used on the cards and inside the bet slip.
 */
export function TripScene({ m, now, hint, big }: { m: MarketRow; now: number; hint: "yes" | "no" | null; big?: boolean }) {
  const Kind = m.category === "train" ? (isMetroLine(m.params.routeName) ? MetroSide : TrainSide) : BusSide;
  // Moved by CSS transitions starting from wherever the vehicle is right now, so switching from "on time" to "late" brakes and rolls back.
  const rider = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = rider.current; if (!el) return;
    if (hint) {
      const x = el.getBoundingClientRect().left - (el.parentElement as HTMLElement).getBoundingClientRect().left;
      el.style.animation = "none"; el.style.opacity = "1"; el.style.transition = "none"; el.style.left = `${x}px`; void el.offsetWidth;
      el.style.transition = hint === "no" ? "left 1.3s cubic-bezier(.55, 0, .85, .35)" : "left 1.5s cubic-bezier(.15, .8, .25, 1)";
      el.style.left = hint === "no" ? "calc(100% - var(--w) - 18px)" : "calc((100% - var(--w)) * .4)";
    } else {
      el.style.transition = "opacity .35s"; el.style.opacity = "0";
      const t = setTimeout(() => { el.style.cssText = ""; }, 380);
      return () => clearTimeout(t);
    }
  }, [hint]);
  // The vehicle covers its trip in the last 3 hours before the arrival time; more wind puffs the closer the arrival is.
  const toArrival = Date.parse(m.target_at) - now;
  const progress = Math.max(0, Math.min(1, 1 - toArrival / (3 * 3600_000)));
  const mins = toArrival / 60_000;
  const h = [...m.id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const cyc = 18 + (h % 16), off = h % 33;
  const w = (m.category === "train" ? 60 : 48) * (big ? 1.8 : 1);
  const puffs = toArrival <= 0 || mins > 180 ? 0 : mins > 120 ? 1 : mins > 60 ? 2 : mins > 30 ? 3 : mins > 10 ? 4 : 6;
  return (
    <div class={`scene ${m.category} ${big ? "big" : ""}`} aria-hidden="true" data-hint={hint ?? ""} style={`--p:${progress.toFixed(4)};--w:${w}px;--cyc:${cyc}s;--off:-${off}s`}>
      <span class="road" /><span class="done" /><span class="streaks"><i /><i /><i /><i /><i /><i /></span><span class="dest"><MapPin size={16} /><i class="ping" /></span>
      <span class="rider" ref={rider}>
        {Array.from({ length: puffs }, (_, i) => <i key={i} class="puff" style={`--t:${(2.6 - puffs * 0.2).toFixed(2)}s;animation-delay:${-(i * (2.6 - puffs * 0.2)) / puffs}s;top:${3 + (i % 3) * 5}px`} />)}
        <Hourglass size={14} class="wait" /><i class="flame" />
        <Kind size={big ? 36 : 20} />
      </span>
    </div>
  );
}
