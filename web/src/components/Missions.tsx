import { Bus, Check, CloudRain, TrainFront } from "lucide-preact";
import type { Messages } from "../i18n/index.ts";
import type { Progress } from "../lib/types.ts";

/** The three daily missions as small rings; closing all three pays a bonus. */
export function Missions({ progress, msg }: { progress: Progress | null; msg: Messages }) {
  const rings = [{ id: "bus", Icon: Bus, done: (progress?.bus ?? 0) > 0 }, { id: "train", Icon: TrainFront, done: (progress?.train ?? 0) > 0 }, { id: "weather", Icon: CloudRain, done: (progress?.weather ?? 0) > 0 }];
  const left = rings.filter((r) => !r.done).length;
  return (
    <section class="card missions" aria-label={msg.home.missions}>
      <div class="rings3">
        {rings.map(({ id, Icon, done }) => (
          <span class={`ring ${done ? "done" : ""}`} key={id}>
            <svg class="arc" viewBox="0 0 40 40" aria-hidden="true"><circle class="track" cx="20" cy="20" r="17" /><circle class="fg" cx="20" cy="20" r="17" pathLength="100" /></svg>
            {done ? <Check size={20} strokeWidth={2.6} /> : <Icon size={20} />}
          </span>
        ))}
      </div>
      <div class="txt"><b>{msg.home.missions}</b><span>{progress?.bonus_claimed ? msg.home.missionsDone : `${msg.home.missionsLeft(left)} · ${msg.home.bonusTease}`}</span></div>
    </section>
  );
}
