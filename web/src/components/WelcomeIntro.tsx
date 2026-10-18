import { Gamepad2 } from "lucide-preact";
import { createPortal } from "preact/compat";
import { useEffect, useRef, useState } from "preact/hooks";
import { reducedMotion } from "../lib/anim.ts";
import { fmtInt } from "../lib/num.ts";
import type { Locale } from "../i18n/index.ts";
import { Sheet } from "./Sheet.tsx";

const COINS = 10, GAP_MS = 90, FLIGHT_MS = 750;

type Text = { title: string; sub: string; steps: string[]; gift: (n: string) => string; play: string; note: string };

/**
 * What a first-time visitor sees: how the game works and a gift of credits. Tapping Play sends coins from the button into the wallet in the top bar,
 * and the balance there counts from 1 up to the gift while they fly (`onShown` carries the figure the bar should show), then bursts (`onBurst`) and the welcome ends (`onDone`).
 */
export function WelcomeIntro({ text, amount, coin, locale, onShown, onBurst, onDone }: { text: Text; amount: number; coin: string; locale: Locale; onShown: (n: number) => void; onBurst: () => void; onDone: () => void }) {
  const [flying, setFlying] = useState<DOMRect | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const play = (e: MouseEvent) => {
    if (reducedMotion()) { onShown(amount); onDone(); return; }
    setFlying((e.currentTarget as HTMLElement).getBoundingClientRect());
  };
  useEffect(() => {
    const from = flying, host = layer.current; if (!from || !host) return;
    const target = (document.querySelector(".walletbtn .coin") ?? document.querySelector(".walletbtn"))?.getBoundingClientRect();
    const x0 = from.left + from.width / 2, y0 = from.top + from.height / 2;
    const x1 = target ? target.left + target.width / 2 : innerWidth - 60, y1 = target ? target.top + target.height / 2 : 30;
    let landed = 0, raf = 0; const timers: number[] = [];
    const total = (COINS - 1) * GAP_MS + FLIGHT_MS, t0 = performance.now();
    const count = (t: number) => {
      const p = Math.min(1, (t - t0) / total);
      onShown(Math.max(1, Math.round(amount * p)));
      if (p < 1) raf = requestAnimationFrame(count);
    };
    onShown(1); raf = requestAnimationFrame(count);
    for (let i = 0; i < COINS; i++) {
      const c = document.createElement("i"); c.className = "welcoin"; c.textContent = coin; host.appendChild(c);
      const spread = (i - (COINS - 1) / 2) * 14, lift = 40 + (i % 3) * 22;
      const a = c.animate([
        { transform: `translate(${x0 - 15}px, ${y0 - 15}px) scale(.5)`, opacity: 0 },
        { transform: `translate(${x0 - 15 + spread}px, ${y0 - 15 - lift}px) scale(1.1)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${x1 - 15}px, ${y1 - 15}px) scale(.7)`, opacity: 1 },
      ], { duration: FLIGHT_MS, delay: i * GAP_MS, easing: "cubic-bezier(.5,0,.3,1)", fill: "both" });
      a.onfinish = () => {
        c.remove(); landed++;
        if (landed === COINS) { onShown(amount); onBurst(); timers.push(window.setTimeout(onDone, 900)); }
      };
    }
    return () => { timers.forEach(clearTimeout); cancelAnimationFrame(raf); };
  }, [flying]);
  const finish = () => { onShown(amount); onDone(); };
  return (
    <>
      {!flying && (
        <Sheet onClose={finish} label={text.title}>
          <div class="welcome">
            <h2>{text.title}</h2>
            <p class="wsub">{text.sub}</p>
            <ol class="wsteps">{text.steps.map((s, i) => <li key={i}><span class="hn">{i + 1}</span><span>{s}</span></li>)}</ol>
            <p class="wgift"><i class="coin" aria-hidden="true">{coin}</i>{text.gift(fmtInt(amount, locale))}</p>
            <button class="btn primary wplay" onClick={play}><Gamepad2 size={20} />{text.play}</button>
            <p class="wnote">{text.note}</p>
          </div>
        </Sheet>
      )}
      {createPortal(<div class="welfly" ref={layer} aria-hidden="true" />, document.body)}
    </>
  );
}
