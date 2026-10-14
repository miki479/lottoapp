import { Rocket } from "lucide-preact";
import { useState } from "preact/hooks";
import { boostedPayout } from "../../../shared/wallet.ts";
import { useCountUp } from "../lib/anim.ts";
import { haptic } from "../lib/haptics.ts";
import { money } from "../lib/format.ts";
import type { Locale, Messages } from "../i18n/index.ts";
import { moneySigned } from "../lib/num.ts";

const BOOST_WORD: Record<string, string> = { it: "Boost", "en-US": "Boost", "en-GB": "Boost", ja: "ブースト" };
/** The boost: a rocket button with the count, an (i) with the rules, and the extra it would add right now, counted up like the stake. Switching it on fires the rocket. */
export function BoostRow(p: { on: boolean; onToggle: (on: boolean) => void; boosts: number; stake: number; odds: number; locale: Locale; msg: Messages }) {
  const [info, setInfo] = useState(false), [fire, setFire] = useState(0);
  const plain = Math.floor(p.stake * p.odds), boosted = boostedPayout(p.stake, p.odds), extra = Math.max(0, boosted - plain);
  const shown = useCountUp(extra, 450);
  const word = BOOST_WORD[p.locale] ?? "Boost";
  const toggle = () => { const on = !p.on; p.onToggle(on); if (on) { setFire((n) => n + 1); haptic.success(); } else haptic.tap(); };
  return (
    <div class={`boostrow ${p.on ? "on" : ""}`}>
      <button type="button" class="boostbtn" aria-pressed={p.on} aria-label={`${p.msg.boost.toggle}: ${p.boosts}`} onClick={toggle}>
        <span class={`rocket ${fire ? "go" : ""}`} key={fire} aria-hidden="true"><Rocket size={26} /><i class="flame" /></span>
        <b>{word}: {p.boosts}</b>
      </button>
      <button type="button" class="infodot" aria-label={p.msg.boost.title} aria-expanded={info} onClick={() => setInfo(!info)}>i</button>
      <output class="glow pop boostnum" key={extra} aria-live="polite" style={`--hue:${p.on ? 24 : 265};--hot-s:${p.on ? 100 : 60}%;--halo:${p.on ? 22 : 8}px`}>{moneySigned(shown, p.locale)}</output>
      {info && <p class="boostinfo hint" role="note">{p.msg.boost.gain(moneySigned(plain - p.stake, p.locale), moneySigned(boosted - p.stake, p.locale))} · {p.msg.boost.hint}</p>}
    </div>
  );
}

