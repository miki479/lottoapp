import { Calendar, CalendarCheck, ChevronRight, Flame, Gem, Ghost, LogOut, Medal, Pencil, Percent, Share2, Snowflake, Sparkles, Target, Telescope, Trash2, TrainFront, TrendingUp, Trophy, Umbrella, User } from "lucide-preact";
import type { LucideIcon } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { Sheet } from "../components/Sheet.tsx";
import { LOCALES, TROPHY_IDS, TROPHY_RARITY, type Locale, type Messages, type TrophyId } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import type { MyStats, Profile } from "../lib/types.ts";
import { INTL_TAG } from "../i18n/index.ts";

const TROPHY_ICON: Record<TrophyId, LucideIcon> = { first_win: Sparkles, all_rings: Target, long_shot: Telescope, rain_man: Umbrella, streak_7: CalendarCheck, train_whisperer: TrainFront, high_roller: Gem, streak_30: Medal, ghost_feed: Ghost };

export function ProfileView(p: {
  msg: Messages; locale: Locale; onLocale: (l: Locale) => void; profile: Profile | null; email: string | null; registered: boolean; trophies: Set<string>; fresh: Set<string>;
  onAuth: () => void; onNickname: () => void; onShareProfile: () => void; onSignOut: () => void; onDelete: () => Promise<void>; sources: { name: string; via?: string; license: string; licenseUrl: string; url: string }[];
}) {
  const m = p.msg.profile;
  const [stats, setStats] = useState<MyStats | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
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
      <div class="profile-grid">
        <div class="stack">
          <section class="card stack">
            <div style="display:flex;align-items:center;gap:14px">
              <span class="rank top" style="width:56px;height:56px;border-radius:18px;font-size:22px"><User size={26} /></span>
              <div style="min-width:0;flex:1"><b style="font-size:18px;display:block;overflow:hidden;text-overflow:ellipsis">{name}</b><span class="hint">{p.registered ? p.email : m.guest}</span></div>
              {p.registered && <button class="iconbtn" onClick={p.onNickname} aria-label={m.nickname.title}><Pencil size={20} /></button>}
            </div>
            {!p.registered && <p class="hint">{m.guestHint}</p>}
            {!p.registered ? <button class="btn primary wide" onClick={p.onAuth}>{m.signIn}</button> : !p.profile?.display_name && <button class="btn secondary wide" onClick={p.onNickname}>{m.nickname.title}</button>}
          </section>

          <h2 style="margin-top:8px">{m.stats.title}</h2>
          <div class="bento">
            <div class="card cell big span2 row2" style="--i:0">
              <div class="donut"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="42" /><circle class="fg" cx="50" cy="50" r="42" pathLength="100" stroke-dasharray={`${rate ?? 0} 100`} /></svg><b class="num">{rate === null ? "—" : `${rate}%`}</b></div>
              <span class="detail"><Percent size={12} style="vertical-align:-1px" /> {m.stats.winRate}</span>
            </div>
            <div class="card cell span2" style="--i:1"><span class="detail">{m.stats.streak}</span><span class="v"><Flame size={22} class="ic" style="vertical-align:-3px;margin-right:6px" />{p.profile?.streak ?? 0}<small>{p.profile?.streak === 1 ? "" : ""}</small></span></div>
            <div class="card cell span2" style="--i:2"><span class="detail">{m.stats.best}</span><span class="v num">+{nf.format(stats?.best_win ?? 0)}</span></div>
            <div class="card cell" style="--i:3"><span class="detail">{m.stats.bets}</span><span class="v num">{stats?.total ?? 0}</span></div>
            <div class={`card cell ${net > 0 ? "won" : net < 0 ? "lost" : ""}`} style="--i:4"><span class="detail">{m.stats.net}</span><span class="v num">{net > 0 ? "+" : net < 0 ? "−" : ""}{nf.format(Math.abs(net))}</span></div>
            <div class="card cell span2" style="--i:5"><span class="detail">{m.stats.trophies}</span><span class="v num"><Trophy size={22} class="ic" style="vertical-align:-3px;margin-right:6px" />{owned}<small>/ {TROPHY_IDS.length}</small></span></div>
          </div>
          <div class="card" style="display:flex;gap:12px;align-items:center"><Snowflake size={22} style="color:var(--brand)" /><div><b>{m.freezes(p.profile?.freezes ?? 0)}</b><p class="hint">{m.freezeHint}</p></div></div>
        </div>

        <div class="stack">
          <h2>{m.trophies}</h2>
          <div class="trophies">
            {TROPHY_IDS.map((id) => {
              const have = p.trophies.has(id), t = m.trophy[id], Icon = TROPHY_ICON[id];
              return (
                <div class={`card trophy ${have ? "" : "lock"} ${p.fresh.has(id) ? "fresh" : ""}`} key={id}>
                  <span class="ti"><Icon size={20} /></span>
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
