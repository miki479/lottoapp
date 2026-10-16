import { ChestScene } from "./ChestScene.tsx";
import { Zap, Activity, Bus, Check, Clapperboard, CloudRain, Coins, Crown, Droplet, Flame, Fuel, Gem, Gift, Globe, Layers, Moon, PackageOpen, Scale, Sparkles, Sunrise, Target, ThumbsDown, ThumbsUp, Ticket, Timer, TrainFront, Trophy, UserRound, Users } from "lucide-preact";
import type { LucideIcon } from "lucide-preact";
import { useRef, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { money } from "../lib/format.ts";
import type { DailyMissionsData, FlashData } from "../lib/types.ts";
import { INTL_TAG } from "../i18n/index.ts";
import { untilReset } from "./RewardsSheet.tsx";
import { moneySigned } from "../lib/num.ts";

const ICON: Record<string, LucideIcon> = {
  m_bets3: Ticket, m_bets5: Ticket, m_bets8: Ticket, m_leg_bets10: Ticket, m_cat_bus: Bus, m_cat_train: TrainFront, m_cat_weather: CloudRain, m_cat_nature: Activity, m_cat_fin: Coins, m_cat_cult: Clapperboard, m_sport: Trophy,
  m_stake25: Coins, m_stake100: Coins, m_stake250: Gem, m_early: Sunrise, m_night: Moon, m_last1h: Timer, m_yes2: ThumbsUp, m_no2: ThumbsDown, m_cats2: Layers, m_cats3: Layers, m_leg_cats4: Globe, m_cities3: Globe,
  m_odds3: Flame, m_odds5: Flame, m_odds8: Flame, m_leg_odds12: Sparkles, m_parlay: Layers, m_parlay3: Layers, m_friend: Users, m_metal: Gem, m_fuel: Fuel, m_oil: Droplet, m_draw: Scale, m_player: UserRound, m_custom: Users,
  m_win1: Target, m_win2: Target, m_winodds3: Target, m_leg_win3: Crown };

/** Three missions a day with progress bars and rewards, and a chest when all three are done. The server counts and pays; this only shows and presses "collect". */
export function DailyMissions(p: { data: DailyMissionsData | null; msg: Messages; locale: Locale; now: number; tz: string; streak: number; onClaim: (id: string) => Promise<void>; onChest: () => Promise<void>; flash?: FlashData | null; onFlash?: () => Promise<void>; compact?: boolean }) {
  const t = p.msg.dm;
  const [pop, setPop] = useState<string | null>(null), [busy, setBusy] = useState<string | null>(null), going = useRef(false), [chestOpen, setChestOpen] = useState(false);
  if (!p.data) return <section class="card dm"><div class="sk s" /></section>;
  const ms = p.data.missions, doneN = ms.filter((m) => m.progress >= m.target).length, c = p.data.chest;
  const burst = async (id: string, fn: () => Promise<void>) => {
    if (going.current) return;
    going.current = true; setBusy(id); setPop(id); setTimeout(() => setPop((x) => (x === id ? null : x)), 1100);
    try { await fn(); } catch { /* the owner of the handler shows the error */ } finally { going.current = false; setBusy(null); }
  };
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
            <li key={m.id} class={`dmrow ${m.tier === 4 ? "legend" : ""} ${done ? "ready" : ""} ${m.claimed ? "claimed" : ""} ${pop === m.id ? "pop" : ""}`}>
              <span class="dmico"><Icon size={20} /></span>
              <div class="dmtx"><b>{m.tier === 4 && <i class="dmleg">{t.legend}</i>}{t.titles[m.id] ?? m.id}</b>
                <span class="dmbar" role="progressbar" aria-valuenow={m.progress} aria-valuemax={m.target}><i style={`width:${pct}%`} /></span></div>
              <span class="dmact">
                {m.claimed ? <span class="dmok"><Check size={16} strokeWidth={3} />{t.done}</span>
                  : done ? <button class="btn primary dmbtn" disabled={busy !== null} aria-busy={busy === m.id} onClick={() => burst(m.id, () => p.onClaim(m.id))}><span>{t.claim}</span><b>{moneySigned(m.reward, p.locale)}</b></button>
                  : <><em class="num">{m.progress}/{m.target}</em><span class="dmrew">{moneySigned(m.reward, p.locale)}</span></>}
              </span>
            </li>
          );
        })}
      </ul>
      {p.flash && (() => {
        const f = p.flash, s = Date.parse(f.start), e = Date.parse(f.end), done = f.progress >= f.target, live = p.now >= s && p.now < e, over = p.now >= e;
        const st = f.claimed ? "claimed" : done ? "ready" : live ? "live" : over ? "missed" : "soon";
        const left = Math.max(0, e - p.now), mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
        const at = new Intl.DateTimeFormat(INTL_TAG[p.locale], { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: p.tz }).format(new Date(s));
        return (
          <div class={`dmflash ${st} ${pop === "flash" ? "pop" : ""}`}>
            <span class="dmico big bolt"><Zap size={24} fill="currentColor" /></span>
            <div class="dmtx"><b><i class="dmleg flashtag">{t.flash.title}</i>{t.flash.titles[f.id] ?? f.id}</b>
              <span class="hint">{t.flash.prize(money(f.reward, p.locale), f.boosts)}</span>
              {st === "live" && <span class="dmbar"><i style={`width:${Math.round((f.progress / f.target) * 100)}%`} /></span>}
            </div>
            <span class="dmact">
              {st === "claimed" ? <span class="dmok"><Check size={16} strokeWidth={3} />{t.done}</span>
                : st === "ready" ? <button class="btn primary dmbtn" disabled={busy !== null} aria-busy={busy === "flash"} onClick={() => burst("flash", async () => { await p.onFlash?.(); })}><span>{t.flash.claim}</span></button>
                : st === "live" ? <><em class="num">{f.progress}/{f.target}</em><span class="dmcount num">{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}</span></>
                : st === "soon" ? <span class="dmcount">{t.flash.soon(at)}</span> : <span class="dmmiss">{t.flash.missed}</span>}
            </span>
          </div>
        );
      })()}
      <div class={`dmchest ${c.ready && !c.claimed ? "ready" : ""} ${c.claimed ? "claimed" : ""} ${pop === "chest" ? "pop" : ""}`}>
        <span class="dmico big">{c.claimed ? <PackageOpen size={24} /> : <Gift size={24} />}</span>
        <div class="dmtx"><b>{t.chest}</b><span class="hint">{t.chestBody(money(c.reward, p.locale))}</span>
          <span class="dmdots" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} class={i < doneN ? "on" : ""} />)}</span></div>
        <span class="dmact">
          {c.claimed ? <span class="dmok"><Check size={16} strokeWidth={3} />{t.done}</span>
            : c.ready ? <button class="btn primary dmbtn" disabled={busy !== null} aria-busy={busy === "chest"} onClick={() => setChestOpen(true)}>{t.chestOpen}</button>
            : <em class="num">{t.chestLocked(3 - doneN)}</em>}
        </span>
      </div>
      {chestOpen && <ChestScene msg={p.msg} locale={p.locale} reward={c.reward} onCollect={() => burst("chest", p.onChest)} onClose={() => setChestOpen(false)} />}
    </section>
  );
}
