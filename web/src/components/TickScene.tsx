import type { Messages } from "../i18n/index.ts";
import type { MarketRow } from "../lib/format.ts";

type Hint = "yes" | "no" | null | undefined;

/** Scenes of the "number at an instant" questions: a coin price chart, an aurora sky (Kp index) and page-view bars. */
export function TickScene({ m, hint }: { m: MarketRow; hint: Hint; msg: Messages }) {
  const series = String(m.params.series ?? "");
  const kind = series === "kp" ? "kp" : series.startsWith("wiki:") ? "wiki" : series.startsWith("storm:") ? "storm" : series.startsWith("alert:") ? "alert" : "price";
  const cls = `mscene tick ${kind} ${hint === "yes" ? "s-yes" : hint === "no" ? "s-no" : ""}`;
  const cap = kind === "kp" ? "Kp ≥ " + m.params.threshold : String(m.params.label ?? "");
  if (kind === "kp") {
    return (
      <div class={cls} aria-hidden="true">
        <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="tk-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1030" /><stop offset="1" stop-color="#1b2f4f" /></linearGradient>
            <linearGradient id="tk-aur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5dffb0" stop-opacity="0" /><stop offset=".5" stop-color="#5dffb0" /><stop offset="1" stop-color="#a77bff" stop-opacity=".2" /></linearGradient>
          </defs>
          <rect width="320" height="84" fill="url(#tk-sky)" />
          <g fill="#fff" opacity=".8"><circle cx="30" cy="14" r="1" /><circle cx="84" cy="30" r="1.200" /><circle cx="140" cy="10" r="1" /><circle cx="210" cy="22" r="1.200" /><circle cx="270" cy="12" r="1" /><circle cx="296" cy="34" r="1" /></g>
          <g class="aur"><path class="a1" d="M0 46 C50 10 90 60 150 26 S250 4 320 38 L320 70 L0 70 Z" fill="url(#tk-aur)" /><path class="a2" d="M0 56 C60 30 110 64 170 38 S270 24 320 52 L320 74 L0 74 Z" fill="url(#tk-aur)" /></g>
          <path d="M0 84 L0 68 L40 60 L70 66 L120 56 L170 66 L230 58 L280 64 L320 60 L320 84 Z" fill="#070b18" />
        </svg>
        <b>{cap}</b>
      </div>
    );
  }
  if (kind === "alert") {
    return (
      <div class={cls} aria-hidden="true">
        <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
          <rect width="320" height="84" fill="#9fb4cf" />
          <path d="M0 52Q50 30 100 46T200 40T320 48V84H0Z" fill="#6f9a5c" /><path d="M0 62Q70 48 140 60T320 56V84H0Z" fill="#5b8a4c" />
          <g class="rv-water"><path d="M0 60Q40 54 80 60T160 60T240 60T320 60V84H0Z" fill="#4c8fd6" /><path d="M0 66Q40 61 80 66T160 66T240 66T320 66" stroke="#fff" stroke-width="1.500" fill="none" opacity=".5" /></g>
          <g class="rv-bridge"><rect x="130" y="50" width="60" height="5" fill="#8a7a66" /><rect x="138" y="55" width="5" height="22" fill="#6e6150" /><rect x="177" y="55" width="5" height="22" fill="#6e6150" /></g>
        </svg>
        <b>{cap}</b>
      </div>
    );
  }
  if (kind === "storm") {
    return (
      <div class={cls} aria-hidden="true">
        <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
          <defs><linearGradient id="tk-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3350" /><stop offset="1" stop-color="#16314f" /></linearGradient></defs>
          <rect width="320" height="84" fill="url(#tk-sea)" />
          <path d="M0 70 q20 -6 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 V84 H0Z" fill="#0f2a44" opacity=".9" />
          <g class="spiral" transform="translate(160 40)"><g class="spin">
            <path d="M0 0 C 6 -30 36 -30 38 -4 C 40 18 18 30 -4 24 C -26 18 -30 -10 -10 -22" fill="none" stroke="#e8eefc" stroke-width="7" stroke-linecap="round" opacity=".85" />
            <path d="M0 0 C -6 30 -36 30 -38 4 C -40 -18 -18 -30 4 -24 C 26 -18 30 10 10 22" fill="none" stroke="#cfd9f2" stroke-width="6" stroke-linecap="round" opacity=".7" />
            <circle r="5" fill="#0c1424" />
          </g></g>
        </svg>
        <b>{cap}</b>
      </div>
    );
  }
  if (kind === "wiki") {
    const bars = [34, 26, 40, 30, 38, 28, 36];
    return (
      <div class={cls} aria-hidden="true">
        <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
          <rect width="320" height="84" fill="#eef1f7" />
          <path d="M0 40H320" stroke="#6b7691" stroke-width="1.500" stroke-dasharray="6 5" />
          <g class="wbars">{bars.map((h, i) => <rect key={i} class="wb" style={`--d:${i * 60}ms`} x={26 + i * 40} y={80 - h} width="24" height={h} rx="4" fill="#7b6cf0" />)}</g>
        </svg>
        <b>{cap}</b>
      </div>
    );
  }
  return (
    <div class={cls} aria-hidden="true">
      <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="84" fill="#121a2e" />
        <g stroke="#26324d" stroke-width="1"><path d="M0 20H320M0 62H320M60 0V84M140 0V84M220 0V84M300 0V84" /></g>
        <path d="M0 42H320" stroke="#8ea0c8" stroke-width="1.500" stroke-dasharray="6 5" />
        <g class="pline"><polyline points="0,50 30,44 60,52 90,40 120,47 150,36 180,45 210,38 240,48 270,40 300,44" fill="none" stroke="#f7b733" stroke-width="2.500" stroke-linejoin="round" stroke-linecap="round" /><circle cx="300" cy="44" r="6" fill="#f7b733" /><text x="300" y="47.500" text-anchor="middle" font-size="9" font-weight="800" fill="#121a2e">$</text></g>
      </svg>
      <b>{cap}</b>
    </div>
  );
}
