import { useState } from "preact/hooks";
import { Rings } from "../components/Rings.tsx";
import { TROPHY_IDS, TROPHY_RARITY, type Messages } from "../i18n/index.ts";
import { makeCard, shareCard, TROPHY_EMOJI } from "../lib/share.ts";
import type { Profile, Progress } from "../lib/types.ts";
import { useCountUp } from "../lib/anim.ts";

export function Missions(p: { msg: Messages; profile: Profile | null; progress: Progress | null; trophies: Set<string>; fresh: Set<string>; rank: number | null; scope: string; season: string; onToast: (s: string) => void }) {
  const [busy, setBusy] = useState(false);
  const pr = p.progress;
  const rings = [
    { id: "bus", label: p.msg.missions.rings.bus, icon: "🚌", done: (pr?.bus ?? 0) > 0, color: "var(--lime)" },
    { id: "train", label: p.msg.missions.rings.train, icon: "🚆", done: (pr?.train ?? 0) > 0, color: "var(--mint)" },
    { id: "weather", label: p.msg.missions.rings.weather, icon: "🌧️", done: (pr?.weather ?? 0) > 0, color: "var(--cyan)" },
  ];
  const left = rings.filter((r) => !r.done).length;
  const streak = useCountUp(p.profile?.streak ?? 0, 600);
  const onShare = async () => {
    if (!p.profile) return;
    setBusy(true);
    const blob = await makeCard({ name: p.profile.display_name, streak: p.profile.streak, credits: p.profile.credits, rank: p.rank, scope: p.scope, trophies: TROPHY_IDS.filter((t) => p.trophies.has(t)), season: p.season }, p.msg);
    if ((await shareCard(blob, p.msg)) === "saved") p.onToast(p.msg.missions.share.saved);
    setBusy(false);
  };
  return (
    <div class="view missions">
      <h2 class="vt">{p.msg.missions.title}</h2>
      <section class="panel">
        <Rings rings={rings} />
        <p class="hint">{pr?.bonus_claimed ? <b class="good">{p.msg.missions.bonusDone}</b> : p.msg.missions.ringsHint(left)}</p>
        {!pr?.bonus_claimed && <p class="tease">🎁 {p.msg.missions.bonusTease}</p>}
      </section>
      <section class="panel streak">
        <div class={`flame ${streak > 0 ? "lit" : ""}`} aria-hidden="true">🔥</div>
        <div><div class="sn">{streak}</div><p>{p.msg.missions.streak(p.profile?.streak ?? 0)}</p><small>{p.msg.missions.streakHint}</small></div>
        <div class="freeze" title={p.msg.missions.freezeHint}><span aria-hidden="true">❄️</span><b>{p.msg.missions.freezes(p.profile?.freezes ?? 0)}</b></div>
      </section>
      <h3 class="vs">{p.msg.missions.trophies} <small>{TROPHY_IDS.filter((t) => p.trophies.has(t)).length}/{TROPHY_IDS.length}</small></h3>
      <div class="trophies">
        {TROPHY_IDS.map((id, i) => {
          const have = p.trophies.has(id), t = p.msg.missions.trophy[id];
          return (
            <div class={`trophy ${TROPHY_RARITY[id]} ${have ? "have" : "lock"} ${p.fresh.has(id) ? "fresh" : ""}`} key={id} style={`--i:${i}`}>
              <span class="te">{have ? TROPHY_EMOJI[id] : "🔒"}</span>
              <b>{have ? t.name : "???"}</b>
              <small>{have ? t.desc : p.msg.missions.locked}</small>
              <em>{p.msg.missions.rarity[TROPHY_RARITY[id]]}</em>
            </div>
          );
        })}
      </div>
      <button class="primary shine wide" disabled={busy || !p.profile} onClick={onShare}>📤 {p.msg.missions.share.button}</button>
    </div>
  );
}
