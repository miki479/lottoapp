import { sb } from "../lib/api.ts";
import { oddsWord } from "../lib/oddsWord.ts";
import { FUN_STAKE, balanceStakeCap, stakeCap } from "../../../shared/wallet.ts";
import { Q } from "./Q.tsx";
import { MarketVs, noOf, reasonOf } from "./MatchVs.tsx";
import { Gift, Layers, Rocket, Share2, Sparkles, X } from "lucide-preact";
import { useState } from "preact/hooks";
import { cityName, cityOf } from "../lib/cities.ts";
import { fmtOdds, isYesNo, money, question, type MarketRow } from "../lib/format.ts";
import { haptic } from "../lib/haptics.ts";
import type { Locale, Messages } from "../i18n/index.ts";
import type { Pick } from "../lib/types.ts";
import { JoinStep } from "./JoinStep.tsx";
import { boostedPayout } from "../../../shared/wallet.ts";
import { ReportLink } from "./ReportLink.tsx";
import { Sheet } from "./Sheet.tsx";
import { MetricArt } from "./MetricArt.tsx";
import { TrafficScene } from "./TrafficScene.tsx";
import { TickScene } from "./TickScene.tsx";
import { SportScene } from "./SportScene.tsx";
import { TickChart } from "./TickChart.tsx";
import { AreaStats } from "./AreaStats.tsx";
import { Sky } from "./Sky.tsx";
import { OccScene } from "./OccScene.tsx";
import { TripScene } from "./TripScene.tsx";
import { StakeControl } from "./StakeControl.tsx";
import { offerText, type OfferUse } from "./PersonalOffer.tsx";
import { OFFER_MIN_BASE_ODDS, offerOdds } from "../../../shared/offers.ts";
import { Remind } from "./Remind.tsx";
import { StopsBoard } from "./StopsBoard.tsx";

