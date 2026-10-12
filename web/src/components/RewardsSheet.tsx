import { Check, Gift, Rocket, Share2, Snowflake, X } from "lucide-preact";
import type { Locale, Messages } from "../i18n/index.ts";
import { money } from "../lib/format.ts";
import type { DailyMissionsData, Profile, QuestRow } from "../lib/types.ts";
import { DailyMissions } from "./DailyMissions.tsx";
import { Sheet } from "./Sheet.tsx";

/** Time left until local midnight in the player's time zone ("5h 12m"), when the daily missions renew. */
export function untilReset(tz: string, nowMs: number): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(nowMs)).map((x) => [x.type, x.value]));
  const left = 24 * 60 - (Number(p.hour) * 60 + Number(p.minute));
  return left >= 60 ? `${Math.floor(left / 60)}h ${left % 60}m` : `${left}m`;
}

/** Everything that pays credits: today's missions, one-time quests and invites. Claiming is a button; the server checks every condition. */
export function RewardsSheet(p: {
  msg: Messages; locale: Locale; now: number; profile: Profile | null; quests: QuestRow[]; referral: { code: string; invited: number; paid: number } | null; registered: boolean; missions: DailyMissionsData | null; onClaimMission: (id: string) => Promise<void>; onClaimChest: () => Promise<void>;
  onClaim: (id: string) => void; onGo: (id: string) => void; onShare: () => void; onClose: () => void;
}) {
  const m = p.msg.rewards;
  const once = p.quests.filter((q) => q.kind === "once");
  const row = (q: QuestRow) => {
    const t = m.quest[q.id];
    const act = q.claimed ? <span class="qdone"><Check size={16} strokeWidth={2.6} />{m.claimed}</span>
      : q.done ? <button class="btn primary qbtn" onClick={() => p.onClaim(q.id)}>{m.claim(money(q.reward, p.locale))}</button>
      : q.id === "o_nick" || q.id === "o_push" ? <button class="btn secondary qbtn" onClick={() => p.onGo(q.id)}>{m.go}</button>
      : <span class="qreward">+{money(q.reward, p.locale)}</span>;
    return (
      <li key={q.id} class={`quest ${q.claimed ? "claimed" : q.done ? "ready" : ""}`}>
        <div class="qt"><b>{t?.t ?? q.id}</b><span>{t?.d}</span></div>
        {act}
      </li>
    );
  };
  return (
    <Sheet onClose={p.onClose} label={m.title}>
      <div class="shead"><h2>{m.title}</h2><button class="iconbtn" onClick={p.onClose} aria-label={p.msg.common.close}><X size={22} /></button></div>
      <div class="rbal"><span class="coin" aria-hidden="true">€</span><b class="num">{money(p.profile?.credits ?? 0, p.locale)}</b>
        <span class="rstock"><Snowflake size={15} />{p.profile?.freezes ?? 0}</span><span class="rstock"><Rocket size={15} />{p.profile?.boosts ?? 0}</span></div>
      <p class="hint">{m.subtitle}</p>
      <DailyMissions data={p.missions} msg={p.msg} locale={p.locale} now={p.now} tz={p.profile?.timezone ?? "UTC"} streak={p.profile?.streak ?? 0} onClaim={p.onClaimMission} onChest={p.onClaimChest} />
      <section class="stack" style="gap:8px">
        <h3>{m.once}</h3>
        <ul class="quests">{once.map(row)}</ul>
      </section>
      <section class="card stack referral">
        <div style="display:flex;gap:12px;align-items:center"><span class="refico"><Gift size={22} /></span><div><b>{m.invite}</b><p class="hint">{m.inviteBody(money(1500, p.locale), 10)}</p></div></div>
        {p.referral
          ? <><p class="hint">{m.invited(p.referral.paid, 10)}</p><button class="btn primary wide" onClick={p.onShare}><Share2 size={18} />{p.msg.referral.share}</button></>
          : <p class="hint">{p.msg.referral.guest}</p>}
      </section>
    </Sheet>
  );
}
