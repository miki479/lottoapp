import { MapPin, Bell, Gift, Rocket, Calendar, CalendarCheck, ChevronRight, Flame, Gem, Ghost, LogOut, Medal, Pencil, Percent, Share2, Snowflake, Sparkles, Target, Telescope, Trash2, TrainFront, TrendingUp, Trophy, Umbrella, User, Zap } from "lucide-preact";
import type { LucideIcon } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { Sheet } from "../components/Sheet.tsx";
import { StreakCard } from "../components/StreakCard.tsx";
import { BankCard } from "../components/BankCard.tsx";
import { money } from "../lib/format.ts";
import { LOCALES, TROPHY_IDS, TROPHY_RARITY, type Locale, type Messages, type TrophyId } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { HistoryCard } from "../components/HistoryCard.tsx";
import type { MyStats, Profile, Progress } from "../lib/types.ts";
import { INTL_TAG } from "../i18n/index.ts";
import { Look } from "../components/looks/Look.tsx";
import { readConsent, writeConsent } from "../lib/useIntent.ts";
import { Trophy3D } from "../components/looks/Trophy3D.tsx";
import { XpInfo } from "../components/XpInfo.tsx";
import { LeagueBadge } from "../components/League.tsx";
import { levelProgress } from "../../../shared/looks";
import type { MyProgress } from "../lib/looks.ts";

export const TROPHY_ICON: Record<TrophyId, LucideIcon> = { first_win: Sparkles, all_rings: Target, long_shot: Telescope, rain_man: Umbrella, streak_7: CalendarCheck, train_whisperer: TrainFront, high_roller: Gem, streak_30: Medal, ghost_feed: Ghost, wins_100: Trophy, wins_500: Trophy, streak_100: Flame, bets_500: Medal, all_categories: Telescope, win_row_10: Zap, big_odds: Target, parlay_5: Gem, friends_10: Gem, level_25: Gem, level_50: Gem, chest_30: Gift, collector: Gem };

