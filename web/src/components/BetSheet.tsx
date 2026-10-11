import { Minus, Plus, X } from "lucide-preact";
import { useState } from "preact/hooks";
import { payout } from "../../../shared/wallet.ts";
import { cityName, cityOf } from "../lib/cities.ts";
import { useCountUp } from "../lib/anim.ts";
import { fmtOdds, question, type MarketRow } from "../lib/format.ts";
import { haptic } from "../lib/haptics.ts";
import type { Locale, Messages } from "../i18n/index.ts";
import type { Pick } from "../lib/types.ts";
import { Sheet } from "./Sheet.tsx";

export function BetSheet(p: { m: MarketRow; initial: Pick; msg: Messages; locale: Locale; credits: number; ready: boolean; onClose: () => void; onPlace: (m: MarketRow, pick: Pick, stake: number) => Promise<string | null> }) {
  const [pick, setPick] = useState<Pick>(p.initial);
  const [stake, setStake] = useState(50);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const city = cityOf(p.m.city_id), isRain = p.m.kind === "rain_at";
  const odds = Number(pick === "yes" ? p.m.odds_yes : p.m.odds_no);
  const win = useCountUp(payout(stake, odds), 250);
  const clamp = (n: number) => Math.max(10, Math.min(500, Math.min(Math.max(10, p.credits), n)));
  const quick = [25, 50, 100, 250, 500].filter((c) => c <= Math.max(25, p.credits));
  const submit = async () => {
    setBusy(true); setErr(null); haptic.tap();
    const out = await p.onPlace(p.m, pick, stake);
    if (out) { setErr(out); setBusy(false); haptic.error(); } else haptic.success();
  };
  const label = (k: Pick) => (k === "yes" ? (isRain ? p.msg.card.yes : p.msg.card.late) : (isRain ? p.msg.card.no : p.msg.card.onTime));
  return (
    <Sheet onClose={p.onClose} label={p.msg.sheet.title}>
      <div class="shead"><h2>{p.msg.sheet.title}</h2><button class="iconbtn" onClick={p.onClose} aria-label={p.msg.common.close}><X size={22} /></button></div>
      <p class="q" style="font-weight:600">{question(p.m, p.msg, p.locale, cityName(city, p.locale), city.timezone)}</p>
      <div>
        <span class="detail">{p.msg.sheet.pick}</span>
        <div class="actions2" style="margin-top:8px">
          {(["yes", "no"] as const).map((k) => (
            <button key={k} class={`opt ${pick === k ? "sel" : ""}`} onClick={() => setPick(k)} aria-pressed={pick === k}>
              <span class="l">{label(k)}</span><b>{fmtOdds(Number(k === "yes" ? p.m.odds_yes : p.m.odds_no), p.locale)}</b>
            </button>
          ))}
        </div>
      </div>
      <div>
        <span class="detail">{p.msg.sheet.stake}</span>
        <div class="stepper" style="margin:8px 0">
          <button aria-label="−10" onClick={() => setStake(clamp(stake - 10))}><Minus size={20} /></button>
          <output aria-live="polite">{stake}</output>
          <button aria-label="+10" onClick={() => setStake(clamp(stake + 10))}><Plus size={20} /></button>
        </div>
        <div class="quick">{quick.map((c) => <button key={c} class={stake === c ? "on" : ""} onClick={() => setStake(c)}>{c}</button>)}</div>
      </div>
      <div class="summary"><span class="detail">{p.msg.sheet.potential}</span><b>{win}</b></div>
      {err && <p class="formerr" role="alert">{err}</p>}
      <button class="btn primary wide" disabled={busy || !p.ready} onClick={submit}>{busy ? p.msg.sheet.confirming : p.msg.sheet.confirm}</button>
    </Sheet>
  );
}
