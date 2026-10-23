import type { Messages } from "../i18n/index.ts";
import type { MarketRow } from "../lib/format.ts";
import { daysUntil } from "../lib/format.ts";
import { useBetCount } from "../lib/betcount.ts";

type Hint = "yes" | "no" | null | undefined;

/**
 * The picture of a question we write ourselves. For "gta6" it is an original sunset with palms and a "VI", drawn here:
 * the colours of the game's world, none of its artwork or logo.
 */
export function HouseScene({ m, hint, msg, now }: { m: MarketRow; hint: Hint; msg: Messages; now: number }) {
  const bets = useBetCount(m.id);
  const days = daysUntil(Number(m.params.releaseAt ?? 0) * 1000 || Date.parse(m.closes_at), now);
  const cls = `mscene tick house gta ${hint === "yes" ? "s-yes" : hint === "no" ? "s-no" : ""}`;
  const palm = (x: number, lean: number, s: number) => (
    <g transform={`translate(${x} 84) scale(${s})`} fill="none" stroke="#2a0d52" stroke-linecap="round">
      <path d={`M0 0Q${lean * 0.3} -34 ${lean} -62`} stroke-width="3.2" />
      <g transform={`translate(${lean} -62)`} stroke-width="2.6">
        <path d="M0 0Q16 -14 34 -4" /><path d="M0 0Q12 -26 30 -26" /><path d="M0 0Q-8 -26 -28 -22" /><path d="M0 0Q-16 -10 -34 0" /><path d="M0 0Q10 8 26 22" /><path d="M0 0Q-10 8 -24 20" />
      </g>
    </g>
  );
  return (
    <div class={cls} aria-hidden="true">
      <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="gt-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16b6ff" /><stop offset=".42" stop-color="#5a62ff" /><stop offset=".7" stop-color="#c23fd9" /><stop offset=".88" stop-color="#ff5d9e" /><stop offset="1" stop-color="#ffb35c" /></linearGradient>
          <linearGradient id="gt-sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe58f" /><stop offset="1" stop-color="#ff5fa6" /></linearGradient>
          <linearGradient id="gt-vi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a5bff" /><stop offset=".55" stop-color="#ff4fa3" /><stop offset="1" stop-color="#ffb35c" /></linearGradient>
          <clipPath id="gt-sunclip"><circle cx="160" cy="58" r="30" /></clipPath>
        </defs>
        <rect width="320" height="84" fill="url(#gt-sky)" />
        <g clip-path="url(#gt-sunclip)"><rect x="120" y="26" width="80" height="64" fill="url(#gt-sun)" /><g fill="#c23fd9">{[56, 63, 69, 74].map((y, i) => <rect key={y} x="120" y={y} width="80" height={1.5 + i * 0.9} />)}</g></g>
        <path d="M0 66Q80 62 160 66T320 66V84H0Z" fill="#3a1470" opacity=".85" /><path d="M0 72Q80 69 160 72T320 72V84H0Z" fill="#240c4f" />
        {palm(34, 10, 0.95)}{palm(292, -12, 0.85)}{palm(70, 6, 0.55)}
        <g class="gt-vi" transform="translate(160 30)" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" fill="url(#gt-vi)">
          <path d="M-26 -18H-14L-8 4L-2 -18H10L-3 22H-13Z" /><path d="M14 -18H26V22H14Z" />
        </g>
      </svg>
      <b>{msg.house.excl}{days > 0 ? ` · ${msg.house.inDays(days)}` : ""}</b>
      {bets !== null && <i class="hs-bets">{msg.house.bets(bets)}</i>}
    </div>
  );
}
