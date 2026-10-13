import { Landmark } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { BANK_CAP } from "../../../shared/bank.ts";
import type { Locale } from "../i18n/index.ts";
import { INTL_TAG } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { useBusy } from "../lib/busy.ts";
import { money } from "../lib/format.ts";

interface BankDeposit { id: string; amount: number; matures_at: string; matured: boolean; mult_bps: number; value: number }
interface BankState { on: boolean; cap: number; locked: number; matured: number; claimable: number; next_maturity: string | null; deposits: BankDeposit[] }

const T = {
  it: { title: "Banca", locked: "Bloccati", matured: "Maturi", claimable: "Ritirabile ora", claim: "Ritira", next: (d: string) => `Prossima scadenza: ${d}`, mult: "Moltiplicatore", how: "Come funziona", empty: "Il salvadanaio è vuoto.", off: "La banca non è ancora attiva.", fail: "Non è andata. Riprova.", claimed: (a: string) => `Ritirati ${a}`,
    rules: ["Cosa fa: su ogni puntata vinta, il 3% del guadagno (vincita meno puntata) non va subito nel saldo ma in banca.", "Giorni 1-3: i crediti sono bloccati e non si possono ritirare.", "Dal giorno 3 si possono ritirare. Ritirati al giorno 3 tornano uguali (1,00x); poi valgono un po' di più ogni giorno, fino a 1,50x al giorno 14. Dopo il giorno 14 il valore non cresce più, quindi conviene ritirare.", "Esempio: hai un guadagno di 600, in banca vanno 18. Ritirati al giorno 3 sono 18, al giorno 14 sono 27.", `Limite: in banca possono esserci al massimo ${BANK_CAP} crediti; oltre, non viene trattenuto nulla.`, "I giorni si contano da quando quella vincita è entrata in banca. Sono crediti finti, senza valore reale."] },
  "en-US": { title: "Bank", locked: "Locked", matured: "Matured", claimable: "Claimable now", claim: "Claim", next: (d: string) => `Next maturity: ${d}`, mult: "Multiplier", how: "How it works", empty: "The vault is empty.", off: "The bank is not active yet.", fail: "Something went wrong. Try again.", claimed: (a: string) => `Claimed ${a}`,
    rules: ["What it does: on every winning bet, 3% of the profit (payout minus stake) does not go to your balance straight away but to the bank.", "Days 1-3: the credits are locked and cannot be claimed.", "From day 3 you can claim them. Claimed on day 3 they come back unchanged (1.00x); after that they are worth a little more each day, up to 1.50x on day 14. After day 14 the value stops growing, so it makes sense to claim.", "Example: you make a profit of 600, 18 go to the bank. Claimed on day 3 that is 18, on day 14 it is 27.", `Limit: the bank holds at most ${BANK_CAP} credits; beyond that nothing is set aside.`, "Days are counted from when that win entered the bank. These are play credits with no real value."] },
  "en-GB": { title: "Bank", locked: "Locked", matured: "Matured", claimable: "Claimable now", claim: "Claim", next: (d: string) => `Next maturity: ${d}`, mult: "Multiplier", how: "How it works", empty: "The vault is empty.", off: "The bank is not active yet.", fail: "Something went wrong. Try again.", claimed: (a: string) => `Claimed ${a}`,
    rules: ["What it does: on every winning bet, 3% of the profit (payout minus stake) does not go to your balance straight away but to the bank.", "Days 1-3: the credits are locked and cannot be claimed.", "From day 3 you can claim them. Claimed on day 3 they come back unchanged (1.00x); after that they are worth a little more each day, up to 1.50x on day 14. After day 14 the value stops growing, so it makes sense to claim.", "Example: you make a profit of 600, 18 go to the bank. Claimed on day 3 that is 18, on day 14 it is 27.", `Limit: the bank holds at most ${BANK_CAP} credits; beyond that nothing is set aside.`, "Days are counted from when that win entered the bank. These are play credits with no real value."] },
  ja: { title: "バンク", locked: "ロック中", matured: "満期", claimable: "今すぐ受け取れる額", claim: "受け取る", next: (d: string) => `次の満期: ${d}`, mult: "倍率", how: "しくみ", empty: "金庫は空です。", off: "バンクはまだ有効ではありません。", fail: "うまくいきませんでした。もう一度お試しください。", claimed: (a: string) => `${a} を受け取りました`,
    rules: ["しくみ: 勝った予想ごとに、利益(払戻額から賭け金を引いた額)の3%はすぐ残高に入らず、バンクに預けられます。", "1〜3日目: ロックされていて受け取れません。", "3日目から受け取れます。3日目に受け取ると同じ額(1.00倍)、その後は日ごとに少しずつ増え、14日目に1.50倍になります。14日目を過ぎると増えないので、受け取るのがおすすめです。", "例: 利益が600なら18がバンクへ。3日目に受け取ると18、14日目なら27です。", `上限: バンクに入るのは最大${BANK_CAP}クレジットまで。それ以上は預けません。`, "日数は、その勝ち分がバンクに入った時点から数えます。これはゲーム用のクレジットで、実際の価値はありません。"] },
} as const;

