import { Check, Gift, Info, Lock, Snowflake } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import type { Locale } from "../i18n/index.ts";
import { useBusy } from "../lib/busy.ts";
import { haptic } from "../lib/haptics.ts";
import { money } from "../lib/format.ts";
import { claimDaily, errorCode, loadDaily, type DailyState } from "../lib/shop.ts";
import { hubText, milestoneList } from "../lib/shopText.ts";
import { untilReset } from "./RewardsSheet.tsx";
import "./RewardsHub.css";
import { fmtInt } from "../lib/num.ts";

/**
 * The seven-day calendar. It is the streak the game already keeps: streak day n pays 100 x n, claimed once per local day
 * (once a bet has counted today). The server decides everything; this only shows the week and presses "claim".
 */
export function DailyBonus({ locale, now, tz, onPlay, onChanged }: { locale: Locale; now: number; tz: string; onPlay: () => void; onChanged: () => void }) {
  const t = hubText(locale), d = t.daily;
  const [s, setS] = useState<DailyState | null>(null), [busy, run] = useBusy(), [pop, setPop] = useState(false), [err, setErr] = useState<string | null>(null), [info, setInfo] = useState(false);
  const [failed, setFailed] = useState(false);
  const reload = () => loadDaily().then((x) => { if (x) { setS(x); setFailed(false); } else setFailed(true); });
  useEffect(() => { let live = true; loadDaily().then((x) => { if (!live) return; if (x) setS(x); else setFailed(true); }); return () => { live = false; }; }, []);
  if (!s) return <section class="card dbonus" aria-label={d.title}>{failed ? <><p class="dberr" role="alert">{t.shop.errors.generic}</p><button class="btn secondary" onClick={() => { setFailed(false); reload(); }}>{t.album.retry}</button></> : <div class="sk s" />}</section>;
  const cd = s.cycle_day, state = s.claimed ? "done" : s.ready ? "ready" : "lock";
  const go = () => run(async () => {
    setErr(null);
    const r = await claimDaily();
    if ("error" in r) setErr(t.shop.errors[errorCode(r.error, Object.keys(t.shop.errors))] ?? t.shop.errors.generic!);
    else { setPop(true); haptic.success(); setTimeout(() => setPop(false), 1100); onChanged(); }
    await reload();
  }, () => setErr(t.shop.errors.generic!));
  return (
    <section class="card dbonus" aria-label={d.title}>
      <div class="dbhead"><Gift size={18} /><h2>{d.title}</h2><span class="dbreset">{d.resets(untilReset(tz, now))}</span>
        <button class="dbinfo" aria-expanded={info} aria-label={locale === "ja" ? "情報" : "Info"} onClick={() => setInfo((v) => !v)}><Info size={18} /></button></div>
      {info && <div class="dbtext">
        <p class="hint">{d.sub}</p>
        <p class="hint dbnote"><Snowflake size={13} />{d.freezeNote(s.freezes)}</p>
        <p class="hint">{d.milestones(milestoneList(t, (n) => money(n, locale)))}</p>
        <p class="hint">{d.refill}</p>
      </div>}
      <ol class="dbgrid">
        {s.amounts.map((a, i) => {
          const n = i + 1, st = n < cd ? "past" : n === cd ? state : "future";
          return (
            <li key={n} class={`dbtile ${st} ${n === 7 ? "last" : ""} ${n === cd && pop ? "pop" : ""}`} aria-label={`${d.day(n)}: ${money(a, locale)}`} aria-current={n === cd ? "date" : undefined}>
              {n === cd && st === "ready" ? <button class="dbtap" disabled={busy} onClick={go} aria-label={d.claim(money(a, locale))} /> : null}
              <small>{n}</small>
              <b class="num">{fmtInt(a, locale)}</b>
              <span class="dbmark" aria-hidden="true">{st === "past" || st === "done" ? <Check size={18} strokeWidth={3} /> : st === "ready" ? <Gift size={18} /> : st === "lock" ? <Lock size={16} /> : null}</span>
              {n === 7 && <span class="dbfreeze" role="img" title={d.freezeTile} aria-label={d.freezeTile}><Snowflake size={13} /></span>}
            </li>
          );
        })}
      </ol>
      {state === "ready" && <button class="btn primary wide dbbtn" disabled={busy} aria-busy={busy} onClick={go}>{d.claim(money(s.amount, locale))}</button>}
      {state === "done" && <p class="dbdone"><Check size={16} strokeWidth={3} />{d.claimed}</p>}
      {state === "lock" && <div class="dblock"><p>{d.locked(money(s.amount, locale))}</p><button class="btn secondary" onClick={onPlay}>{d.play}</button></div>}
      {err && <p class="dberr" role="alert">{err}</p>}
      {s.lapsed && state === "lock" && <p class="hint">{d.lapsed}</p>}
      {s.uses_freeze && state === "lock" && <p class="hint dbnote"><Snowflake size={13} />{d.usesFreeze}</p>}
    </section>
  );
}
