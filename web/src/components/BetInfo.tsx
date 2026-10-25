import { Info, X } from "lucide-preact";
import { useState } from "preact/hooks";
import { INTL_TAG, type Locale } from "../i18n/index.ts";
import { dtf } from "../lib/intl.ts";
import { fmtOdds, money } from "../lib/format.ts";

const T: Record<string, { open: string; placed: string; closes: string; event: string; settled: string; stake: string; odds: string; boost: string; id: string; close: string }> = {
  it: { open: "Info sulla puntata", placed: "Piazzata", closes: "Si chiude", event: "Evento", settled: "Chiusa", stake: "Puntata", odds: "Quota", boost: "Boost attivo", id: "Codice", close: "Chiudi" },
  "en-US": { open: "Bet info", placed: "Placed", closes: "Closes", event: "Event", settled: "Settled", stake: "Stake", odds: "Odds", boost: "Boost on", id: "Code", close: "Close" },
  "en-GB": { open: "Bet info", placed: "Placed", closes: "Closes", event: "Event", settled: "Settled", stake: "Stake", odds: "Odds", boost: "Boost on", id: "Code", close: "Close" },
  ja: { open: "ベットの情報", placed: "ベット時刻", closes: "締切", event: "イベント", settled: "決済", stake: "ベット額", odds: "オッズ", boost: "ブースト適用", id: "コード", close: "閉じる" },
};

/** The small info dot on a bet: when it was placed, when it closes, when the event is, when it was settled, the stake and the odds. */
export function BetInfo({ id, placedAt, closesAt, targetAt, settledAt, stake, odds, boosted, locale }: { id: string; placedAt?: string | null; closesAt?: string | null; targetAt?: string | null; settledAt?: string | null; stake: number; odds: number; boosted?: boolean; locale: Locale }) {
  const [on, setOn] = useState(false), t = T[locale] ?? T["en-US"]!;
  const f = dtf(INTL_TAG[locale], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const when = (iso?: string | null) => (iso && Number.isFinite(Date.parse(iso)) ? f.format(new Date(iso)) : null);
  const rows: [string, string | null][] = [[t.placed, when(placedAt)], [t.closes, when(closesAt)], [t.event, when(targetAt)], [t.settled, when(settledAt)], [t.stake, `${money(stake, locale)} × ${fmtOdds(Number(odds), locale)}`], [t.boost, boosted ? "✓" : null], [t.id, id.slice(0, 8)]];
  return (
    <>
      <button class="betinfo-dot" type="button" aria-label={t.open} title={t.open} aria-expanded={on} data-repeat onClick={() => setOn(!on)}>{on ? <X size={14} /> : <Info size={14} />}</button>
      {on && (
        <dl class="betinfo-pop" role="group" aria-label={t.open}>
          {rows.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd class="num">{v}</dd></div>)}
        </dl>
      )}
    </>
  );
}
