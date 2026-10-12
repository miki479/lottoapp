import { Check, Lock } from "lucide-preact";
import { useState } from "preact/hooks";
import { AVATARS, DECORATIONS, levelProgress } from "../../../shared/looks";
import type { Messages } from "../i18n/index.ts";
import { forgetLook, loadMyProgress, saveLook, type MyProgress } from "../lib/looks.ts";
import { Look } from "./looks/Look.tsx";
import { Sheet } from "./Sheet.tsx";

/** The "Decorations" sheet: preview on top, the character row, then the grid of rings with their padlocks. */
export function LookSheet({ progress, msg, myId, onClose, onSaved }: { progress: MyProgress; msg: Messages; myId: string; onClose: () => void; onSaved: (p: MyProgress) => void }) {
  const t = msg.look;
  const [av, setAv] = useState(progress.avatar), [deco, setDeco] = useState<string | null>(progress.decoration), [busy, setBusy] = useState(false);
  const open = (d: (typeof DECORATIONS)[number]) => (d.level !== undefined && d.level <= progress.level) || progress.owned.includes(d.id);
  const changed = av !== progress.avatar || deco !== progress.decoration;
  const lp = levelProgress(progress.xp);
  const apply = async () => {
    setBusy(true);
    if (await saveLook(av, deco)) { forgetLook(myId); const p = await loadMyProgress(); onSaved(p ?? { ...progress, avatar: av, decoration: deco }); onClose(); } else setBusy(false);
  };
  return (
    <Sheet onClose={onClose} label={t.title}>
      <div class="lkprev"><Look avatar={av} decoration={deco} size={150} label={t.title} /><b>{t.level(progress.level)}</b>
        <div class="xpbar" role="progressbar" aria-valuenow={Math.round(lp.ratio * 100)} aria-valuemin={0} aria-valuemax={100}><i style={`width:${Math.round(lp.ratio * 100)}%`} /></div>
        <span class="hint num">{t.xp(lp.into, lp.need)}</span></div>
      <h3 class="lkh">{t.avatars}</h3>
      <div class="lkavs">{AVATARS.map((a) => <button key={a} class={`lkav ${av === a ? "on" : ""}`} aria-pressed={av === a} aria-label={t.av[a]} onClick={() => setAv(a)}><Look avatar={a} size={52} /></button>)}</div>
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
      <button class="btn primary wide" disabled={!changed || busy} onClick={apply}><Check size={18} />{t.apply}</button>
    </Sheet>
  );
}
