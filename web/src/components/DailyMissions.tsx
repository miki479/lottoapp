import { Activity, Check, Coins, Flame, Gift, Layers, PackageOpen, Sunrise, Target, Ticket, Trophy, Users } from "lucide-preact";
import type { LucideIcon } from "lucide-preact";
import { useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { money } from "../lib/format.ts";
import type { DailyMissionsData } from "../lib/types.ts";
import { untilReset } from "./RewardsSheet.tsx";

const ICON: Record<string, LucideIcon> = { m_bets3: Ticket, m_bets5: Ticket, m_cats2: Layers, m_sport: Trophy, m_nature: Activity, m_stake50: Coins, m_early: Sunrise, m_odds3: Flame, m_odds5: Flame, m_parlay: Layers, m_friend: Users, m_win1: Target };

/** Three missions a day with progress bars and rewards, and a chest when all three are done. The server counts and pays; this only shows and presses "collect". */
export function DailyMissions(p: { data: DailyMissionsData | null; msg: Messages; locale: Locale; now: number; tz: string; streak: number; onClaim: (id: string) => Promise<void>; onChest: () => Promise<void>; compact?: boolean }) {
  const t = p.msg.dm;
  const [pop, setPop] = useState<string | null>(null);
  if (!p.data) return <section class="card dm"><div class="sk s" /></section>;
  const ms = p.data.missions, doneN = ms.filter((m) => m.progress >= m.target).length, c = p.data.chest;
  const burst = async (id: string, fn: () => Promise<void>) => { setPop(id); setTimeout(() => setPop((x) => (x === id ? null : x)), 1100); await fn(); };
  return (
    <section class="card dm" aria-label={t.title}>
      <div class="dmhead">
        <h2>{t.title}</h2>
        {p.streak >= 2 && <span class="dmstreak"><Flame size={14} />{t.streak(p.streak)}</span>}
        <span class="dmreset">{t.resets(untilReset(p.tz, p.now))}</span>
      </div>
      <ul class="dmlist">
        {ms.map((m) => {
          const Icon = ICON[m.id] ?? Target, done = m.progress >= m.target, pct = Math.round((m.progress / m.target) * 100);
          return (
            <li key={m.id} class={`dmrow ${done ? "ready" : ""} ${m.claimed ? "claimed" : ""} ${pop === m.id ? "pop" : ""}`}>
              <span class="dmico"><Icon size={20} /></span>
              <div class="dmtx"><b>{t.titles[m.id as keyof typeof t.titles] ?? m.id}</b>
                <span class="dmbar" role="progressbar" aria-valuenow={m.progress} aria-valuemax={m.target}><i style={`width:${pct}%`} /></span></div>
              <span class="dmact">
                {m.claimed ? <span class="dmok"><Check size={16} strokeWidth={3} />{t.done}</span>
                  : done ? <button class="btn primary dmbtn" onClick={() => burst(m.id, () => p.onClaim(m.id))}>{t.claim} +{money(m.reward, p.locale)}</button>
                  : <><em class="num">{m.progress}/{m.target}</em><span class="dmrew">+{money(m.reward, p.locale)}</span></>}
              </span>
            </li>
          );
        })}
      </ul>
      <div class={`dmchest ${c.ready && !c.claimed ? "ready" : ""} ${c.claimed ? "claimed" : ""} ${pop === "chest" ? "pop" : ""}`}>
        <span class="dmico big">{c.claimed ? <PackageOpen size={24} /> : <Gift size={24} />}</span>
        <div class="dmtx"><b>{t.chest}</b><span class="hint">{t.chestBody(money(c.reward, p.locale))}</span>
          <span class="dmdots" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} class={i < doneN ? "on" : ""} />)}</span></div>
        <span class="dmact">
          {c.claimed ? <span class="dmok"><Check size={16} strokeWidth={3} />{t.done}</span>
            : c.ready ? <button class="btn primary dmbtn" onClick={() => burst("chest", p.onChest)}>{t.chestOpen}</button>
            : <em class="num">{t.chestLocked(3 - doneN)}</em>}
        </span>
      </div>
    </section>
  );
}
