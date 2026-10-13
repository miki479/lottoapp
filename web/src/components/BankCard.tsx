import { Landmark } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { BANK_CAP } from "../../../shared/bank.ts";
import type { Locale } from "../i18n/index.ts";
import { INTL_TAG } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { money } from "../lib/format.ts";

interface BankDeposit { id: string; amount: number; matures_at: string; matured: boolean; mult_bps: number; value: number }
interface BankState { on: boolean; cap: number; locked: number; matured: number; claimable: number; next_maturity: string | null; deposits: BankDeposit[] }

const T = {
  it: { title: "Banca", locked: "Bloccati", matured: "Maturi", claimable: "Ritirabile ora", claim: "Ritira", next: (d: string) => `Prossima scadenza: ${d}`, mult: "Moltiplicatore", how: "Come funziona", empty: "Il salvadanaio è vuoto.", off: "La banca non è ancora attiva.", claimed: (a: string) => `Ritirati ${a}`,
    rules: ["Su ogni vincita la banca trattiene il 3% del profitto (vincita meno puntata).", `Ogni importo resta bloccato 3 giorni; non si può ritirare prima.`, "Dal terzo giorno il moltiplicatore sale da 1,00x a 1,50x al giorno 14, poi resta fermo: aspettare rende un po' di più.", `Nel salvadanaio possono stare al massimo ${BANK_CAP} crediti; oltre, nulla viene trattenuto.`, "Sono crediti finti, nessun valore reale."] },
  "en-US": { title: "Bank", locked: "Locked", matured: "Matured", claimable: "Claimable now", claim: "Claim", next: (d: string) => `Next maturity: ${d}`, mult: "Multiplier", how: "How it works", empty: "The vault is empty.", off: "The bank is not active yet.", claimed: (a: string) => `Claimed ${a}`,
    rules: ["On every win the bank sets aside 3% of the profit (payout minus stake).", "Each amount stays locked for 3 days; no early withdrawal.", "From day 3 the multiplier grows from 1.00x to 1.50x at day 14, then stays flat: waiting pays a little more.", `The vault holds at most ${BANK_CAP} credits; beyond that nothing is set aside.`, "These are play credits with no real value."] },
  "en-GB": { title: "Bank", locked: "Locked", matured: "Matured", claimable: "Claimable now", claim: "Claim", next: (d: string) => `Next maturity: ${d}`, mult: "Multiplier", how: "How it works", empty: "The vault is empty.", off: "The bank is not active yet.", claimed: (a: string) => `Claimed ${a}`,
    rules: ["On every win the bank sets aside 3% of the profit (payout minus stake).", "Each amount stays locked for 3 days; no early withdrawal.", "From day 3 the multiplier grows from 1.00x to 1.50x at day 14, then stays flat: waiting pays a little more.", `The vault holds at most ${BANK_CAP} credits; beyond that nothing is set aside.`, "These are play credits with no real value."] },
  ja: { title: "バンク", locked: "ロック中", matured: "満期", claimable: "今すぐ受け取れる額", claim: "受け取る", next: (d: string) => `次の満期: ${d}`, mult: "倍率", how: "しくみ", empty: "金庫は空です。", off: "バンクはまだ有効ではありません。", claimed: (a: string) => `${a} を受け取りました`,
    rules: ["勝つたびに、利益(払戻額から賭け金を引いた額)の3%を金庫に預けます。", "預けた分は3日間ロックされ、それより前には引き出せません。", "3日目から倍率が上がり、14日目に1.00倍から1.50倍へ。以後は一定です。待つとほんの少し増えます。", `金庫に入るのは最大${BANK_CAP}クレジットまで。それ以上は預けません。`, "これはゲーム用のクレジットで、実際の価値はありません。"] },
} as const;

/** The savings vault: what is locked, what has matured, the multiplier ramp and the claim button. All amounts come from my_bank(). */
export function BankCard({ locale, credits }: { locale: Locale; credits?: number }) {
  const t = T[locale] ?? T["en-US"];
  const [st, setSt] = useState<BankState | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [how, setHow] = useState(false);
  const load = () => sb.rpc("my_bank").then(({ data }) => { if (data) setSt(data as BankState); });
  useEffect(() => { load(); }, [credits]);
  if (!st || (!st.on && st.deposits.length === 0)) return null;
  const best = st.deposits.find((d) => d.matured);
  const bps = best ? Math.max(...st.deposits.filter((d) => d.matured).map((d) => d.mult_bps)) : 10000;
  const pct = Math.round(((bps - 10000) / 5000) * 100);
  const claim = async () => {
    setBusy(true);
    const { data } = await sb.rpc("claim_bank");
    setBusy(false);
    if (typeof data === "number") { setNote(t.claimed(money(data, locale))); load(); }
  };
  const day = (iso: string) => new Date(iso).toLocaleDateString(INTL_TAG[locale], { day: "numeric", month: "short" });
  return (
    <section class="card stack bankcard" aria-label={t.title}>
      <div class="srow">
        <span class="bankic"><Landmark size={22} /></span>
        <div class="stxt"><span class="detail">{t.title}</span><b class="num">{money(st.locked + st.matured, locale)}</b></div>
      </div>
      {st.deposits.length === 0 ? <p class="hint">{t.empty}</p> : (
        <>
          <div class="facts"><div><span class="detail">{t.locked}</span><b class="num">{money(st.locked, locale)}</b></div><div><span class="detail">{t.matured}</span><b class="num">{money(st.matured, locale)}</b></div></div>
          {st.next_maturity && <p class="hint">{t.next(day(st.next_maturity))}</p>}
          <div class="bar" role="progressbar" aria-label={t.mult} aria-valuenow={bps / 10000} aria-valuemin={1} aria-valuemax={1.5}><i style={`width:${pct}%`} /></div>
          <p class="hint">{t.mult}: {(bps / 10000).toFixed(2)}x / 1.50x</p>
          <button class="btn primary wide" disabled={busy || st.claimable <= 0} onClick={claim}>{t.claim}{st.claimable > 0 ? ` ${money(st.claimable, locale)}` : ""}</button>
        </>
      )}
      {note && <p class="hint" role="status">{note}</p>}
      {!st.on && <p class="hint">{t.off}</p>}
      <button class="linkbtn" aria-expanded={how} onClick={() => setHow(!how)}>{t.how}</button>
      {how && <ul class="hint bankrules">{t.rules.map((r) => <li key={r}>{r}</li>)}</ul>}
    </section>
  );
}