/** Bet slip for one event: pick, stake, then place it (guests do the "last step" sign-up right here when it is required). */
export function BetSheet(p: {
  m: MarketRow; initial: Pick; msg: Messages; locale: Locale; credits: number; stakeFactor?: number; ready: boolean; needJoin: boolean; googleOn: boolean; inSlip: boolean; boosts: number; now: number; mm?: number; occ?: { level: number }; ladder: MarketRow[]; onSwitch: (m: MarketRow) => void;
  onClose: () => void; onAddSlip: (m: MarketRow, pick: Pick) => void; onJoined: () => Promise<void>; onPlace: (m: MarketRow, pick: Pick, stake: number, boost: boolean, bonus?: string | null, vice?: boolean, offerId?: string | null) => Promise<string | null>;
  offer?: OfferUse;
}) {
  const [pick, setPick] = useState<Pick>(p.initial);
  const [stake, setStake] = useState(50);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${location.origin}/?m=${p.m.id}`;
    const text = `${p.msg.maker.shareText} ${question(p.m, p.msg, p.locale, cityName(city, p.locale), city.timezone)}`;
    sb.rpc("register_share", { p_market: p.m.id }).then(() => {}, () => {});
    try { if (navigator.share) { await navigator.share({ title: "LateLotto", text, url }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(`${text} ${url}`); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* nothing to do */ }
  };
  const [boost, setBoost] = useState(false), [vice, setVice] = useState(false);
  const vicePct = Number((p.m.params as { viceBonus?: number }).viceBonus ?? 0), exclusive = (p.m.params as { art?: string }).art === "gta6";
  const [bonus, setBonus] = useState<"free" | "few" | "standing" | null>(null);
  const city = cityOf(p.m.city_id), isRain = isYesNo(p.m.kind);
  const offer = p.offer;
  const baseOf = (k: Pick) => Number(k === "yes" ? p.m.odds_yes : p.m.odds_no), shownOf = (k: Pick) => (offer ? offerOdds(baseOf(k), offer.mult) : baseOf(k));
  const odds = shownOf(pick);
  // Upper limit: what the odds allow (all-but-certain picks are closed), or the whole balance when it is lower (the server checks it again).
  // a personal offer has its own small stake limit instead of the odds-based one, and still refuses a pick whose real quote has become all but certain
  const factor = p.stakeFactor ?? 1;
  const baseCap = offer ? offer.maxStake : ["bus_delay_gt", "train_delay_gt", "bus_full"].includes(p.m.kind) ? Math.min(stakeCap(odds), 1000) : stakeCap(odds);
  // a reduced stake factor (someone who keeps cashing in on near-certain picks) shrinks the limit on such picks, as the server does
  const factored = !offer && baseCap > FUN_STAKE && factor < 1 ? Math.max(FUN_STAKE, Math.floor(baseCap * factor)) : baseCap;
  const oddsCap = offer ? factored : Math.min(factored, balanceStakeCap(p.credits));
  const cap = Math.max(10, p.credits >= 10 ? Math.min(oddsCap, Math.floor(p.credits)) : Math.min(oddsCap, 500));
  const decided = offer ? baseOf(pick) < OFFER_MIN_BASE_ODDS : false, nearly = !offer && oddsCap <= FUN_STAKE;
  const amount = Math.min(stake, cap);
  const place = async () => {
    setBusy(true); setErr(null); haptic.tap();
    const out = await p.onPlace(p.m, pick, amount, !offer && boost && p.boosts > 0, !offer && p.m.params.occBonus ? bonus : null, !offer && vice && vicePct > 0 && pick === "yes", offer?.id ?? null);
    if (out) { setErr(out); setBusy(false); haptic.error(); } else haptic.success();
  };
  const label = (k: Pick) => (k === "yes" ? (isRain ? p.msg.card.yes : p.msg.card.late) : (isRain ? p.msg.card.no : p.msg.card.onTime));
  if (joining) return <JoinStep msg={p.msg} locale={p.locale} googleOn={p.googleOn} stakeLabel={money(amount, p.locale)} onBack={() => setJoining(false)} onClose={p.onClose} onJoined={place} />;
  return (
    <Sheet onClose={p.onClose} label={p.msg.sheet.title}>
      <div class="shead"><h2>{p.msg.sheet.title}</h2><span class="grow" /><button class="iconbtn" onClick={share} aria-label={p.msg.maker.share}><Share2 size={20} /></button><button class="iconbtn" onClick={p.onClose} aria-label={p.msg.common.close}><X size={22} /></button></div>
      {copied && <p class="hint" role="status">{p.msg.maker.copied}</p>}
      {p.m.kind === "match_bet" && <div class="vscard"><MarketVs m={p.m} size={38} />{reasonOf(p.m, p.msg) && <span class="reason big">{reasonOf(p.m, p.msg)}</span>}</div>}
      {offer && <div class="pobanner" role="status"><Gift size={18} />{offerText(p.locale).banner(offer.mult, offer.maxStake)}</div>}
      <p class="q" style="font-weight:600"><Q m={p.m} msg={p.msg} locale={p.locale} city={cityName(city, p.locale)} tz={city.timezone} /></p>
      {(p.m.params as { house?: boolean }).house && <Remind id={p.m.id} msg={p.msg} />}
      {typeof p.m.params.by === "string" && p.m.params.by && <p class="byline">{p.msg.maker.by(p.m.params.by)}</p>}
      {p.m.kind === "rain_at" ? <Sky mm={p.mm} hint={pick} msg={p.msg} /> : p.m.kind === "traffic_speed_lt" ? <TrafficScene m={p.m} hint={pick} msg={p.msg} /> : p.m.kind === "match_bet" ? <SportScene m={p.m} hint={pick} msg={p.msg} /> : p.m.kind === "tick_gt" ? <TickScene m={p.m} hint={pick} msg={p.msg} /> : p.m.kind === "metric_gt" || p.m.kind === "quake_m" || p.m.kind === "strike_on" ? <MetricArt m={p.m} msg={p.msg} hint={pick} /> : p.m.category === "traffic" ? null : p.m.kind === "bus_full" ? <OccScene m={p.m} hint={pick} level={p.occ?.level} msg={p.msg} /> : <TripScene m={p.m} now={p.now} hint={pick} big />}
      {(p.m.kind === "bus_delay_gt" || p.m.kind === "train_delay_gt") && <StopsBoard m={p.m} locale={p.locale} now={p.now} />}
      {(p.m.params.custom === "true" || p.m.params.local === "true") && <AreaStats marketId={p.m.id} msg={p.msg} />}
      {p.m.kind === "tick_gt" && !(p.m.params as { house?: boolean }).house && <TickChart m={p.m} msg={p.msg} locale={p.locale} />}
      <div>
        <span class="detail">{p.msg.sheet.pick}</span>
        <div class="actions2" style="margin-top:8px">
          {(["yes", "no"] as const).map((k) => (
            <button key={k} class={`opt ${k} ${pick === k ? "sel" : ""}`} onClick={() => setPick(k)} aria-pressed={pick === k}>
              <span class="l">{label(k)}</span><b class="num">{fmtOdds(shownOf(k), p.locale)}</b>{p.m.kind === "match_bet" && (k === "yes" ? reasonOf(p.m, p.msg) : noOf(p.m, p.msg)) && <small class="mopt">{k === "yes" ? reasonOf(p.m, p.msg) : noOf(p.m, p.msg)}</small>}
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
      {!offer && p.m.params.occBonus === true && p.m.kind === "bus_delay_gt" && (
        <div class="bonusbox" role="group" aria-label={p.msg.bonus.title}>
          <b>{p.msg.bonus.title}</b><p class="hint">{p.msg.bonus.hint}</p>
          <div class="mkchips wrap">{([null, "free", "few", "standing"] as const).map((k) => <button key={String(k)} type="button" class={`mkchip ${bonus === k ? "on" : ""}`} aria-pressed={bonus === k} onClick={() => setBonus(k)}>{k === null ? p.msg.bonus.none : p.msg.bonus[k]}</button>)}</div>
        </div>
      )}
      {!offer && vicePct > 0 && pick === "yes" && <label class={`boosttoggle vicetoggle ${vice ? "on" : ""}`}><input type="checkbox" checked={vice} onChange={(e) => setVice((e.target as HTMLInputElement).checked)} /><Sparkles size={20} /><span><b>{p.msg.house.viceTitle}</b> · +{vicePct}%<small>{p.msg.house.viceBody(vicePct)}</small></span></label>}
      <p class="oddsword">{fmtOdds(shownOf(pick), p.locale)}× · {oddsWord(shownOf(pick), p.locale)}</p>
      {(decided || nearly) && <p class="note warn" role="status">{p.msg.errors.odds_too_low}</p>}
      <StakeControl value={amount} onChange={setStake} cap={cap} balance={p.credits} odds={odds} boost={boost && p.boosts > 0} vice={vice && pick === "yes" ? vicePct : 0} fancy={exclusive} locale={p.locale} msg={p.msg} />
      {!offer && p.boosts > 0 && <label class={`boosttoggle ${boost ? "on" : ""}`}><input type="checkbox" checked={boost} onChange={(e) => setBoost((e.target as HTMLInputElement).checked)} /><Rocket size={20} /><span><b>{p.msg.boost.toggle}</b> · {p.msg.boost.have(p.boosts)}<small>{p.msg.boost.gain("+" + money(Math.floor(amount * odds) - amount, p.locale), "+" + money(boostedPayout(amount, odds) - amount, p.locale))} · {p.msg.boost.hint}</small></span></label>}
      {err && <p class="formerr" role="alert">{err}</p>}
      <button class="btn primary wide" disabled={busy || !p.ready || decided} onClick={p.needJoin ? () => setJoining(true) : place}>{busy ? p.msg.sheet.confirming : `${p.msg.sheet.confirm} · ${money(amount, p.locale)}`}</button>
      {!offer && <button class="btn secondary wide" onClick={() => { p.onAddSlip(p.m, pick); haptic.tap(); }} disabled={p.inSlip}><Layers size={18} />{p.inSlip ? p.msg.slip.added : p.msg.slip.add}</button>}
      <ReportLink marketId={p.m.id} msg={p.msg} />
    </Sheet>
  );
}
