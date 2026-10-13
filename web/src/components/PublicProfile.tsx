import { Flame, UserCheck, UserPlus, UserX } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import type { Locale, Messages, TrophyId } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { money } from "../lib/format.ts";
import { loadPublicProfile, rememberLook, type PublicProfileData } from "../lib/looks.ts";
import { Trophy3D } from "./looks/Trophy3D.tsx";
import { Look } from "./looks/Look.tsx";
import { Sheet } from "./Sheet.tsx";

/** What another player shows: level, streak, biggest win, trophies. Only what makes you want to catch up: never losses. */
export function PublicProfile({ id, msg, locale, onClose, onToast }: { id: string; msg: Messages; locale: Locale; onClose: () => void; onToast: (s: string) => void }) {
  const t = msg.look;
  const [d, setD] = useState<PublicProfileData | null>(null), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  useEffect(() => { loadPublicProfile(id).then((x) => { if (x) { setD(x); rememberLook(id, { avatar: x.avatar, decoration: x.decoration, level: x.level }); } else setFailed(true); }); }, [id]);
  /** A reload that fails keeps what is already shown. */
  const refresh = async () => { const x = await loadPublicProfile(id); if (x) setD(x); };
  const add = async () => {
    setBusy(true);
    const { data, error } = await sb.rpc("request_friend", { p_user: id });
    setBusy(false);
    if (error) { onToast(msg.errors.generic ?? ""); return; }
    onToast(data === "friends" ? t.nowFriends : t.requestSent);
    await refresh();
  };
  const cancel = async () => {
    setBusy(true);
    const { error } = await sb.rpc("cancel_friend_request", { p_user: id });
    setBusy(false);
    if (error) { onToast(msg.errors.generic ?? ""); return; }
    onToast(t.requestCancelled);
    await refresh();
  };
  return (
    <Sheet onClose={onClose} label={d?.name ?? msg.frd.anon}>
      {!d ? (failed ? <p class="hint">{msg.errors.generic}</p> : <div class="sk s" />) : (
        <>
          <div class="lkprev"><Look avatar={d.avatar} decoration={d.decoration} size={132} /><b style="font-size:20px">{d.name || msg.frd.anon}</b><span class="hint">{t.level(d.level)}</span></div>
          <div class="pstats">
            <div class="card"><Flame size={18} /><b class="num">{d.best_streak}</b><small>{t.streak}</small></div>
            <div class="card"><b class="num">+{money(d.best_win, locale)}</b><small>{t.bestWin}</small></div>
            <div class="card"><b class="num">{d.month_wins}</b><small>{t.monthWins}</small></div>
            {d.balance !== null && <div class="card"><b class="num">{money(d.balance, locale)}</b><small>{t.balanceLabel}</small></div>}
          </div>
          <div class="card ptro"><small>{t.trophies}{d.trophy_count > 0 ? ` · ${d.trophy_count}` : ""}</small>
            {d.trophies.length === 0 ? <span class="hint">{t.noTrophies}</span> : <div class="ptrow">{d.trophies.map((x) => <span key={x} title={msg.profile.trophy[x as TrophyId]?.name}><Trophy3D id={x as TrophyId} have size={44} /></span>)}{d.hidden > 0 && <span class="hint num">+{d.hidden} {t.hiddenWord}</span>}</div>}
          </div>
          {d.relation !== "friends" && d.relation !== "me" && <p class="hint">{t.friendsOnly}</p>}
          {d.relation === "none" && <button class="btn primary wide" disabled={busy} onClick={add}><UserPlus size={18} />{t.addFriend}</button>}
          {d.relation === "received" && <button class="btn primary wide" disabled={busy} onClick={add}><UserPlus size={18} />{t.accept}</button>}
          {d.relation === "sent" && <button class="btn secondary wide" disabled={busy} onClick={cancel}><UserX size={18} />{t.cancelRequest}</button>}
          {d.relation === "friends" && <button class="btn secondary wide" disabled><UserCheck size={18} />{t.isFriend}</button>}
        </>
      )}
    </Sheet>
  );
}
