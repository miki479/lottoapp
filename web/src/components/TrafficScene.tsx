import type { Messages } from "../i18n/index.ts";
import type { MarketRow } from "../lib/format.ts";

type Hint = "yes" | "no" | null | undefined;

/** A road at rush hour. YES ("average speed under the threshold") bunches the cars into a slow queue with brake lights; NO lets them flow. */
export function TrafficScene({ m, hint, msg }: { m: MarketRow; hint: Hint; msg: Messages }) {
  const cap = msg.traffic.threshold(Number(m.params.thresholdKmh));
  const cars = [[18, 0, "#e5484d"], [78, 0, "#3b6fd4"], [150, 0, "#f2b01e"], [230, 0, "#2e9e6b"], [40, 1, "#8a5ad8"], [120, 1, "#e5484d"], [205, 1, "#ffffff"], [270, 1, "#3b6fd4"]] as const;
  return (
    <div class={`mscene traffic ${hint === "yes" ? "s-yes" : hint === "no" ? "s-no" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
        <defs><linearGradient id="mtr-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b3b7a" /><stop offset=".5" stop-color="#d9628a" /><stop offset="1" stop-color="#ffb26b" /></linearGradient></defs>
        <rect width="320" height="84" fill="url(#mtr-bg)" />
        <g fill="#15121f" opacity=".75"><rect x="10" y="22" width="22" height="30" /><rect x="36" y="12" width="26" height="40" /><rect x="66" y="26" width="20" height="26" /><rect x="92" y="8" width="28" height="44" /><rect x="126" y="24" width="22" height="28" /><rect x="190" y="14" width="26" height="38" /><rect x="222" y="26" width="22" height="26" /><rect x="250" y="10" width="28" height="42" /><rect x="284" y="22" width="24" height="30" /></g>
        <rect y="50" width="320" height="34" fill="#2b2f3a" /><rect y="50" width="320" height="2" fill="#555c6b" />
        <path class="road-dash" d="M0 67H320" stroke="#e8edf5" stroke-width="2" stroke-dasharray="12 10" />
        <g class="lane l0">{cars.filter((c) => c[1] === 0).map(([x, , col], i) => <Car key={x} x={x} y={53} col={col} k={i} />)}</g>
        <g class="lane l1">{cars.filter((c) => c[1] === 1).map(([x, , col], i) => <Car key={x} x={x} y={69} col={col} k={i} />)}</g>
      </svg>
      <b>{cap}</b>
    </div>
  );
}

function Car({ x, y, col, k }: { x: number; y: number; col: string; k: number }) {
  return (
    <g class={`car c${k}`} style={`--x:${x}px`}>
      <rect x="0" y={y} width="26" height="10" rx="4" fill={col} /><rect x="6" y={y - 4} width="13" height="6" rx="2.500" fill={col} /><rect x="8" y={y - 3} width="9" height="4" rx="1.500" fill="#1c2a44" opacity=".85" />
      <circle cx="6" cy={y + 10} r="2.600" fill="#15121f" /><circle cx="20" cy={y + 10} r="2.600" fill="#15121f" />
      <rect class="brake" x="-1.500" y={y + 2} width="2.600" height="4" rx="1" fill="#ff3b30" /><rect x="25" y={y + 2} width="2.200" height="3.500" rx="1" fill="#fff6c2" />
    </g>
  );
}
