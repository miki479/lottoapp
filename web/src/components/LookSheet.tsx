import { Check, Lock } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { CITY_AVATARS, CLASSIC_AVATARS, DECORATIONS, FORGED_AVATARS, levelProgress, ROUTE_AVATARS } from "../../../shared/looks";
import type { Messages } from "../i18n/index.ts";
import { useBusy } from "../lib/busy.ts";
import { loadMyAvatars } from "../lib/shop.ts";
import { DEFAULT_AVATARS } from "../../../shared/shop.ts";
import "./RewardsHub.css";
import { forgetLook, loadMyProgress, saveAura, saveLook, type MyProgress } from "../lib/looks.ts";
import { Look } from "./looks/Look.tsx";
import { Sheet } from "./Sheet.tsx";
import { XpInfo } from "./XpInfo.tsx";
import { Meter } from "./Meter.tsx";

/** The "Decorations" sheet: preview on top, the character row, then the grid of rings with their padlocks. */
export function LookSheet({ progress, msg, myId, onClose, onSaved }: { progress: MyProgress; msg: Messages; myId: string; onClose: () => void; onSaved: (p: MyProgress) => void }) {
  const t = msg.look;
  const [xpOpen, setXpOpen] = useState(false), [av, setAv] = useState(progress.avatar), [deco, setDeco] = useState<string | null>(progress.decoration), [err, setErr] = useState(false), [aura, setAura] = useState(!!progress.aura), [ownedAv, setOwnedAv] = useState<string[] | null>(null);
  const [busy, run] = useBusy();
  useEffect(() => { let live = true; loadMyAvatars().then((x) => { if (live) setOwnedAv(x); }); return () => { live = false; }; }, []);
  const avOpen = (a: string) => (ownedAv ? ownedAv.includes(a) : DEFAULT_AVATARS.includes(a) || a === progress.avatar);
  const open = (d: (typeof DECORATIONS)[number]) => (d.level !== undefined && d.level <= progress.level) || progress.owned.includes(d.id);
  const changed = av !== progress.avatar || deco !== progress.decoration || aura !== !!progress.aura;
  const lp = levelProgress(progress.xp);
  const apply = () => run(async () => {
    setErr(false);
    if ((await saveLook(av, deco)) && (aura === !!progress.aura || (await saveAura(aura)))) { forgetLook(myId); const p = await loadMyProgress(); onSaved(p ?? { ...progress, avatar: av, decoration: deco, aura }); onClose(); } else setErr(true);
  }, () => setErr(true));
  return (
    <Sheet onClose={onClose} label={t.title}>
      <div class="lkprev"><Look avatar={av} decoration={deco} aura={aura && progress.level >= 50} size={150} label={t.title} /><b>{t.level(progress.level)}</b>
        <div class="lkxp"><div class="lkxpmain"><Meter tone="brand" name={t.level(progress.level)} value={lp.ratio} end={t.xp(lp.into, lp.need)} /></div><button class="infodot" onClick={() => setXpOpen(true)} aria-label={t.xpHow}>i</button></div></div>
      {progress.level >= 50
        ? <label class="aurarow"><span><b>{t.aura}</b><br /><small>{t.auraHint}</small></span><input type="checkbox" checked={aura} onChange={(e) => setAura((e.target as HTMLInputElement).checked)} aria-label={t.aura} /></label>
        : <div class="aurarow lock"><span><b>{t.aura}</b><br /><small>{t.auraLock}</small></span><Lock size={18} /></div>}
      {xpOpen && <XpInfo msg={msg} onClose={() => setXpOpen(false)} />}
      <h3 class="lkh">{t.avatars}</h3>
      <div class="lkavs">{CLASSIC_AVATARS.map((a) => { const ok = avOpen(a); return <button key={a} class={`lkav ${av === a ? "on" : ""} ${ok ? "" : "lock"}`} aria-pressed={av === a} aria-label={ok ? t.av[a] : `${t.av[a]} · ${t.locked}`} disabled={!ok} onClick={() => setAv(a)}><span class="lkpic"><Look avatar={a} size={52} />{!ok && <span class="lklock"><Lock size={14} /></span>}</span></button>; })}</div>
      <h3 class="lkh">{t.forged}</h3>
      <div class="lkavs">{FORGED_AVATARS.map((a) => { const ok = avOpen(a); return <button key={a} class={`lkav ${av === a ? "on" : ""} ${ok ? "" : "lock"}`} aria-pressed={av === a} aria-label={ok ? t.av[a] : `${t.av[a]} · ${t.locked}`} disabled={!ok} onClick={() => setAv(a)}><span class="lkpic"><Look avatar={a} size={52} />{!ok && <span class="lklock"><Lock size={14} /></span>}</span></button>; })}</div>
      <h3 class="lkh">{t.routes}</h3>
      <div class="lkavs">{ROUTE_AVATARS.map((a) => { const ok = avOpen(a); return <button key={a} class={`lkav ${av === a ? "on" : ""} ${ok ? "" : "lock"}`} aria-pressed={av === a} aria-label={ok ? t.av[a] : `${t.av[a]} · ${t.locked}`} disabled={!ok} onClick={() => setAv(a)}><span class="lkpic"><Look avatar={a} size={52} />{!ok && <span class="lklock"><Lock size={14} /></span>}</span></button>; })}</div>
      <h3 class="lkh">{t.city}</h3>
      <div class="lkavs">{CITY_AVATARS.map((a) => { const ok = avOpen(a); return <button key={a} class={`lkav ${av === a ? "on" : ""} ${ok ? "" : "lock"}`} aria-pressed={av === a} aria-label={ok ? t.av[a] : `${t.av[a]} · ${t.locked}`} disabled={!ok} onClick={() => setAv(a)}><span class="lkpic"><Look avatar={a} size={52} />{!ok && <span class="lklock"><Lock size={14} /></span>}</span></button>; })}</div>
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
