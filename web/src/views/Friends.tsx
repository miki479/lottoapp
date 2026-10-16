import { LeaguePanel } from "../components/League.tsx";
import { Check, Share2, Swords, UserMinus, Users, X } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { Empty } from "../components/Empty.tsx";
import { Look } from "../components/looks/Look.tsx";
import type { Locale, Messages } from "../i18n/index.ts";
import { useBusy } from "../lib/busy.ts";
import { sb } from "../lib/api.ts";
import { countdown } from "../lib/format.ts";
import { loadFriends, type FriendRow } from "../lib/friends.ts";
import { PlayerTitle } from "../components/PlayerTitle.tsx";
import { LevelBadge } from "../components/LevelBadge.tsx";
import { useLooks } from "../lib/looks.ts";
import { fmtInt } from "../lib/num.ts";

interface FeedRow { code: string; title: string; creator: string; stake: number; closes_at: string; judge_mode: string }
interface Req { user_id: string; display_name: string | null }

/** Everything about the people you play with: requests, the challenges they open for friends, your friends, and the invite link. */
export function Friends(p: { locale: Locale; msg: Messages; registered: boolean; now: number; onToast: (s: string, kind?: "ok" | "err") => void; onAuth: () => void; onProfile: (id: string) => void; onChallenge: () => void; onOpen: (code: string) => void; referral: { code: string; invited: number; paid: number } | null; onShareReferral: () => void; onReqs?: () => void; reqTick?: number }) {
  const f = p.msg.frd;
  const [friends, setFriends] = useState<FriendRow[] | null>(null), [feed, setFeed] = useState<FeedRow[] | null>(null), [reqs, setReqs] = useState<Req[]>([]);
  const [askId, setAskId] = useState<string | null>(null), [showAll, setShowAll] = useState(false);
  const refresh = async () => { setFriends((await loadFriends()).filter((r) => !r.is_me)); };
  const loadFeed = async () => { const { data } = await sb.rpc("friends_challenges_feed"); setFeed((data ?? []) as FeedRow[]); };
  const loadReqs = async () => { const { data } = await sb.rpc("friend_requests_in"); setReqs((data ?? []) as Req[]); };
  useEffect(() => { if (p.registered) { refresh(); loadFeed(); } }, [p.registered]);
  useEffect(() => { if (p.registered) loadReqs(); }, [p.registered, p.reqTick]);
  const looks = useLooks([...(friends ?? []).map((r) => r.user_id), ...reqs.map((r) => r.user_id)]);
  const face = (id: string) => { const l = looks[id]; return l ? <Look avatar={l.avatar} decoration={l.decoration} size={36} /> : <span class="lkph" />; };
  const [busy, run] = useBusy(), oops = () => p.onToast(p.msg.errors.generic!, "err");
  const declineAll = () => run(async () => { const { error } = await sb.rpc("decline_all_friend_requests"); if (error) { oops(); return; } await loadReqs(); p.onReqs?.(); }, oops);
  const answer = (id: string, ok: boolean) => run(async () => { const { error } = await sb.rpc("respond_friend", { p_user: id, p_accept: ok }); if (error) { oops(); return; } if (ok) p.onToast(p.msg.look.nowFriends); await Promise.all([loadReqs(), refresh()]); p.onReqs?.(); }, oops);
  const removeFriend = (id: string) => run(async () => { const { error } = await sb.rpc("remove_friend", { p_friend: id }); setAskId(null); if (error) { oops(); return; } p.onToast(f.removed); await refresh(); }, () => { setAskId(null); oops(); });

  if (!p.registered) return <div class="screen stack"><h1>{p.msg.nav.friends}</h1><div class="card"><Empty icon={Users} title={p.msg.ranking.gate.title} body={p.msg.ranking.gate.body} cta={p.msg.ranking.gate.cta} onCta={p.onAuth} /></div></div>;
  return (
    <div class="screen stack" style="max-width:720px;margin:0 auto;width:100%">
      <h1>{p.msg.nav.friends}</h1>
      <LeaguePanel locale={p.locale} msg={p.msg} registered={p.registered} onProfile={p.onProfile} />
      {reqs.length > 0 && (
        <section class="card stack reqcard">
          <div class="reqhead"><b>{p.msg.look.requests} · {reqs.length}</b>{reqs.length > 2 && <button class="linkbtn" disabled={busy} onClick={declineAll} aria-label={p.msg.look.declineAll} title={p.msg.look.declineAll}><X size={18} /></button>}</div>
          {(showAll ? reqs : reqs.slice(0, 5)).map((r) => (
            <div class="reqrow" key={r.user_id}>
              {face(r.user_id)}
              <button class="grow rowlink" onClick={() => p.onProfile(r.user_id)}><b>{r.display_name || f.anon}</b></button>
              <button class="iconbtn reqno" disabled={busy} aria-label={p.msg.look.decline} onClick={() => answer(r.user_id, false)}><X size={18} /></button>
              <button class="iconbtn reqyes" disabled={busy} aria-label={p.msg.look.accept} onClick={() => answer(r.user_id, true)}><Check size={18} strokeWidth={3} /></button>
            </div>
          ))}
          {reqs.length > 5 && <button class="btn secondary" onClick={() => setShowAll(!showAll)}>{showAll ? p.msg.look.showLess : p.msg.look.showMore(reqs.length - 5)}</button>}
        </section>
      )}
      <button class="btn primary wide" onClick={p.onChallenge}><Swords size={18} />{f.challenge}</button>

      <h2 class="sech">{f.feedTitle}</h2>
      {feed === null && <div class="sk s" />}
      {feed && feed.length === 0 && <p class="hint">{f.feedEmpty}</p>}
      {feed && feed.length > 0 && (
        <div class="list">
          {feed.map((c) => (
            <button key={c.code} class="card pressable stack" style="text-align:left" onClick={() => p.onOpen(c.code)}>
              <b>{c.title}</b>
              <span class="detail">{f.by} {c.creator || f.anon} · {c.stake > 0 ? `${fmtInt(c.stake)} ${f.credits}` : f.noStake} · {f.closesIn} {countdown(Date.parse(c.closes_at) - p.now)}</span>
            </button>
          ))}
        </div>
      )}

      <h2 class="sech">{f.listTitle}{friends ? ` · ${friends.length}` : ""}</h2>
      {friends === null && [0, 1].map((i) => <div class="sk s" key={i} />)}
      {friends && friends.length === 0 && <div class="card"><Empty icon={Users} title={f.empty} body={f.emptyBody} /></div>}
      {friends && friends.length > 0 && (
        <div class="list">
          {friends.map((r) => (
            <div class="row" key={r.user_id}>
              {face(r.user_id)}
              <button class="grow rowlink" onClick={() => p.onProfile(r.user_id)}><span class="nick"><b>{r.display_name || f.anon}</b><LevelBadge level={looks[r.user_id]?.level} msg={p.msg} /></span><PlayerTitle id={looks[r.user_id]?.title} locale={p.locale} /></button>
              <button class="iconbtn frdx" aria-label={`${f.remove} ${r.display_name ?? ""}`} onClick={() => setAskId(askId === r.user_id ? null : r.user_id)}><UserMinus size={16} /></button>
              {askId === r.user_id && <div class="frask" role="alert"><span>{f.removeAsk(r.display_name || f.anon)}</span><button class="btn secondary" onClick={() => setAskId(null)}>{f.removeNo}</button><button class="btn primary" disabled={busy} aria-busy={busy} onClick={() => removeFriend(r.user_id)}>{f.removeYes}</button></div>}
            </div>
          ))}
        </div>
      )}
      <section class="card stack invitecard">
        <div class="invhead"><span class="refico"><Users size={22} /></span><div><b>{f.inviteTitle}</b><p class="hint">{f.inviteBody}</p></div></div>
        {p.referral && <p class="detail">{f.invitedCount(p.referral.invited)}</p>}
        <button class="btn primary wide" disabled={!p.referral} onClick={p.onShareReferral}><Share2 size={18} />{f.inviteBtn}</button>
      </section>
    </div>
  );
}