/** The savings vault: what is locked, what has matured, the multiplier ramp and the claim button. All amounts come from my_bank(). */
export function BankCard({ locale, credits }: { locale: Locale; credits?: number }) {
  const t = T[locale] ?? T["en-US"];
  const [st, setSt] = useState<BankState | null>(null);
  const [busy, run] = useBusy();
  const [note, setNote] = useState("");
  const [how, setHow] = useState(false);
  const load = () => sb.rpc("my_bank").then(({ data }) => { if (data) setSt(data as BankState); });
  useEffect(() => { let live = true; sb.rpc("my_bank").then(({ data }) => { if (live && data) setSt(data as BankState); }); return () => { live = false; }; }, [credits]);
  if (!st || (!st.on && st.deposits.length === 0)) return null;
  const best = st.deposits.find((d) => d.matured);
  const bps = best ? Math.max(...st.deposits.filter((d) => d.matured).map((d) => d.mult_bps)) : 10000;
  const pct = Math.round(((bps - 10000) / 5000) * 100);
  const claim = () => run(async () => {
    setNote("");
    const { data, error } = await sb.rpc("claim_bank");
    if (error) throw error;
    if (typeof data === "number") { setNote(t.claimed(money(data, locale))); load(); }
  }, () => setNote(t.fail));
  const day = (iso: string) => new Date(iso).toLocaleDateString(INTL_TAG[locale], { day: "numeric", month: "short" });
  return (
    <section class="card stack bankcard" aria-label={t.title}>
      <div class="srow">
        <span class="bankic"><Landmark size={22} /></span>
        <div class="stxt"><span class="detail">{t.title}</span><b class="num">{money(st.locked + st.matured, locale)}</b></div>
        <span class="grow" />
        <button class="infodot" aria-label={t.how} aria-expanded={how} onClick={() => setHow(!how)}>i</button>
      </div>
      {how && <ul class="hint bankrules">{t.rules.map((r) => <li key={r}>{r}</li>)}</ul>}
      {st.deposits.length === 0 ? <p class="hint">{t.empty}</p> : (
        <>
          <div class="facts"><div><span class="detail">{t.locked}</span><b class="num">{money(st.locked, locale)}</b></div><div><span class="detail">{t.matured}</span><b class="num">{money(st.matured, locale)}</b></div></div>
          {st.next_maturity && <p class="hint">{t.next(day(st.next_maturity))}</p>}
          <div class="bar" role="progressbar" aria-label={t.mult} aria-valuenow={bps / 10000} aria-valuemin={1} aria-valuemax={1.5}><i style={`width:${pct}%`} /></div>
          <p class="hint">{t.mult}: {(bps / 10000).toFixed(2)}x / 1.50x</p>
          <button class="btn primary wide" disabled={busy || st.claimable <= 0} aria-busy={busy} onClick={claim}>{t.claim}{st.claimable > 0 ? ` ${money(st.claimable, locale)}` : ""}</button>
        </>
      )}
      {note && <p class="hint" role="status">{note}</p>}
      {!st.on && <p class="hint">{t.off}</p>}
    </section>
  );
}
