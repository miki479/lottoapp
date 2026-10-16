import { Check, Gift, Rocket, Share2, Snowflake, X } from "lucide-preact";
import { useRef, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { money } from "../lib/format.ts";
import type { FlashData, DailyMissionsData, Profile, QuestRow } from "../lib/types.ts";
import { hubText } from "../lib/shopText.ts";
import { DailyBonus } from "./DailyBonus.tsx";
import { DailyMissions } from "./DailyMissions.tsx";
import { ShopArea } from "./ShopArea.tsx";
import "./RewardsHub.css";
import { Sheet } from "./Sheet.tsx";
import { moneySigned, currencySymbol } from "../lib/num.ts";

/** Time left until local midnight in the player's time zone ("5h 12m"), when the daily missions renew. */
export function untilReset(tz: string, nowMs: number): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(nowMs)).map((x) => [x.type, x.value]));
  const left = 24 * 60 - (Number(p.hour) * 60 + Number(p.minute));
  return left >= 60 ? `${Math.floor(left / 60)}h ${left % 60}m` : `${left}m`;
}

/** Everything that pays credits: today's missions, one-time quests and invites. Claiming is a button; the server checks every condition. */
export function RewardsSheet(p: {
  msg: Messages; locale: Locale; now: number; profile: Profile | null; quests: QuestRow[]; referral: { code: string; invited: number; paid: number } | null; registered: boolean; flash: FlashData | null; onClaimFlash: () => Promise<void>; missions: DailyMissionsData | null; onClaimMission: (id: string) => Promise<void>; onClaimChest: () => Promise<void>;
  onClaim: (id: string) => Promise<void> | void; onGo: (id: string) => void; onShare: () => void; onClose: () => void;
  /** Credits changed inside the sheet (daily bonus, pack): the app reloads the profile. */
  onChanged?: () => void;
}) {
  const [tab, setTab] = useState<"today" | "shop" | "album">("today");
  const ht = hubText(p.locale);
  const m = p.msg.rewards;
  const once = p.quests.filter((q) => q.kind === "once");
  const [claiming, setClaiming] = useState<string | null>(null), going = useRef(false);
  const claim = async (id: string) => {
    if (going.current) return;
    going.current = true; setClaiming(id);
    try { await p.onClaim(id); } catch { /* the app shows the error */ } finally { going.current = false; setClaiming(null); }
  };
  const row = (q: QuestRow) => {
    const t = m.quest[q.id];
    const act = q.claimed ? <span class="qdone"><Check size={16} strokeWidth={2.6} />{m.claimed}</span>
      : q.done ? <button class="btn primary qbtn" disabled={claiming !== null} aria-busy={claiming === q.id} onClick={() => claim(q.id)}>{m.claim(money(q.reward, p.locale))}</button>
      : q.id === "o_nick" || q.id === "o_push" ? <button class="btn secondary qbtn" onClick={() => p.onGo(q.id)}>{m.go}</button>
      : <span class="qreward">{moneySigned(q.reward, p.locale)}</span>;
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
      <div class="rbal"><span class="coin" aria-hidden="true">{currencySymbol(p.locale)}</span><b class="num">{money(p.profile?.credits ?? 0, p.locale)}</b>
        <span class="rstock"><Snowflake size={15} />{p.profile?.freezes ?? 0}</span><span class="rstock"><Rocket size={15} />{p.profile?.boosts ?? 0}</span></div>
      <div class="seg rhtabs" role="tablist">{(["today", "shop", "album"] as const).map((k) => <button key={k} role="tab" aria-selected={tab === k} class={tab === k ? "on" : ""} onClick={() => setTab(k)}>{ht.tabs[k]}</button>)}</div>
      {tab !== "today" && <ShopArea tab={tab} locale={p.locale} msg={p.msg} credits={p.profile?.credits ?? 0} registered={p.registered} onTab={setTab} onChanged={() => p.onChanged?.()} onAuth={() => p.onGo("o_nick")} />}
      {tab === "today" && <>
      <p class="hint">{m.subtitle}</p>
      <DailyBonus locale={p.locale} now={p.now} tz={p.profile?.timezone ?? "UTC"} onPlay={p.onClose} onChanged={() => p.onChanged?.()} />
      <DailyMissions data={p.missions} msg={p.msg} locale={p.locale} now={p.now} tz={p.profile?.timezone ?? "UTC"} streak={p.profile?.streak ?? 0} onClaim={p.onClaimMission} onChest={p.onClaimChest} flash={p.flash} onFlash={p.onClaimFlash} />
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
      </>}
    </Sheet>
  );
}
