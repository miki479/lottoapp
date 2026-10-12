import type { Messages } from "../i18n/index.ts";
import type { MarketRow } from "../lib/format.ts";

type Hint = "yes" | "no" | null | undefined;

/** Scenes of the "number at an instant" questions: a coin price chart, an aurora sky (Kp index) and page-view bars. */
export function TickScene({ m, hint, msg }: { m: MarketRow; hint: Hint; msg: Messages }) {
  const series = String(m.params.series ?? "");
  const kind = series === "kp" ? "kp" : series.startsWith("wiki:") ? "wiki" : series.startsWith("storm:") ? "storm" : series.startsWith("alert:") ? "alert" : series.startsWith("metal:") ? "metal" : series.startsWith("fuel:") ? "fuel" : series.startsWith("oil:") ? "oil" : "price";
  const cls = `mscene tick ${kind} ${hint === "yes" ? "s-yes" : hint === "no" ? "s-no" : ""}`;
  const cap = kind === "kp" ? "Kp ≥ " + m.params.threshold : msg.cm[String(m.params.label ?? "")] ?? String(m.params.label ?? "");
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
  if (kind === "metal") {
    const k = series.slice(6), pal = ({ xau: ["#ffe08a", "#d9961c"], xag: ["#f2f5fa", "#9aa7bb"], xpt: ["#eef3f9", "#aebccc"], hg: ["#f0a678", "#b45a2e"] } as Record<string, string[]>)[k] ?? ["#ffe08a", "#d9961c"];
    const bar = (x: number, y: number, w: number) => (
      <g key={`${x}${y}`}>
        <path d={`M${x + 7} ${y}H${x + w - 7}L${x + w} ${y + 17}H${x}Z`} fill="url(#mt-bar)" /><path d={`M${x + 7} ${y}H${x + w - 7}L${x + w - 10} ${y + 5}H${x + 10}Z`} fill="#fff" opacity=".4" />
        <path d={`M${x} ${y + 17}H${x + w}`} stroke="#000" opacity=".22" stroke-width="1.500" />
      </g>
    );
    const spark = (x: number, y: number, d: number) => <path key={`${x}`} class="mtspark" style={`--d:${d}ms`} d={`M${x} ${y - 6}L${x + 1.600} ${y - 1.600}L${x + 6} ${y}L${x + 1.600} ${y + 1.600}L${x} ${y + 6}L${x - 1.600} ${y + 1.600}L${x - 6} ${y}L${x - 1.600} ${y - 1.600}Z`} fill="#fff" />;
    return (
      <div class={cls} aria-hidden="true">
        <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="mt-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a2035" /><stop offset="1" stop-color="#0e1322" /></linearGradient>
            <linearGradient id="mt-bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={`stop-color:${pal[0]}`} /><stop offset="1" style={`stop-color:${pal[1]}`} /></linearGradient>
            <clipPath id="mt-clip"><path d="M89 62H161L168 79H82Z M165 62H237L244 79H158Z M127 42H199L206 59H120Z" /></clipPath>
          </defs>
          <rect width="320" height="84" fill="url(#mt-bg)" />
          <ellipse cx="163" cy="80" rx="96" ry="4" fill="#000" opacity=".35" />
          <g class="mtstack">{bar(82, 62, 86)}{bar(158, 62, 86)}{bar(120, 42, 86)}
            <g clip-path="url(#mt-clip)"><rect class="mtshine" x="-40" y="30" width="26" height="60" fill="#fff" opacity=".55" transform="skewX(-22)" /></g>
          </g>
          {spark(70, 28, 0)}{spark(258, 22, 700)}{spark(226, 50, 1400)}{spark(104, 14, 2100)}
        </svg>
        <b>{cap}</b>
      </div>
    );
  }
  if (kind === "fuel") {
    return (
      <div class={cls} aria-hidden="true">
        <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
          <defs><linearGradient id="fu-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2236" /><stop offset="1" stop-color="#10152a" /></linearGradient></defs>
          <rect width="320" height="84" fill="url(#fu-bg)" />
          <path d="M0 76H320" stroke="#3a4468" stroke-width="2" />
          <g class="fugauge" transform="translate(74 58)">
            <path d="M-34 0A34 34 0 0 1 34 0" fill="none" stroke="#3a4468" stroke-width="7" stroke-linecap="round" /><path d="M-34 0A34 34 0 0 1 -11 -32" fill="none" stroke="#3ecf8e" stroke-width="7" stroke-linecap="round" /><path d="M11 -32A34 34 0 0 1 34 0" fill="none" stroke="#ff6b5a" stroke-width="7" stroke-linecap="round" />
            <g class="funeedle"><path d="M0 0L0 -28" stroke="#f4f7ff" stroke-width="3" stroke-linecap="round" /><circle r="4.500" fill="#f4f7ff" /></g>
          </g>
          <g transform="translate(176 12)">
            <rect x="0" y="0" width="54" height="64" rx="7" fill="#e8453c" /><rect x="6" y="6" width="42" height="20" rx="3" fill="#0f2a1e" />
            <text class="fudig" x="27" y="20.500" text-anchor="middle" font-size="11" font-weight="800" fill="#46f0a1" font-family="ui-monospace,monospace" textLength="36" lengthAdjust="spacingAndGlyphs">{Number(m.params.forecast).toFixed(3)}</text>
            <rect x="8" y="34" width="38" height="5" rx="2" fill="#fff" opacity=".35" /><rect x="8" y="44" width="38" height="5" rx="2" fill="#fff" opacity=".2" />
            <path d="M54 30C70 30 74 44 76 60" fill="none" stroke="#1d2433" stroke-width="4" stroke-linecap="round" /><path d="M72 58L80 58L82 70L70 70Z" fill="#f4f7ff" />
            <circle class="fudrop" cx="76" cy="72" r="2.600" fill="#ffd24a" />
          </g>
        </svg>
        <b>{cap}</b>
      </div>
    );
  }
  if (kind === "oil") {
    return (
      <div class={cls} aria-hidden="true">
        <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="oi-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26304a" /><stop offset="1" stop-color="#101627" /></linearGradient>
            <clipPath id="oi-clip"><rect x="222" y="26" width="40" height="46" rx="5" /></clipPath>
          </defs>
          <rect width="320" height="84" fill="url(#oi-bg)" />
          <path d="M0 74H320V84H0Z" fill="#0b0f1c" /><path d="M0 74H320" stroke="#3a4468" stroke-width="2" />
          <path d="M126 74L150 38L174 74" fill="none" stroke="#c9d2e6" stroke-width="4" stroke-linejoin="round" /><path d="M136 62H164" stroke="#c9d2e6" stroke-width="3" />
          <g class="oinod"><path d="M96 34H198" stroke="#f0b429" stroke-width="7" stroke-linecap="round" /><path d="M92 28Q92 44 108 44L104 30Z" fill="#f0b429" /><rect x="186" y="30" width="16" height="16" rx="3" fill="#8a97b3" /><path d="M150 36L150 22" stroke="#c9d2e6" stroke-width="3" /></g>
          <circle cx="150" cy="38" r="5" fill="#f4f7ff" /><path d="M100 42V74" stroke="#8a97b3" stroke-width="2.500" stroke-dasharray="3 3" />
          <g><rect x="222" y="26" width="40" height="46" rx="5" fill="#3b455f" /><g clip-path="url(#oi-clip)"><rect class="oilevel" x="222" y="40" width="40" height="40" fill="#0b0d14" /><path class="oiwave" d="M214 40q10 -5 20 0t20 0t20 0t20 0V80H214Z" fill="#0b0d14" /></g>
            <path d="M222 38H262M222 58H262" stroke="#8a97b3" stroke-width="2.500" /><ellipse cx="242" cy="26" rx="20" ry="4" fill="#4a5575" /></g>
          <circle class="oidrop" cx="108" cy="46" r="2.400" fill="#0b0d14" stroke="#8a97b3" stroke-width=".8" />
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
