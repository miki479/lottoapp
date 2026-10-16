import { memo, forget } from "../lib/cache.ts";
import { Landmark, Lock, LockOpen } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { BANK_CAP } from "../../../shared/bank.ts";
import type { Locale } from "../i18n/index.ts";
import { INTL_TAG } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { useBusy } from "../lib/busy.ts";
import { money } from "../lib/format.ts";
import { currencySymbol, fmtDec } from "../lib/num.ts";
import { reducedMotion, useCountUp } from "../lib/anim.ts";
import { useNow } from "../lib/clock.ts";
import { countdown } from "../lib/format.ts";
import { Meter } from "./Meter.tsx";

interface BankDeposit { id: string; amount: number; matures_at: string; matured: boolean; mult_bps: number; value: number }
interface BankState { on: boolean; cap: number; locked: number; matured: number; claimable: number; next_maturity: string | null; deposits: BankDeposit[] }

const T = {
  it: { title: "Banca", outside: "Soldi tuoi, ma fuori dal saldo finché non li ritiri", available: "Disponibili", ready: "da ritirare ora", nothingYet: "ancora nulla", unlockOn: (d: string) => `si sblocca il ${d}`, unlockIn: (t: string) => `si sblocca tra ${t}`, noneLocked: "niente in attesa", lockedNote: "non si può usare", locked: "Bloccati", matured: "Maturi", claimable: "Ritirabile ora", claim: "Ritira", next: (d: string) => `Prossima scadenza: ${d}`, mult: "Moltiplicatore", how: "Come funziona", empty: "Il salvadanaio è vuoto.", off: "La banca non è ancora attiva.", fail: "Non è andata. Riprova.", claimed: (a: string) => `Ritirati ${a}`,
    rules: ["Cosa fa: su ogni puntata vinta, il 3% del guadagno (vincita meno puntata) non va subito nel saldo ma in banca.", "Giorni 1-3: i crediti sono bloccati e non si possono ritirare.", "Dal giorno 3 si possono ritirare. Ritirati al giorno 3 tornano uguali (1,00x); poi valgono un po' di più ogni giorno, fino a 1,50x al giorno 14. Dopo il giorno 14 il valore non cresce più, quindi conviene ritirare.", "Esempio: hai un guadagno di 600, in banca vanno 18. Ritirati al giorno 3 sono 18, al giorno 14 sono 27.", `Limite: in banca possono esserci al massimo ${BANK_CAP} crediti; oltre, non viene trattenuto nulla.`, "I giorni si contano da quando quella vincita è entrata in banca. Sono crediti finti, senza valore reale."] },
  "en-US": { title: "Bank", outside: "Yours, but not part of your balance until you claim it", available: "Available", ready: "ready to claim", nothingYet: "nothing yet", unlockOn: (d: string) => `unlocks on ${d}`, unlockIn: (t: string) => `unlocks in ${t}`, noneLocked: "nothing waiting", lockedNote: "cannot be used", locked: "Locked", matured: "Matured", claimable: "Claimable now", claim: "Claim", next: (d: string) => `Next maturity: ${d}`, mult: "Multiplier", how: "How it works", empty: "The vault is empty.", off: "The bank is not active yet.", fail: "Something went wrong. Try again.", claimed: (a: string) => `Claimed ${a}`,
    rules: ["What it does: on every winning bet, 3% of the profit (payout minus stake) does not go to your balance straight away but to the bank.", "Days 1-3: the credits are locked and cannot be claimed.", "From day 3 you can claim them. Claimed on day 3 they come back unchanged (1.00x); after that they are worth a little more each day, up to 1.50x on day 14. After day 14 the value stops growing, so it makes sense to claim.", "Example: you make a profit of 600, 18 go to the bank. Claimed on day 3 that is 18, on day 14 it is 27.", `Limit: the bank holds at most ${BANK_CAP} credits; beyond that nothing is set aside.`, "Days are counted from when that win entered the bank. These are play credits with no real value."] },
  "en-GB": { title: "Bank", outside: "Yours, but not part of your balance until you claim it", available: "Available", ready: "ready to claim", nothingYet: "nothing yet", unlockOn: (d: string) => `unlocks on ${d}`, unlockIn: (t: string) => `unlocks in ${t}`, noneLocked: "nothing waiting", lockedNote: "cannot be used", locked: "Locked", matured: "Matured", claimable: "Claimable now", claim: "Claim", next: (d: string) => `Next maturity: ${d}`, mult: "Multiplier", how: "How it works", empty: "The vault is empty.", off: "The bank is not active yet.", fail: "Something went wrong. Try again.", claimed: (a: string) => `Claimed ${a}`,
    rules: ["What it does: on every winning bet, 3% of the profit (payout minus stake) does not go to your balance straight away but to the bank.", "Days 1-3: the credits are locked and cannot be claimed.", "From day 3 you can claim them. Claimed on day 3 they come back unchanged (1.00x); after that they are worth a little more each day, up to 1.50x on day 14. After day 14 the value stops growing, so it makes sense to claim.", "Example: you make a profit of 600, 18 go to the bank. Claimed on day 3 that is 18, on day 14 it is 27.", `Limit: the bank holds at most ${BANK_CAP} credits; beyond that nothing is set aside.`, "Days are counted from when that win entered the bank. These are play credits with no real value."] },
  ja: { title: "バンク", outside: "あなたのお金ですが、受け取るまで残高には含まれません", available: "受け取り可", ready: "今すぐ受け取れます", nothingYet: "まだありません", unlockOn: (d: string) => `${d}にロック解除`, unlockIn: (t: string) => `あと${t}で解除`, noneLocked: "待機中なし", lockedNote: "使えません", locked: "ロック中", matured: "満期", claimable: "今すぐ受け取れる額", claim: "受け取る", next: (d: string) => `次の満期: ${d}`, mult: "倍率", how: "しくみ", empty: "金庫は空です。", off: "バンクはまだ有効ではありません。", fail: "うまくいきませんでした。もう一度お試しください。", claimed: (a: string) => `${a} を受け取りました`,
    rules: ["しくみ: 勝った予想ごとに、利益(払戻額から賭け金を引いた額)の3%はすぐ残高に入らず、バンクに預けられます。", "1〜3日目: ロックされていて受け取れません。", "3日目から受け取れます。3日目に受け取ると同じ額(1.00倍)、その後は日ごとに少しずつ増え、14日目に1.50倍になります。14日目を過ぎると増えないので、受け取るのがおすすめです。", "例: 利益が600なら18がバンクへ。3日目に受け取ると18、14日目なら27です。", `上限: バンクに入るのは最大${BANK_CAP}クレジットまで。それ以上は預けません。`, "日数は、その勝ち分がバンクに入った時点から数えます。これはゲーム用のクレジットで、実際の価値はありません。"] },
} as const;

