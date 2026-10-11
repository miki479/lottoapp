import { useState } from "preact/hooks";
import { payout } from "../../../shared/wallet.ts";
import { confetti, useCountUp } from "../lib/anim.ts";
import { fmtOdds, question, type MarketRow } from "../lib/format.ts";
import { cityName, cityOf } from "../lib/cities.ts";
import type { Locale, Messages } from "../i18n/index.ts";
import type { Pick } from "../lib/types.ts";

export function BetSheet(p: { m: MarketRow; initial: Pick; msg: Messages; locale: Locale; credits: number; ready: boolean; onClose: () => void; onPlace: (m: MarketRow, pick: Pick, stake: number) => Promise<string | null> }) {
  const [pick, setPick] = useState<Pick>(p.initial);
  const [stake, setStake] = useState(50);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const city = cityOf(p.m.city_id);
  const odds = Number(pick === "yes" ? p.m.odds_yes : p.m.odds_no);
  const win = useCountUp(payout(stake, odds), 350);
  const chips = [25, 50, 100, 250, 500].filter((c) => c <= Math.max(25, p.credits));
  const clamp = (n: number) => Math.max(10, Math.min(500, Math.min(p.credits, n)));
  const isRain = p.m.kind === "rain_at";
  const submit = async (e: MouseEvent) => {
    setBusy(true); setErr(null);
    const r = e.currentTarget as HTMLElement | null, box = r?.getBoundingClientRect();
    const out = await p.onPlace(p.m, pick, stake);
    if (out) { setErr(out); setBusy(false); } else if (box) confetti(box.left + box.width / 2, box.top);
  };
  return (
    <div class="scrim" onClick={p.onClose}>
      <div class="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div class="grab" />
        <p class="q">{question(p.m, p.msg, p.locale, cityName(city, p.locale), city.timezone)}</p>
        <div class="pickrow">
          {(["yes", "no"] as const).map((k) => (
            <button class={`pk ${k} ${pick === k ? "on" : ""}`} onClick={() => setPick(k)}>
              <span>{k === "yes" ? (isRain ? p.msg.pick.yes : p.msg.card.late) : (isRain ? p.msg.pick.no : p.msg.card.onTime)}</span>
              <b>{fmtOdds(Number(k === "yes" ? p.m.odds_yes : p.m.odds_no), p.locale)}×</b>
            </button>
          ))}
        </div>
        <p class="label">{p.msg.sheet.stake}</p>
        <div class="stakeinput">
          <button aria-label="-" onClick={() => setStake(clamp(stake - 10))}>−</button>
          <output>{stake}</output>
          <button aria-label="+" onClick={() => setStake(clamp(stake + 10))}>+</button>
        </div>
        <div class="chipsrow">{chips.map((c) => <button class={stake === c ? "on" : ""} onClick={() => setStake(c)}>{c}</button>)}</div>
        <p class="win">{p.msg.sheet.potential} <b>{win}</b> {p.msg.credits}</p>
        {err && <p class="err" role="alert">{err}</p>}
        <div class="actions">
          <button class="ghost" onClick={p.onClose}>{p.msg.sheet.cancel}</button>
          <button class="primary shine" disabled={busy || !p.ready} onClick={submit}>{busy ? p.msg.sheet.placing : p.msg.sheet.place}</button>
        </div>
      </div>
    </div>
  );
}
