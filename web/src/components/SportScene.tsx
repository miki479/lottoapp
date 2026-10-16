import type { Messages } from "../i18n/index.ts";
import type { MarketRow } from "../lib/format.ts";
import { teamName } from "../lib/names.ts";

type Hint = "yes" | "no" | null | undefined;

/** A football pitch: YES sends the ball into the net, NO sends it wide. */
export function SportScene({ m, hint }: { m: MarketRow; hint: Hint; msg: Messages }) {
  return (
    <div class={`mscene sport ${hint === "yes" ? "s-yes" : hint === "no" ? "s-no" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="84" fill="#2f9e5b" />
        <g fill="#2a9254"><rect x="0" width="40" height="84" /><rect x="80" width="40" height="84" /><rect x="160" width="40" height="84" /><rect x="240" width="40" height="84" /></g>
        <g fill="none" stroke="#e9f7ee" stroke-width="2" opacity=".85"><rect x="6" y="6" width="308" height="72" /><path d="M160 6V78" /><circle cx="160" cy="42" r="14" /><rect x="262" y="24" width="52" height="36" /></g>
        <g stroke="#fff" stroke-width="2.500" fill="none"><path d="M314 30V54" /><path d="M314 30h6M314 54h6" /></g>
        <path class="net" d="M314 32 L320 32 L320 52 L314 52" fill="#fff" opacity=".35" />
        <g class="ball"><circle cx="0" cy="0" r="6.500" fill="#fff" stroke="#1d2433" stroke-width="1.200" /><path d="M0 -3.500 L3.200 -1 L2 2.800 H-2 L-3.200 -1 Z" fill="#1d2433" /></g>
      </svg>
      <b>{teamName(String(m.params.home))} – {teamName(String(m.params.away))}</b>
    </div>
  );
}
