import { Crown, Rocket, Snowflake, Package } from "lucide-preact";
import { useRef, useState } from "preact/hooks";
import { SUPPLIES, supplyFull, type Supply } from "../../../shared/shop.ts";
import { LIMIT_BREAK, limitBreakState } from "../../../shared/wallet.ts";
import { Countdown } from "./Countdown.tsx";
import type { Locale } from "../i18n/index.ts";
import { haptic } from "../lib/haptics.ts";
import { money } from "../lib/format.ts";
import { buyLimitBreak, buySupply, errorCode } from "../lib/shop.ts";
import { hubText } from "../lib/shopText.ts";

const ICON = { boost1: Rocket, boost5: Rocket, freeze1: Snowflake, kit: Package } as const;
const sumOf = (s: Supply, list: readonly Supply[]) => { const single = s.boosts > 0 && s.freezes === 0 ? list.find((x) => x.id === "boost1")!.price * s.boosts : s.id === "kit" ? list.find((x) => x.id === "boost1")!.price * s.boosts + list.find((x) => x.id === "freeze1")!.price * s.freezes : s.price; return Math.round((1 - s.price / single) * 100); };

/** Boosts and freezes for credits, singles and bundles. The server checks the price, the balance and the stock caps again. */
export function Supplies(p: { locale: Locale; credits: number; registered: boolean; boosts: number; freezes: number; limitUntil: string | null; limitAt: string | null; onChanged: () => void }) {
  const s = hubText(p.locale).shop, t = s.supply;
  const [busy, setBusy] = useState<string | null>(null), [note, setNote] = useState<string | null>(null), [err, setErr] = useState<string | null>(null), going = useRef(false);
  const buy = async (x: Supply) => {
    if (going.current) return;
    going.current = true; setBusy(x.id); setErr(null); setNote(null);
    try {
      const r = await buySupply(x.id);
      if ("error" in r) { setErr(s.errors[errorCode(r.error, Object.keys(s.errors))] ?? s.errors.generic!); haptic.error(); return; }
      haptic.success(); setNote(t.bought); p.onChanged();
    } catch { setErr(s.errors.generic!); } finally { going.current = false; setBusy(null); }
  };
  const lb = limitBreakState(p.limitUntil ? Date.parse(p.limitUntil) : null, p.limitAt ? Date.parse(p.limitAt) : null, Date.now());
  const buyLb = async () => {
    if (going.current) return;
    going.current = true; setBusy("limit"); setErr(null); setNote(null);
    try {
      const r = await buyLimitBreak();
      if ("error" in r) { setErr(s.errors[errorCode(r.error, Object.keys(s.errors))] ?? s.errors.generic!); haptic.error(); return; }
      haptic.success(); setNote(t.bought); p.onChanged();
    } catch { setErr(s.errors.generic!); } finally { going.current = false; setBusy(null); }
  };
  const L = t.limit, canLb = p.registered && lb.state === "ready" && p.credits >= LIMIT_BREAK.price;
  return (
    <section class="stack supplies">
      <h3>{t.title}</h3>
      <p class="hint">{t.hint} {t.have(p.boosts, p.freezes)}.</p>
      <div class={`lbcard lb-${lb.state}`}>
        <span class="lbshine" aria-hidden="true" />
        <div class="lbico" aria-hidden="true"><Crown size={30} /></div>
        <div class="lbtxt">
          <b>{L.name}<em class="lbtag">{L.tag}</em></b>
          <span class="lbdesc">{L.desc}</span>
          {lb.state === "active" && <span class="lbstate">{L.active} <b class="num"><Countdown to={lb.endsAt!} /></b></span>}
          {lb.state === "cooling" && <span class="lbstate">{L.cooling} <b class="num"><Countdown to={lb.nextAt!} /></b></span>}
        </div>
        <button class="btn primary lbbtn" disabled={!canLb || busy !== null} aria-busy={busy === "limit"} onClick={buyLb}>
          <span>{lb.state === "ready" ? money(LIMIT_BREAK.price, p.locale) : lb.state === "active" ? "✓" : "…"}</span>
          <em>{lb.state === "ready" ? (p.credits < LIMIT_BREAK.price ? s.notEnough : L.buy) : lb.state === "active" ? L.active.split(",")[0]! : L.cooling.split(":")[0]!}</em>
        </button>
      </div>
      <ul class="pklist">
        {SUPPLIES.map((x) => {
          const Icon = ICON[x.id], [name, desc] = t.names[x.id], save = sumOf(x, SUPPLIES), full = supplyFull(x, p.boosts, p.freezes), can = p.registered && !full && p.credits >= x.price;
          return (
            <li key={x.id} class={`pkrow supply ${x.id} ${full ? "off" : ""}`}>
              <div class="supico" aria-hidden="true"><Icon size={26} /></div>
              <div class="pkinfo"><b>{name}{save > 0 && <em class="dealname">{t.save(save)}</em>}</b><span class="pkodds">{desc}</span></div>
              <button class="btn primary pkbuy" disabled={!p.registered || full || busy !== null} aria-busy={busy === x.id} onClick={() => buy(x)} aria-label={`${name}: ${money(x.price, p.locale)}`}>
                <span>{money(x.price, p.locale)}</span>{full ? <em>{t.full}</em> : !can && p.registered ? <em>{s.notEnough}</em> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {note && <p class="hint" role="status">{note}</p>}
      {err && <p class="dberr" role="alert">{err}</p>}
    </section>
  );
}
