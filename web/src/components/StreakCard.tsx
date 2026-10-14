import { Flame, Snowflake } from "lucide-preact";
import { nextMilestone } from "../../../shared/rewards.ts";
import type { Locale, Messages } from "../i18n/index.ts";
import { money } from "../lib/format.ts";
import { moneySigned } from "../lib/num.ts";
import { Meter } from "./Meter.tsx";

/** Current streak, the next reward on the way and the freezes in stock. Rewards are paid by the server. */
export function StreakCard({ streak, freezes, msg, locale }: { streak: number; freezes: number; msg: Messages; locale: Locale }) {
  const next = nextMilestone(streak);
  const pct = next ? Math.min(100, Math.round((streak / next.day) * 100)) : 100;
  return (
    <section class="card streakcard" aria-label={msg.streak.title}>
      <div class="srow">
        <span class={`flame ${streak > 0 ? "lit" : ""}`}><Flame size={26} fill={streak > 0 ? "currentColor" : "none"} /></span>
        <div class="stxt"><span class="detail">{msg.streak.title}</span><b class="num">{msg.streak.days(streak)}</b></div>
        <span class="freezes"><Snowflake size={16} />{freezes}</span>
      </div>
      <Meter tone="streak" name={msg.streak.title} value={pct} max={100} foot={next ? msg.streak.next(next.day, moneySigned(next.bonus, locale)) : msg.streak.max} />
    </section>
  );
}
