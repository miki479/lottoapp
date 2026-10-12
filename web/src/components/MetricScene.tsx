import type { Messages } from "../i18n/index.ts";
import type { MarketRow } from "../lib/format.ts";

type Hint = "yes" | "no" | null | undefined;

/**
 * The "what if" picture of a weather question, like the rain sky: at rest it shows a middling state,
 * hovering or pressing YES pushes it to the extreme (hot, gale, blizzard, strong UV, smog) and NO calms it down.
 */
export function MetricScene({ m, hint, msg }: { m: MarketRow; hint: Hint; msg: Messages }) {
  const metric = String(m.params.metric) as "temp" | "wind" | "snow" | "uv" | "aqi" | "hail";
  const f = m.params.forecast;
  const cap = `${msg.wx.names[metric]}${typeof f === "number" && metric !== "snow" && metric !== "hail" ? ` · ${msg.wx.forecast(`${f}${String(m.params.unit ?? "")}`)}` : ""}`;
  return (
    <div class={`mscene ${metric} ${hint === "yes" ? "s-yes" : hint === "no" ? "s-no" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
        {metric === "temp" && <Temp />}
        {metric === "wind" && <Wind />}
        {metric === "snow" && <Snow />}
        {metric === "uv" && <Uv />}
        {metric === "aqi" && <Air />}
        {metric === "hail" && <Hail />}
      </svg>
      <b>{cap}</b>
    </div>
  );
}

const Temp = () => (
  <>
    <defs><linearGradient id="mt-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fc4f5" /><stop offset="1" stop-color="#d9efff" /></linearGradient><linearGradient id="mt-hot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a3c" /><stop offset="1" stop-color="#ffd27a" /></linearGradient><linearGradient id="mt-cold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b79c9" /><stop offset="1" stop-color="#a9c9f5" /></linearGradient></defs>
    <rect width="320" height="84" fill="url(#mt-bg)" />
    <rect class="m-hot" width="320" height="84" fill="url(#mt-hot)" /><rect class="m-cold" width="320" height="84" fill="url(#mt-cold)" />
    <g class="m-sun"><circle cx="60" cy="30" r="15" fill="#ffd23f" /><g stroke="#ffd23f" stroke-width="3" stroke-linecap="round"><path d="M60 6v6M60 48v6M36 30h6M78 30h6M43 13l4 4M73 43l4 4M77 13l-4 4M47 43l-4 4" /></g></g>
    <g class="m-waves" fill="none" stroke="#fff" stroke-width="2.200" stroke-linecap="round" opacity=".7"><path d="M120 60q8-8 16 0t16 0t16 0" /><path d="M150 46q8-8 16 0t16 0t16 0" /><path d="M110 72q8-8 16 0t16 0t16 0" /></g>
    <g class="m-snowf" fill="#fff"><circle cx="130" cy="20" r="2" /><circle cx="170" cy="34" r="2.200" /><circle cx="210" cy="16" r="1.800" /></g>
    <rect x="262" y="8" width="14" height="52" rx="7" fill="#fff" opacity=".85" /><circle cx="269" cy="66" r="11" fill="#fff" opacity=".85" />
    <circle cx="269" cy="66" r="7.500" fill="#e5484d" /><rect class="m-merc" x="266" y="12" width="6" height="52" rx="3" fill="#e5484d" />
    <g stroke="#1c2a44" stroke-width="1.200" opacity=".5"><path d="M278 18h5M278 28h5M278 38h5M278 48h5" /></g>
  </>
);

const Wind = () => (
  <>
    <defs><linearGradient id="mw-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fb4ec" /><stop offset="1" stop-color="#cfe6fa" /></linearGradient></defs>
    <rect width="320" height="84" fill="url(#mw-bg)" />
    <g class="m-clouds" fill="#fff" opacity=".9"><g class="c1"><circle cx="40" cy="22" r="9" /><circle cx="52" cy="18" r="11" /><circle cx="66" cy="23" r="8" /><rect x="34" y="23" width="40" height="8" rx="4" /></g><g class="c2"><circle cx="190" cy="14" r="7" /><circle cx="200" cy="11" r="9" /><circle cx="212" cy="15" r="6" /><rect x="184" y="15" width="34" height="6" rx="3" /></g></g>
    <g class="m-gust" fill="none" stroke="#fff" stroke-width="2.600" stroke-linecap="round" opacity=".85"><path d="M20 40h70q10 0 10-7t-9-7" /><path d="M110 52h90q12 0 12 8t-10 7" /><path d="M60 64h60" /></g>
    <path d="M0 76Q80 66 160 74T320 70V84H0Z" fill="#7bbf68" />
    <g class="m-tree"><rect x="258" y="42" width="5" height="36" rx="2.500" fill="#8a5a36" /><g fill="#3f9a4f"><circle cx="260" cy="34" r="15" /><circle cx="248" cy="43" r="9" /><circle cx="272" cy="43" r="9" /></g></g>
    <g class="m-flag"><rect x="296" y="30" width="2.600" height="46" fill="#5a6577" /><path class="fl" d="M298 32h20q-4 5 0 10h-20z" fill="#e5484d" /></g>
    <g class="m-leaves" fill="#8fd47a"><ellipse cx="236" cy="40" rx="3" ry="1.700" /><ellipse cx="226" cy="52" rx="3" ry="1.700" /><ellipse cx="246" cy="30" rx="3" ry="1.700" /></g>
  </>
);

const Snow = () => (
  <>
    <defs><linearGradient id="ms-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d93bd" /><stop offset="1" stop-color="#d7e3f6" /></linearGradient></defs>
    <rect width="320" height="84" fill="url(#ms-bg)" />
    <g fill="#9fb3d6" opacity=".7"><circle cx="70" cy="22" r="10" /><circle cx="84" cy="18" r="13" /><circle cx="100" cy="23" r="9" /><circle cx="230" cy="16" r="9" /><circle cx="244" cy="12" r="12" /><circle cx="260" cy="17" r="8" /></g>
    <g class="m-flakes" fill="#fff">
      {Array.from({ length: 16 }, (_, i) => <circle key={i} class={`fk f${i % 8}`} cx={14 + i * 19} cy={-4} r={i % 3 === 0 ? 2.800 : 2} />)}
    </g>
    <path d="M0 70Q70 58 150 68T320 62V84H0Z" fill="#f4f8ff" /><path d="M0 78Q90 70 190 76T320 74V84H0Z" fill="#e3ecf9" />
    <g fill="#5d6f94"><path d="M60 66l8-20l8 20z" /><path d="M250 64l7-17l7 17z" /></g><g fill="#f4f8ff"><path d="M60 58l8-12l8 12z" /><path d="M250 56l7-9l7 9z" /></g>
  </>
);

const Uv = () => (
  <>
    <defs><linearGradient id="mu-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4aa3ef" /><stop offset="1" stop-color="#bfe0fb" /></linearGradient><radialGradient id="mu-glow"><stop offset="0" stop-color="#fff3a8" stop-opacity=".95" /><stop offset="1" stop-color="#ffd23f" stop-opacity="0" /></radialGradient></defs>
    <rect width="320" height="84" fill="url(#mu-bg)" /><rect class="m-uvhaze" width="320" height="84" fill="#ff8ac4" />
    <g class="m-sunw"><circle class="m-glow" cx="236" cy="38" r="52" fill="url(#mu-glow)" /><g class="m-rays" stroke="#ffd23f" stroke-width="4" stroke-linecap="round"><path d="M236 4v10M236 62v10M202 38h10M260 38h10M212 14l7 7M253 55l7 7M260 14l-7 7M219 55l-7 7" /></g><circle cx="236" cy="38" r="17" fill="#ffd23f" /></g>
    <g class="m-ucloud" fill="#fff"><circle cx="222" cy="40" r="11" /><circle cx="236" cy="34" r="14" /><circle cx="252" cy="41" r="10" /><rect x="212" y="41" width="50" height="10" rx="5" /></g>
    <path d="M0 74Q80 64 160 72T320 68V84H0Z" fill="#7bbf68" />
    <g class="m-person">
      <ellipse cx="74" cy="80" rx="22" ry="3" fill="#000" opacity=".12" /><ellipse class="m-puddle" cx="74" cy="80" rx="14" ry="2.600" fill="#6fb8ff" opacity=".8" />
      <rect x="62" y="52" width="24" height="24" rx="9" fill="#e5484d" /><rect x="66" y="72" width="6" height="8" rx="2" fill="#3b4a6b" /><rect x="76" y="72" width="6" height="8" rx="2" fill="#3b4a6b" />
      <path class="m-arm" d="M64 58q-10 -2 -12 -14" stroke="#f1c9a5" stroke-width="5" stroke-linecap="round" fill="none" /><path d="M84 58q8 6 6 14" stroke="#f1c9a5" stroke-width="5" stroke-linecap="round" fill="none" />
      <g class="m-head"><circle class="face" cx="74" cy="40" r="13" fill="#f1c9a5" /><path d="M62 36q12 -14 24 0q-12 -4 -24 0z" fill="#4a3220" />
        <circle cx="69" cy="39" r="2.200" fill="#fff" /><circle cx="79" cy="39" r="2.200" fill="#fff" /><circle class="eye" cx="69" cy="39.500" r="1.100" fill="#1c2a44" /><circle class="eye" cx="79" cy="39.500" r="1.100" fill="#1c2a44" />
        <path class="m-brow" d="M66 35l5 1.500M82 35l-5 1.500" stroke="#4a3220" stroke-width="1.400" stroke-linecap="round" />
        <path class="m-smile" d="M69 46q5 4 10 0" stroke="#7a3b2a" stroke-width="1.600" fill="none" stroke-linecap="round" />
        <g class="m-pant"><ellipse cx="74" cy="47.500" rx="4.500" ry="3.500" fill="#7a2a22" /><path d="M72 49.500q2 7 4 0z" fill="#ff7a8a" /></g>
      </g>
      <g class="m-sweat" fill="#6fc3ff"><path class="d1" d="M58 34q3 5 0 8q-3 -3 0 -8z" /><path class="d2" d="M90 33q3 5 0 8q-3 -3 0 -8z" /><path class="d3" d="M60 44q3 5 0 8q-3 -3 0 -8z" /><path class="d4" d="M89 45q3 5 0 8q-3 -3 0 -8z" /><path class="d5" d="M74 24q3 5 0 8q-3 -3 0 -8z" /><path class="d6" d="M82 27q3 5 0 8q-3 -3 0 -8z" /></g>
      <g class="m-steam" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"><path d="M66 22q-3 -4 0 -8t0 -7" /><path d="M74 20q-3 -4 0 -8t0 -7" /><path d="M82 22q-3 -4 0 -8t0 -7" /></g>
    </g>
  </>
);

const Air = () => (
  <>
    <defs><linearGradient id="ma-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#76bdf0" /><stop offset="1" stop-color="#d9efff" /></linearGradient></defs>
    <rect width="320" height="84" fill="url(#ma-bg)" />
    <g fill="#8aa0bf" opacity=".85"><rect x="20" y="40" width="22" height="44" /><rect x="46" y="28" width="26" height="56" /><rect x="76" y="46" width="20" height="38" /><rect x="100" y="22" width="28" height="62" /><rect x="132" y="38" width="22" height="46" /><rect x="158" y="30" width="26" height="54" /><rect x="188" y="46" width="22" height="38" /><rect x="214" y="24" width="28" height="60" /><rect x="246" y="40" width="24" height="44" /><rect x="274" y="32" width="26" height="52" /></g>
    <rect class="m-haze" width="320" height="84" fill="#b09a78" />
    <g class="m-parts" fill="#6e5a3c">{Array.from({ length: 14 }, (_, i) => <circle key={i} class={`pt p${i % 7}`} cx={12 + i * 22} cy={20 + ((i * 17) % 50)} r={1.800 + (i % 3) * 0.6} />)}</g>
    <g class="m-leafc" fill="#5fbf6a"><path d="M292 12q10 2 8 14q-10-2-8-14z" /><path d="M16 18q8 2 6 11q-8-2-6-11z" /></g>
  </>
);

/** A storm cloud; with YES the hailstones pelt down, with NO the sky stays dry. */
function Hail() {
  const stones = [[40, 0], [78, 2], [112, 1], [150, 3], [190, 0], [228, 2], [262, 1], [296, 3]] as const;
  return (
    <>
      <rect width="320" height="84" fill="#46506e" />
      <g class="m-hcloud"><ellipse cx="110" cy="22" rx="54" ry="16" fill="#2c3350" /><ellipse cx="170" cy="18" rx="62" ry="18" fill="#252b45" /><ellipse cx="236" cy="24" rx="50" ry="15" fill="#2c3350" /></g>
      <path class="m-bolt" d="M170 30 l-10 18 h9 l-6 16 16 -22 h-10 l8 -12 z" fill="#ffe36a" />
      <g class="m-stones">{stones.map(([x, d], i) => <circle key={i} class="stone" cx={x} cy="40" r="3.600" fill="#f3f8ff" style={`--d:${d * 0.18}s`} />)}</g>
      <path d="M0 80 H320" stroke="#2b3350" stroke-width="6" />
    </>
  );
}
