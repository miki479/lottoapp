import { CalendarClock } from "lucide-preact";
import type { Messages } from "../i18n/index.ts";
import { seasonSpan } from "../lib/format.ts";
import { Meter } from "./Meter.tsx";

/** How long the season (the month) has still to run, as a visible element: the sentence, and how much of the month has gone. */
export function SeasonBanner({ msg, flat }: { msg: Messages; flat?: boolean }) {
  const s = seasonSpan(), text = msg.ranking.season(s.left);
  return (
    <section class={`seasonbar ${flat ? "flat" : ""} ${s.left <= 3 ? "soon" : ""}`} aria-label={text}>
      <span class="seasonico" aria-hidden="true"><CalendarClock size={22} /></span>
      <div class="seasontxt"><b>{text}</b><Meter value={s.elapsed} tone="season" name={text} /></div>
    </section>
  );
}
