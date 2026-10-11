import { Trash2, X } from "lucide-preact";
import { useState } from "preact/hooks";
import { cityName, cityOf } from "../lib/cities.ts";
import { fmtOdds, money, question } from "../lib/format.ts";
import { haptic } from "../lib/haptics.ts";
import type { Locale, Messages } from "../i18n/index.ts";
import type { SlipLeg } from "../lib/types.ts";
import { JoinForm } from "./JoinForm.tsx";
import { Sheet } from "./Sheet.tsx";
import { StakeControl } from "./StakeControl.tsx";

export const slipOdds = (legs: SlipLeg[]) => Math.min(100, legs.reduce((a, l) => a * Number(l.pick === "yes" ? l.m.odds_yes : l.m.odds_no), 1));

export function ParlaySheet(p: {
  legs: SlipLeg[]; msg: Messages; locale: Locale; credits: number; needJoin: boolean; quickJoin: boolean;
  onClose: () => void; onRemove: (id: string) => void; onClear: () => void; onJoined: () => Promise<void>; onPlace: (legs: SlipLeg[], stake: number) => Promise<string | null>;
}) {
  const [stake, setStake] = useState(50);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const odds = slipOdds(p.legs);
  const cap = p.credits >= 10 ? Math.min(500, Math.floor(p.credits)) : 500;
  const amount = Math.min(stake, cap);
  const m = p.msg;
  const place = async () => {
    setBusy(true); setErr(null); haptic.tap();
    const out = await p.onPlace(p.legs, amount);
    if (out) { setErr(out); setBusy(false); haptic.error(); } else haptic.success();
  };
  return (
    <Sheet onClose={p.onClose} label={m.slip.title}>
      <div class="shead"><h2>{m.slip.title} <small class="hint">{m.slip.legs(p.legs.length)}</small></h2><button class="iconbtn" onClick={p.onClose} aria-label={m.common.close}><X size={22} /></button></div>
      <ul class="legs">
        {p.legs.map((l) => {
          const c = cityOf(l.m.city_id), o = Number(l.pick === "yes" ? l.m.odds_yes : l.m.odds_no), rain = l.m.kind === "rain_at";
          const pickLabel = l.pick === "yes" ? (rain ? m.card.yes : m.card.late) : (rain ? m.card.no : m.card.onTime);
          return (
            <li key={l.m.id} class="leg">
              <div class="lq"><span>{question(l.m, m, p.locale, cityName(c, p.locale), c.timezone)}</span><span class="detail">{pickLabel}</span></div>
              <b class="num">{fmtOdds(o, p.locale)}</b>
              <button class="iconbtn" onClick={() => p.onRemove(l.m.id)} aria-label={m.slip.remove}><Trash2 size={18} /></button>
            </li>
          );
        })}
      </ul>
      <div class="summary"><span>{m.slip.odds}</span><b class="num pop" key={odds.toFixed(2)} style="color:var(--c-pop)">{fmtOdds(odds, p.locale)}×</b></div>
      {p.legs.length < 2 && <p class="note">{m.slip.need2}</p>}
      <StakeControl value={amount} onChange={setStake} cap={cap} odds={odds} locale={p.locale} msg={m} />
      <p class="hint">{m.slip.maxWin}</p>
      {err && <p class="formerr" role="alert">{err}</p>}
      {p.needJoin
        ? <JoinForm msg={m} locale={p.locale} quick={p.quickJoin} stakeLabel={money(amount, p.locale)} onJoined={place} />
        : <button class="btn primary wide" disabled={busy || p.legs.length < 2} onClick={place}>{busy ? m.sheet.confirming : `${m.slip.confirm} · ${money(amount, p.locale)}`}</button>}
      <button class="btn secondary wide" onClick={p.onClear}>{m.slip.clear}</button>
    </Sheet>
  );
}
