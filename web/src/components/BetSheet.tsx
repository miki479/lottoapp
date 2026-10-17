import { sb } from "../lib/api.ts";
import { oddsWord } from "../lib/oddsWord.ts";
import { FUN_STAKE, balanceStakeCap, delayStakeCap, singleStakeCap, unlockedStakeCap } from "../../../shared/wallet.ts";
import { BetHead } from "./BetHead.tsx";
import { BetFoot } from "./BetFoot.tsx";
import { MarketVs, noOf, reasonOf } from "./MatchVs.tsx";
import { Crown, Gift, Layers, Share2, Sparkles, UserPlus, X } from "lucide-preact";
import { hubText } from "../lib/shopText.ts";
import { TipPicker } from "./TipPicker.tsx";
import { useEffect, useRef, useState } from "preact/hooks";
import { cityName, cityOf } from "../lib/cities.ts";
import { fmtOdds, isYesNo, money, question, type MarketRow } from "../lib/format.ts";
import { haptic } from "../lib/haptics.ts";
import type { Locale, Messages } from "../i18n/index.ts";
import type { LiveDelay, Pick } from "../lib/types.ts";
import { JoinStep } from "./JoinStep.tsx";
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
import { BoostRow } from "./BoostRow.tsx";
import { offerText, type OfferUse } from "./PersonalOffer.tsx";
import { OFFER_MIN_BASE_ODDS, offerOdds } from "../../../shared/offers.ts";
import { Remind } from "./Remind.tsx";
import { StopsBoard } from "./StopsBoard.tsx";
import { WhyBlock } from "./WhyBlock.tsx";
import { fmtMult } from "../lib/num.ts";