export function ProfileView(p: {
  look: MyProgress | null; onLook: () => void;
  onAdmin: () => void; homeNode?: preact.ComponentChildren; missionsNode?: preact.ComponentChildren;
  giftCard: boolean; onGiftSeen: () => void; push: { on: boolean; denied: boolean; toggle: () => void; flash: boolean; streak: boolean; friends: boolean; setPrefs: (f: boolean, s: boolean, fr: boolean) => void } | null; referral: { code: string; invited: number; paid: number } | null; onShareReferral: () => void; progress: Progress | null; msg: Messages; locale: Locale; onLocale: (l: Locale) => void; profile: Profile | null; email: string | null; registered: boolean; trophies: Set<string>; fresh: Set<string>;
  onAuth: () => void; onNickname: () => void; onShareProfile: () => void; onSignOut: () => void; onDelete: () => Promise<void>; sources: { name: string; via?: string; license: string; licenseUrl: string; url: string }[];
}) {
  const [intentOn, setIntentOn] = useState(() => readConsent() === "on");
  const m = p.msg.profile;
  const [xpOpen, setXpOpen] = useState(false);
  const [stats, setStats] = useState<MyStats | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [admin, setAdmin] = useState(false);
  useEffect(() => { if (!p.registered) { setAdmin(false); return; } sb.rpc("is_admin").then(({ data }) => setAdmin(data === true)); }, [p.registered, p.email]);
  useEffect(() => { sb.rpc("my_stats").then(({ data }) => { const r = (data as MyStats[] | null)?.[0]; if (r) setStats({ total: +r.total, won: +r.won, lost: +r.lost, voided: +r.voided, best_win: +r.best_win, net: +r.net, staked: +r.staked }); }); }, [p.profile?.credits]);
  const settled = (stats?.won ?? 0) + (stats?.lost ?? 0);
  const rate = settled ? Math.round(((stats?.won ?? 0) / settled) * 100) : null;
  const net = stats?.net ?? 0;
  const owned = TROPHY_IDS.filter((t) => p.trophies.has(t)).length;
  const nf = new Intl.NumberFormat(INTL_TAG[p.locale]);
  const name = p.profile?.display_name ?? (p.registered ? p.email : null) ?? m.guest;

  return (
    <div class="screen stack">
      <h1>{m.title}</h1>
      {p.giftCard && (
        <section class="card giftcard">
          <span class="refico"><Gift size={22} /></span>
          <div style="flex:1"><b>{p.msg.boost.gift}</b><p class="hint">{p.msg.boost.explain}</p></div>
          <button class="btn primary" onClick={p.onGiftSeen}>OK</button>
        </section>
      )}
      <div class="profile-grid">
        <div class="stack">
          <section class="card stack">
            <div style="display:flex;align-items:center;gap:14px">
              {p.look ? <button class="lkme" onClick={p.onLook} aria-label={p.msg.look.change}><Look avatar={p.look.avatar} decoration={p.look.decoration} size={72} /><span class="lvl num">{p.look.level}</span></button> : <span class="rank top" style="width:56px;height:56px;border-radius:18px;font-size:22px"><User size={26} /></span>}
              <div style="min-width:0;flex:1"><b style="font-size:18px;display:block;overflow:hidden;text-overflow:ellipsis">{name}</b><span class="hint">{p.registered ? p.email : m.guest}</span>{p.homeNode}{p.registered && <div style="margin-top:6px"><LeagueBadge locale={p.locale} registered={p.registered} /></div>}</div>
              {p.registered && <button class="iconbtn" onClick={p.onNickname} aria-label={m.nickname.title}><Pencil size={20} /></button>}
            </div>
            {p.look && (() => { const lp = levelProgress(p.look.xp); return <button class="lkxp" onClick={p.onLook}><span class="xpbar"><i style={`width:${Math.round(lp.ratio * 100)}%`} /></span><span class="hint num">{p.msg.look.level(lp.level)} · {p.msg.look.xp(lp.into, lp.need)}</span></button>; })()}
            {p.look && <button class="linkbtn xphow" onClick={() => setXpOpen(true)}>{p.msg.look.xpHow}</button>}
            {xpOpen && <XpInfo msg={p.msg} onClose={() => setXpOpen(false)} />}
            {!p.registered && <p class="hint">{m.guestHint}</p>}
            {!p.registered ? <button class="btn primary wide" onClick={p.onAuth}>{m.signIn}</button> : !p.profile?.display_name && <button class="btn secondary wide" onClick={p.onNickname}>{m.nickname.title}</button>}
          </section>

          <StreakCard streak={p.profile?.streak ?? 0} freezes={p.profile?.freezes ?? 0} msg={p.msg} locale={p.locale} />
          {p.missionsNode}
          {p.registered && <BankCard locale={p.locale} credits={p.profile?.credits} />}
          {p.push && (
            <section class="card stack">
              <label class="switchrow"><span class="swlabel"><Bell size={18} style="color:var(--brand);flex:none" /><span>{p.msg.push.active}</span></span><input type="checkbox" role="switch" checked={p.push.on} disabled={p.push.denied} onChange={p.push.toggle} /></label>
              {p.push.denied && <p class="hint">{p.msg.push.denied}</p>}
              {p.push.on && (
                <>
                  <label class="switchrow"><span class="swlabel"><Zap size={18} style="color:var(--brand);flex:none" /><span>{p.msg.push.events}</span></span><input type="checkbox" role="switch" checked={p.push.flash && p.push.streak && p.push.friends} onChange={(e) => { const v = (e.target as HTMLInputElement).checked; p.push!.setPrefs(v, v, v); }} /></label>
                  <p class="hint">{p.msg.push.prefsHint}</p>
                </>
              )}
            </section>
          )}
          <section class="card stack">
            <label class="switchrow"><span class="swlabel"><MapPin size={18} style="color:var(--brand);flex:none" /><span>{p.msg.fy.setTitle}</span></span><input type="checkbox" role="switch" checked={intentOn} onChange={(e) => { const on = (e.target as HTMLInputElement).checked; writeConsent(on ? "on" : "off"); setIntentOn(on); }} /></label>
            <p class="hint">{intentOn ? p.msg.fy.setOn : p.msg.fy.setOff}</p>
          </section>
          <section class="card stack referral">
            <div style="display:flex;gap:12px;align-items:center"><span class="refico"><Gift size={22} /></span><div><b>{p.msg.referral.title}</b><p class="hint">{p.msg.referral.body(money(1500, p.locale))} {p.msg.frd.referralNote}</p></div></div>
            {p.referral
              ? <><div class="refcode"><span class="detail">{p.msg.referral.code}</span><b class="num">{p.referral.code}</b></div>
                  <button class="btn primary wide" onClick={p.onShareReferral}><Share2 size={18} />{p.msg.referral.share}</button>
                  <p class="hint">{p.msg.referral.counts(p.referral.invited, p.referral.paid)}</p></>
              : <p class="hint">{p.msg.referral.guest}</p>}
          </section>

          <h2 style="margin-top:8px">{m.stats.title}</h2>
          <div class="bento">
            <div class="card cell big span2 row2" style="--i:0">
              <div class="donut"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="42" /><circle class="fg" cx="50" cy="50" r="42" pathLength="100" stroke-dasharray={`${rate ?? 0} 100`} /></svg><b class="num">{rate === null ? "—" : `${rate}%`}</b></div>
              <span class="detail"><Percent size={12} style="vertical-align:-1px" /> {m.stats.winRate}</span>
            </div>
            <div class="card cell span2" style="--i:1"><span class="detail">{m.stats.streak}</span><span class="v"><Flame size={22} class="ic" style="vertical-align:-3px;margin-right:6px" />{p.profile?.streak ?? 0}<small>{p.profile?.streak === 1 ? "" : ""}</small></span></div>
            <div class="card cell span2" style="--i:2"><span class="detail">{m.stats.best}</span><span class="v num">+{money(stats?.best_win ?? 0, p.locale)}</span></div>
            <div class="card cell" style="--i:3"><span class="detail">{m.stats.bets}</span><span class="v num">{stats?.total ?? 0}</span></div>
            <div class={`card cell ${net > 0 ? "won" : net < 0 ? "lost" : ""}`} style="--i:4"><span class="detail">{m.stats.net}</span><span class="v num">{net > 0 ? "+" : net < 0 ? "−" : ""}{money(Math.abs(net), p.locale)}</span></div>
            <div class="card cell span2" style="--i:5"><span class="detail">{m.stats.trophies}</span><span class="v num"><Trophy size={22} class="ic" style="vertical-align:-3px;margin-right:6px" />{owned}<small>/ {TROPHY_IDS.length}</small></span></div>
          </div>
          <HistoryCard msg={p.msg} locale={p.locale} />
          <div class="card" style="display:flex;gap:12px;align-items:center"><Snowflake size={22} style="color:var(--brand)" /><div><b>{m.freezes(p.profile?.freezes ?? 0)}</b><p class="hint">{m.freezeHint}</p></div></div>
          <div class="card" style="display:flex;gap:12px;align-items:center"><Rocket size={22} style="color:var(--c-pop)" /><div><b>{p.msg.boost.title} · {(p.profile?.boosts ?? 0) > 0 ? p.msg.boost.have(p.profile?.boosts ?? 0) : p.msg.boost.none}</b><p class="hint">{p.msg.boost.explain}</p></div></div>
        </div>

        <div class="stack">
          <h2>{m.trophies}</h2>
          <div class="trophies">
            {TROPHY_IDS.map((id) => {
              const have = p.trophies.has(id), t = m.trophy[id];
              return (
                <div class={`card trophy ${have ? "" : "lock"} ${p.fresh.has(id) ? "fresh" : ""}`} key={id}>
                  <span class="ti b3"><Trophy3D id={id} have={have} size={56} /></span>
                  <b>{have ? t.name : "???"}</b><small>{have ? t.desc : m.locked}</small>
                  <span class="detail">{m.rarity[TROPHY_RARITY[id]]}</span>
                </div>
              );
            })}
          </div>
          <button class="btn secondary wide" onClick={p.onShareProfile}><Share2 size={18} />{m.shareCard}</button>

          <h2 style="margin-top:8px">{m.settings}</h2>
          <div class="list">
            <div class="row" style="flex-wrap:wrap"><span class="grow">{p.msg.common.language}</span>
              <div class="seg" style="width:100%">{LOCALES.map((l) => <button key={l.id} class={l.id === p.locale ? "on" : ""} aria-pressed={l.id === p.locale} onClick={() => p.onLocale(l.id)}>{l.short}</button>)}</div>
            </div>
            {admin && <button class="row" onClick={p.onAdmin}><span class="grow">{p.msg.admin.open}</span><ChevronRight size={18} /></button>}
            <p class="hint" style="display:flex;gap:14px;flex-wrap:wrap;padding:6px 4px"><a href="/how-it-works.html" style="color:var(--brand)">{m.howItWorks}</a><a href="/terms.html" style="color:var(--text-2)">{m.terms}</a><a href="/privacy.html" style="color:var(--text-2)">{m.privacy}</a></p>
            <details class="row" style="display:block"><summary style="min-height:32px;display:flex;align-items:center;cursor:pointer">{m.sources}</summary>
              <ul class="hint" style="padding-left:18px">{p.sources.map((a) => <li key={a.name}><a href={a.url} target="_blank" rel="noopener noreferrer" style="color:inherit">{a.name}</a>{a.via ? ` · ${a.via}` : ""} · <a href={a.licenseUrl} target="_blank" rel="noopener noreferrer" style="color:inherit">{a.license}</a></li>)}</ul>
            </details>
            {p.registered && <button class="row" onClick={p.onSignOut}><LogOut size={20} /><span class="grow">{m.signOut}</span><ChevronRight size={18} /></button>}
            <button class="row" onClick={() => setConfirm(true)} style="color:var(--lost-fg)"><Trash2 size={20} style="color:var(--lost-fg)" /><span class="grow">{m.delete.action}</span></button>
          </div>
          <p class="hint">{p.msg.disclaimerShort}</p>
        </div>
      </div>

      {confirm && (
        <Sheet onClose={() => setConfirm(false)} label={m.delete.title}>
          <h2>{m.delete.title}</h2><p style="color:var(--text-2)">{m.delete.body}</p>
          <button class="btn danger wide" disabled={busy} onClick={async () => { setBusy(true); await p.onDelete(); setBusy(false); setConfirm(false); }}>{m.delete.confirm}</button>
          <button class="btn secondary wide" onClick={() => setConfirm(false)}>{p.msg.common.cancel}</button>
        </Sheet>
      )}
    </div>
  );
}