/** What the card showed the last time it was open, to play the move from locked to available when something has matured since. */
const KEY = "bank1";
const seenBefore = (): { locked: number; claimable: number } | null => { try { const v = JSON.parse(localStorage.getItem(KEY) ?? "null"); return v && typeof v.locked === "number" && typeof v.claimable === "number" ? v : null; } catch { return null; } };
const remember = (v: { locked: number; claimable: number }) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } };

/**
 * The savings vault as two tiles: what is available now and what is still locked (hatched, with a lock: it cannot be used), the multiplier ramp and the claim
 * button. When a deposit matures, the amount leaves the locked tile and arrives in the available one, a coin crossing between them. All amounts come from my_bank().
 */
export function BankCard({ locale, credits }: { locale: Locale; credits?: number }) {
  const t = T[locale] ?? T["en-US"];
  const [st, setSt] = useState<BankState | null>(null);
  const [busy, run] = useBusy();
  const [note, setNote] = useState("");
  const [how, setHow] = useState(false);
  const [shown, setShown] = useState<{ locked: number; claimable: number } | null>(null), [flight, setFlight] = useState(false);
  const now = useNow(), reloaded = useRef("");
  const apply = (next: BankState) => {
    setSt(next);
    const prev = seenBefore(), moved = prev ? Math.min(Math.max(0, prev.locked - next.locked), Math.max(0, next.claimable - prev.claimable)) : 0;
    if (prev && moved > 0 && !reducedMotion()) {
      setShown(prev); setFlight(true);
      window.setTimeout(() => setShown({ locked: next.locked, claimable: next.claimable }), 700);
      window.setTimeout(() => setFlight(false), 2400);
    } else setShown({ locked: next.locked, claimable: next.claimable });
    remember({ locked: next.locked, claimable: next.claimable });
  };
  const load = () => { forget("my_bank"); return memo("my_bank", 60_000, () => sb.rpc("my_bank")).then(({ data }) => { if (data) apply(data as BankState); }); };
  useEffect(() => { let live = true; memo("my_bank", 60_000, () => sb.rpc("my_bank")).then(({ data }) => { if (live && data) apply(data as BankState); }); return () => { live = false; }; }, [credits]);
  // the moment the next deposit matures the card asks again, so the move plays while it is on screen
  useEffect(() => { const at = st?.next_maturity; if (at && Date.parse(at) <= now && reloaded.current !== at) { reloaded.current = at; void load(); } }, [now, st?.next_maturity]);
  const lockedShown = useCountUp(shown?.locked ?? 0, 900), readyShown = useCountUp(shown?.claimable ?? 0, 900);
  if (!st || (!st.on && st.deposits.length === 0)) return null;
  const best = st.deposits.find((d) => d.matured);
  const bps = best ? Math.max(...st.deposits.filter((d) => d.matured).map((d) => d.mult_bps)) : 10000;
  const claim = () => run(async () => {
    setNote("");
    const { data, error } = await sb.rpc("claim_bank");
    if (error) throw error;
    if (typeof data === "number") { setNote(t.claimed(money(data, locale))); void load(); }
  }, () => setNote(t.fail));
  const day = (iso: string) => new Date(iso).toLocaleDateString(INTL_TAG[locale], { day: "numeric", month: "short" });
  const left = st.next_maturity ? Date.parse(st.next_maturity) - now : null;
  const lockNote = st.locked <= 0 ? t.noneLocked : left !== null && left > 0 && left < 86_400_000 ? t.unlockIn(countdown(left)) : st.next_maturity ? t.unlockOn(day(st.next_maturity)) : t.lockedNote;
  return (
    <section class="card stack bankcard" aria-label={t.title}>
      <div class="srow">
        <span class="bankic"><Landmark size={22} /></span>
        <div class="stxt"><span class="detail">{t.title}</span><b class="num">{money(st.locked + st.matured, locale)}</b><small class="hint">{t.outside}</small></div>
        <span class="grow" />
        <button class="infodot" aria-label={t.how} aria-expanded={how} onClick={() => setHow(!how)}>i</button>
      </div>
      {how && <ul class="hint bankrules">{t.rules.map((r) => <li key={r}>{r}</li>)}</ul>}
      {st.deposits.length === 0 ? <p class="hint">{t.empty}</p> : (
        <>
          <div class="banktiles">
            <div class={`bt avail ${st.claimable > 0 ? "ready" : ""} ${flight ? "got" : ""}`}>
              <span class="bti"><LockOpen size={18} aria-hidden="true" /></span><span class="btl">{t.available}</span>
              <b class="btv num">{money(readyShown, locale)}</b><small>{st.claimable > 0 ? t.ready : t.nothingYet}</small>
            </div>
            <div class={`bt locked ${flight ? "gave" : ""}`} aria-disabled="true">
              <span class="bti"><Lock size={18} aria-hidden="true" /></span><span class="btl">{t.locked}</span>
              <b class="btv num">{money(lockedShown, locale)}</b><small>{lockNote}</small>
            </div>
            {flight && <span class="coinfly" aria-hidden="true">{currencySymbol(locale)}</span>}
          </div>
          <Meter tone="bank" name={t.mult} value={bps / 10000 - 1} max={0.5} label={t.mult} end={`${fmtDec(bps / 10000, 2, locale)}× / ${fmtDec(1.5, 2, locale)}×`} />
          <button class="btn primary wide" disabled={busy || st.claimable <= 0} aria-busy={busy} onClick={claim}>{t.claim}{st.claimable > 0 ? ` ${money(st.claimable, locale)}` : ""}</button>
        </>
      )}
      {note && <p class="hint" role="status">{note}</p>}
      {!st.on && <p class="hint">{t.off}</p>}
    </section>
  );
}