/** Bet slip for one event: pick, stake, then place it (guests do the "last step" sign-up right here when it is required). */
/** Shown near the limit of 40 open bets (closed ones that wait for their result count too), so a refusal never comes as a surprise. */
const OPEN_HINT: Record<string, string> = { it: "Puntate aperte (contano anche quelle in attesa del risultato)", "en-US": "Open bets (those waiting for a result count too)", "en-GB": "Open bets (those waiting for a result count too)", ja: "未決着の予想（結果待ちを含む）" };
export function BetSheet(p: {
  m: MarketRow; initial: Pick; msg: Messages; locale: Locale; credits: number; stakeFactor?: number; ready: boolean; needJoin: boolean; googleOn: boolean; inSlip: boolean; boosts: number; now: number; mm?: number; live?: LiveDelay; occ?: { level: number }; ladder: MarketRow[]; onSwitch: (m: MarketRow) => void;
  onClose: () => void; onAddSlip: (m: MarketRow, pick: Pick) => void; onJoined: () => Promise<void>; onPlace: (m: MarketRow, pick: Pick, stake: number, boost: boolean, bonus?: string | null, vice?: boolean, offerId?: string | null) => Promise<string | null>;
  offer?: OfferUse; openBets?: number; tipFrom?: string | null; canTip?: boolean; unlocked?: boolean;
}) {
  const [tipOpen, setTipOpen] = useState(false);
  // the step of the "sorry for the delay" ladder is chosen here, so every tap on a step re-prices the sheet from that step's own market
  const [rungId, setRungId] = useState<string | null>(() => (p.m.params.ladderOf ? p.m.id : null)), [ladderInfo, setLadderInfo] = useState(false);
  const M = p.ladder.find((r) => r.id === rungId) ?? p.m;
  const [pick, setPick] = useState<Pick>(p.initial);
  const [stake, setStake] = useState(50);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${location.origin}/?m=${M.id}`;
    const text = `${p.msg.maker.shareText} ${question(M, p.msg, p.locale, cityName(city, p.locale), city.timezone)}`;
    sb.rpc("register_share", { p_market: M.id }).then(() => {}, () => {});
    try { if (navigator.share) { await navigator.share({ title: "LateBet", text, url }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(`${text} ${url}`); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* nothing to do */ }
  };
  const [boost, setBoost] = useState(false), [vice, setVice] = useState(false);
  const vicePct = Number((M.params as { viceBonus?: number }).viceBonus ?? 0), exclusive = (M.params as { art?: string }).art === "gta6";
  const [bonus, setBonus] = useState<"free" | "few" | "standing" | null>(null);
  const city = cityOf(M.city_id), isRain = isYesNo(M.kind);
  const offer = p.offer;
  const baseOf = (k: Pick) => Number(k === "yes" ? M.odds_yes : M.odds_no), shownOf = (k: Pick) => (offer ? offerOdds(baseOf(k), offer.mult) : baseOf(k));
  const odds = shownOf(pick);
  // The price moved while the sheet is open: the odds and the figures under them pulse once so the change is noticed.
  const oddsKey = `${M.odds_yes}|${M.odds_no}`, seenOdds = useRef(oddsKey), seenId = useRef(M.id), [bump, setBump] = useState(0);
  useEffect(() => {
    // switching to another step of the same ladder keeps the sheet (and where it is scrolled): that is a new question, not a price that moved
    if (seenId.current !== M.id) { seenId.current = M.id; seenOdds.current = oddsKey; return; }
    if (seenOdds.current !== oddsKey) { seenOdds.current = oddsKey; setBump((n) => n + 1); haptic.tap(); }
  }, [oddsKey, M.id]);
  // Upper limit: what the odds allow (all-but-certain picks are closed), or the whole balance when it is lower (the server checks it again).
  // a personal offer has its own small stake limit instead of the odds-based one, and still refuses a pick whose real quote has become all but certain
  const factor = p.stakeFactor ?? 1;
  const baseCap = offer ? offer.maxStake : p.unlocked ? unlockedStakeCap(odds) : ["bus_delay_gt", "train_delay_gt", "bus_full"].includes(M.kind) ? delayStakeCap(odds) : singleStakeCap(odds);
  // a reduced stake factor (someone who keeps cashing in on near-certain picks) shrinks the limit on such picks, as the server does
  const factored = !offer && baseCap > FUN_STAKE && factor < 1 ? Math.max(FUN_STAKE, Math.floor(baseCap * factor)) : baseCap;
  const oddsCap = offer ? factored : Math.min(factored, balanceStakeCap(p.credits));
  const cap = Math.max(10, p.credits >= 10 ? Math.min(oddsCap, Math.floor(p.credits)) : Math.min(oddsCap, 500));
  const decided = offer ? baseOf(pick) < OFFER_MIN_BASE_ODDS : false, nearly = !offer && oddsCap <= FUN_STAKE;
  const amount = Math.min(stake, cap);
  const going = useRef(false);
  const place = async () => {
    if (going.current) return; // a fast second tap must not send the bet twice
    going.current = true; setBusy(true); setErr(null); haptic.tap();
    let out: string | null;
    try { out = await p.onPlace(M, pick, amount, !offer && boost && p.boosts > 0, !offer && M.params.occBonus ? bonus : null, !offer && vice && vicePct > 0 && pick === "yes", offer?.id ?? null); } catch { out = p.msg.errors.generic!; }
    going.current = false;
    if (out) { setErr(out); setBusy(false); haptic.error(); }
  };
  const label = (k: Pick) => (k === "yes" ? (isRain ? p.msg.card.yes : p.msg.card.late) : (isRain ? p.msg.card.no : p.msg.card.onTime));
  if (joining) return <JoinStep msg={p.msg} locale={p.locale} googleOn={p.googleOn} stakeLabel={money(amount, p.locale)} onBack={() => setJoining(false)} onClose={p.onClose} onJoined={place} />;
  return (
    <Sheet foot onClose={p.onClose} label={p.msg.sheet.title}>
      <div class="shead"><h2>{p.msg.sheet.title}</h2><span class="grow" />{p.canTip && <button class="iconbtn" onClick={() => setTipOpen((v) => !v)} aria-expanded={tipOpen} aria-label={p.msg.tip.btn} title={p.msg.tip.btn}><UserPlus size={20} /></button>}<button class="iconbtn" onClick={share} aria-label={p.msg.maker.share}><Share2 size={20} /></button><button class="iconbtn" onClick={p.onClose} aria-label={p.msg.common.close}><X size={22} /></button></div>
      {p.tipFrom !== undefined && p.tipFrom !== null && <p class="tipbanner" role="status"><UserPlus size={15} />{p.msg.tip.banner(p.tipFrom)}</p>}
      {p.unlocked && !offer && <p class="lbactive" role="status"><Crown size={15} />{hubText(p.locale).shop.supply.limit.on}</p>}
      {tipOpen && <TipPicker marketId={M.id} pick={pick} locale={p.locale} msg={p.msg} />}
      {copied && <p class="hint" role="status">{p.msg.maker.copied}</p>}
      {offer && <div class="pobanner" role="status"><Gift size={18} />{offerText(p.locale).banner(offer.mult, offer.maxStake)}</div>}
      <BetHead m={M} msg={p.msg} locale={p.locale} now={p.now} live={p.live} occ={p.occ} />
      {M.kind === "match_bet" && <div class="vscard"><MarketVs m={M} size={38} />{reasonOf(M, p.msg) && <span class="reason big">{reasonOf(M, p.msg)}</span>}</div>}
      {(M.params as { house?: boolean }).house && <Remind id={M.id} msg={p.msg} />}
      {typeof M.params.by === "string" && M.params.by && <p class="byline">{p.msg.maker.by(M.params.by)}</p>}
      {M.kind === "rain_at" ? <Sky mm={p.mm} hint={pick} msg={p.msg} /> : M.kind === "traffic_speed_lt" ? <TrafficScene m={M} hint={pick} msg={p.msg} /> : M.kind === "match_bet" ? <SportScene m={M} hint={pick} msg={p.msg} /> : M.kind === "tick_gt" ? <TickScene m={M} hint={pick} msg={p.msg} /> : M.kind === "metric_gt" || M.kind === "quake_m" || M.kind === "strike_on" ? <MetricArt m={M} msg={p.msg} hint={pick} /> : M.category === "traffic" ? null : M.kind === "bus_full" ? <OccScene m={M} hint={pick} level={p.occ?.level} msg={p.msg} /> : <TripScene m={M} now={p.now} hint={pick} />}
      <div>
        <span class="detail">{p.msg.sheet.pick}</span>
        <div class={`actions2 ${bump ? "bump" : ""}`} key={`a${bump}`} style="margin-top:8px">
          {(["yes", "no"] as const).map((k) => (
            <button key={k} class={`opt ${k} ${pick === k ? "sel" : ""}`} onClick={() => setPick(k)} aria-pressed={pick === k}>
              <span class="l">{label(k)}</span><b class="num">{fmtOdds(shownOf(k), p.locale)}</b>{M.kind === "match_bet" && (k === "yes" ? reasonOf(M, p.msg) : noOf(M, p.msg)) && <small class="mopt">{k === "yes" ? reasonOf(M, p.msg) : noOf(M, p.msg)}</small>}
            </button>
          ))}
        </div>
        <p class={`oddsword ${bump ? "bump" : ""}`} key={`w${bump}`}>{fmtMult(shownOf(pick), p.locale)} · {oddsWord(shownOf(pick), p.locale)}</p>
      </div>
      {(decided || nearly) && <p class="note warn" role="status">{p.msg.errors.odds_too_low}</p>}
      <WhyBlock m={M} msg={p.msg} locale={p.locale} />
      {p.ladder.length > 0 && (
        <div class="ladder">
          <b>{p.msg.ladder.title}</b>
          <span class="hint">{p.msg.ladder.sub(Math.round(Number(p.ladder[0]!.params.baseDelaySec) / 60))}</span>
          <div class="rungs">
            {!p.m.params.ladderOf && <button class={`rung base ${M.id === p.m.id ? "sel" : ""}`} onClick={() => { setRungId(null); setPick("yes"); }} aria-pressed={M.id === p.m.id}><b>{p.msg.ladder.base}</b><span>≥ +{Math.round(Number(p.m.params.thresholdSec) / 60)}′</span><i class="num">{fmtOdds(Number(p.m.odds_yes), p.locale)}</i></button>}
            {p.ladder.map((r) => (
              <button key={r.id} class={`rung ${r.id === M.id ? "sel" : ""}`} onClick={() => { setRungId(r.id); setPick("yes"); }} aria-pressed={r.id === M.id}>
                <b>+{String(r.params.extraMin)}′</b><span>≥ +{Math.round(Number(r.params.thresholdSec) / 60)}′</span><i class="num">{fmtOdds(Number(r.odds_yes), p.locale)}</i>
              </button>
            ))}
          </div>
          <span class="hint">{p.msg.ladder.estimate}</span>
        </div>
      )}
      <StakeControl value={amount} onChange={setStake} cap={cap} balance={p.credits} odds={odds} boost={boost && p.boosts > 0} vice={vice && pick === "yes" ? vicePct : 0} fancy={exclusive} locale={p.locale} msg={p.msg} />
      {!offer && p.boosts > 0 && <BoostRow on={boost} onToggle={setBoost} boosts={p.boosts} stake={amount} odds={odds} locale={p.locale} msg={p.msg} />}
      {!offer && vicePct > 0 && pick === "yes" && <label class={`boosttoggle vicetoggle ${vice ? "on" : ""}`}><input type="checkbox" checked={vice} onChange={(e) => setVice((e.target as HTMLInputElement).checked)} /><Sparkles size={20} /><span><b>{p.msg.house.viceTitle}</b> · +{vicePct}%<small>{p.msg.house.viceBody(vicePct)}</small></span></label>}
      {!offer && M.params.occBonus === true && M.kind === "bus_delay_gt" && (
        <div class="bonusbox" role="group" aria-label={p.msg.bonus.title}>
          <b>{p.msg.bonus.title}</b><p class="hint">{p.msg.bonus.hint}</p>
          <div class="mkchips wrap">{([null, "free", "few", "standing"] as const).map((k) => <button key={String(k)} type="button" class={`mkchip ${bonus === k ? "on" : ""}`} aria-pressed={bonus === k} onClick={() => setBonus(k)}>{k === null ? p.msg.bonus.none : p.msg.bonus[k]}</button>)}</div>
        </div>
      )}
      {(M.kind === "bus_delay_gt" || M.kind === "train_delay_gt") && <StopsBoard m={M} locale={p.locale} now={p.now} />}
      {(M.params.custom === "true" || M.params.local === "true") && <AreaStats marketId={M.id} msg={p.msg} />}
      {M.kind === "tick_gt" && !(M.params as { house?: boolean }).house && <TickChart m={M} msg={p.msg} locale={p.locale} />}
      {!offer && <button class="btn secondary wide" onClick={() => { p.onAddSlip(M, pick); haptic.tap(); }} disabled={p.inSlip}><Layers size={18} />{p.inSlip ? p.msg.slip.added : p.msg.slip.add}</button>}
      <ReportLink marketId={M.id} msg={p.msg} />
      <BetFoot amount={amount} balance={p.credits} label={`${p.msg.sheet.confirm} · ${money(amount, p.locale)}`} busy={busy} disabled={!p.ready || decided} err={err} msg={p.msg} locale={p.locale} onGo={p.needJoin ? () => setJoining(true) : place} reset={`${pick}|${boost}|${vice}|${bonus}`}>
        {(p.openBets ?? 0) >= 32 && <p class="hint" role="status">{OPEN_HINT[p.locale] ?? OPEN_HINT["en-US"]}: {p.openBets}/40</p>}
      </BetFoot>
    </Sheet>
  );
}
