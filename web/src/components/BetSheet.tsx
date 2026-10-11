import { Layers, X } from "lucide-preact";
import { useState } from "preact/hooks";
import { cityName, cityOf } from "../lib/cities.ts";
import { fmtOdds, money, question, type MarketRow } from "../lib/format.ts";
import { haptic } from "../lib/haptics.ts";
import type { Locale, Messages } from "../i18n/index.ts";
import type { Pick } from "../lib/types.ts";
import { JoinForm } from "./JoinForm.tsx";
import { Sheet } from "./Sheet.tsx";
import { StakeControl } from "./StakeControl.tsx";

/** Bet slip for one event: pick, stake, then place it (guests do the "last step" sign-up right here when it is required). */
export function BetSheet(p: {
  m: MarketRow; initial: Pick; msg: Messages; locale: Locale; credits: number; ready: boolean; needJoin: boolean; googleOn: boolean; inSlip: boolean; ladder: MarketRow[]; onSwitch: (m: MarketRow) => void;
  onClose: () => void; onAddSlip: (m: MarketRow, pick: Pick) => void; onJoined: () => Promise<void>; onPlace: (m: MarketRow, pick: Pick, stake: number) => Promise<string | null>;
}) {
  const [pick, setPick] = useState<Pick>(p.initial);
  const [stake, setStake] = useState(50);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const city = cityOf(p.m.city_id), isRain = p.m.kind === "rain_at";
  const odds = Number(pick === "yes" ? p.m.odds_yes : p.m.odds_no);
  // Upper limit: 500, or the balance when it is known and at least 10 (the server checks it again).
  const cap = p.credits >= 10 ? Math.min(500, Math.floor(p.credits)) : 500;
  const amount = Math.min(stake, cap);
  const place = async () => {
    setBusy(true); setErr(null); haptic.tap();
    const out = await p.onPlace(p.m, pick, amount);
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
            <button key={k} class={`opt ${k} ${pick === k ? "sel" : ""}`} onClick={() => setPick(k)} aria-pressed={pick === k}>
              <span class="l">{label(k)}</span><b class="num">{fmtOdds(Number(k === "yes" ? p.m.odds_yes : p.m.odds_no), p.locale)}</b>
            </button>
          ))}
        </div>
      </div>
      {p.ladder.length > 0 && (
        <div class="ladder">
          <b>{p.msg.ladder.title}</b>
          <span class="hint">{p.msg.ladder.sub(Math.round(Number(p.ladder[0]!.params.baseDelaySec) / 60))}</span>
          <div class="rungs">
            {p.ladder.map((r) => (
              <button key={r.id} class={`rung ${r.id === p.m.id ? "sel" : ""}`} onClick={() => p.onSwitch(r)} aria-pressed={r.id === p.m.id}>
                <b>+{String(r.params.extraMin)}′</b><span>≥ +{Math.round(Number(r.params.thresholdSec) / 60)}′</span><i class="num">{fmtOdds(Number(r.odds_yes), p.locale)}</i>
              </button>
            ))}
          </div>
          <span class="hint">{p.msg.ladder.estimate}</span>
        </div>
      )}
      <StakeControl value={amount} onChange={setStake} cap={cap} odds={odds} locale={p.locale} msg={p.msg} />
      {err && <p class="formerr" role="alert">{err}</p>}
      {p.needJoin
        ? <JoinForm msg={p.msg} locale={p.locale} googleOn={p.googleOn} stakeLabel={money(amount, p.locale)} onJoined={place} />
        : <button class="btn primary wide" disabled={busy || !p.ready} onClick={place}>{busy ? p.msg.sheet.confirming : `${p.msg.sheet.confirm} · ${money(amount, p.locale)}`}</button>}
      <button class="btn secondary wide" onClick={() => { p.onAddSlip(p.m, pick); haptic.tap(); }} disabled={p.inSlip}><Layers size={18} />{p.inSlip ? p.msg.slip.added : p.msg.slip.add}</button>
    </Sheet>
  );
}
