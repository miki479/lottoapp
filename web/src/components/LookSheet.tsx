import { Check, Lock } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { AVATARS, DECORATIONS, levelProgress } from "../../../shared/looks";
import type { Messages } from "../i18n/index.ts";
import { useBusy } from "../lib/busy.ts";
import { loadMyAvatars } from "../lib/shop.ts";
import { DEFAULT_AVATARS } from "../../../shared/shop.ts";
import "./RewardsHub.css";
import { forgetLook, loadMyProgress, saveLook, type MyProgress } from "../lib/looks.ts";
import { Look } from "./looks/Look.tsx";
import { Sheet } from "./Sheet.tsx";
import { XpInfo } from "./XpInfo.tsx";

/** The "Decorations" sheet: preview on top, the character row, then the grid of rings with their padlocks. */
export function LookSheet({ progress, msg, myId, onClose, onSaved }: { progress: MyProgress; msg: Messages; myId: string; onClose: () => void; onSaved: (p: MyProgress) => void }) {
  const t = msg.look;
  const [xpOpen, setXpOpen] = useState(false), [av, setAv] = useState(progress.avatar), [deco, setDeco] = useState<string | null>(progress.decoration), [err, setErr] = useState(false), [ownedAv, setOwnedAv] = useState<string[] | null>(null);
  const [busy, run] = useBusy();
  useEffect(() => { let live = true; loadMyAvatars().then((x) => { if (live) setOwnedAv(x); }); return () => { live = false; }; }, []);
  const avOpen = (a: string) => (ownedAv ? ownedAv.includes(a) : DEFAULT_AVATARS.includes(a) || a === progress.avatar);
  const open = (d: (typeof DECORATIONS)[number]) => (d.level !== undefined && d.level <= progress.level) || progress.owned.includes(d.id);
  const changed = av !== progress.avatar || deco !== progress.decoration;
  const lp = levelProgress(progress.xp);
  const apply = () => run(async () => {
    setErr(false);
    if (await saveLook(av, deco)) { forgetLook(myId); const p = await loadMyProgress(); onSaved(p ?? { ...progress, avatar: av, decoration: deco }); onClose(); } else setErr(true);
  }, () => setErr(true));
  return (
    <Sheet onClose={onClose} label={t.title}>
      <div class="lkprev"><Look avatar={av} decoration={deco} size={150} label={t.title} /><b>{t.level(progress.level)}</b>
        <div class="xpbar" role="progressbar" aria-valuenow={Math.round(lp.ratio * 100)} aria-valuemin={0} aria-valuemax={100}><i style={`width:${Math.round(lp.ratio * 100)}%`} /></div>
        <span class="hint num">{t.xp(lp.into, lp.need)}</span><button class="infodot" onClick={() => setXpOpen(true)} aria-label={t.xpHow}>i</button></div>
      {xpOpen && <XpInfo msg={msg} onClose={() => setXpOpen(false)} />}
      <h3 class="lkh">{t.avatars}</h3>
      <div class="lkavs">{AVATARS.map((a) => { const ok = avOpen(a); return <button key={a} class={`lkav ${av === a ? "on" : ""} ${ok ? "" : "lock"}`} aria-pressed={av === a} aria-label={ok ? t.av[a] : `${t.av[a]} · ${t.locked}`} disabled={!ok} onClick={() => setAv(a)}><span class="lkpic"><Look avatar={a} size={52} />{!ok && <span class="lklock"><Lock size={14} /></span>}</span></button>; })}</div>
      <h3 class="lkh">{t.title}</h3>
      <div class="lkgrid">
        <button class={`lkcell ${deco === null ? "on" : ""}`} aria-pressed={deco === null} onClick={() => setDeco(null)}><Look avatar={av} size={64} /><small>{t.none}</small></button>
        {DECORATIONS.map((d) => {
          const ok = open(d);
          return (
            <button key={d.id} class={`lkcell ${deco === d.id ? "on" : ""} ${ok ? "" : "lock"}`} aria-pressed={deco === d.id} disabled={!ok} onClick={() => setDeco(d.id)}>
              <span class="lkpic"><Look avatar={av} decoration={d.id} size={64} />{!ok && <span class="lklock"><Lock size={16} /></span>}</span>
              <small>{t.deco[d.id]}</small>
              <em class={`rar ${d.rarity}`}>{ok ? t.rarity[d.rarity] : d.level !== undefined ? t.unlockAt(d.level) : t.dropOnly}</em>
            </button>
          );
        })}
      </div>
      {err && <p class="formerr" role="alert">{msg.errors.generic}</p>}
      <button class="btn primary wide" disabled={!changed || busy} aria-busy={busy} onClick={apply}><Check size={18} />{t.apply}</button>
    </Sheet>
  );
}
