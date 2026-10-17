import { isCrypto } from "../../../shared/ticks.ts";
import type { Messages } from "../i18n/index.ts";
import type { MarketRow } from "../lib/format.ts";
import { LawScene } from "./Cannabis.tsx";
import { HouseScene } from "./HouseScene.tsx";
import { alertLabel } from "../lib/names.ts";

type Hint = "yes" | "no" | null | undefined;

/** Scenes of the "number at an instant" questions: a coin price chart, an aurora sky (Kp index) and page-view bars. */
export function TickScene({ m, hint, msg, now }: { m: MarketRow; hint: Hint; msg: Messages; now?: number }) {
  const series = String(m.params.series ?? "");
  if (series.startsWith("house:") && m.category === "law") return <LawScene m={m} hint={hint} msg={msg} />;
  if (series.startsWith("house:")) return <HouseScene m={m} hint={hint} msg={msg} now={now ?? Date.now()} />;
  const kind = series === "kp" ? "kp" : series.startsWith("wiki:") ? "wiki" : series.startsWith("storm:") ? "storm" : series.startsWith("alert:") ? "alert" : series.startsWith("metal:") ? "metal" : series.startsWith("fuel:") ? "fuel" : series.startsWith("oil:") ? "oil" : series.startsWith("tm:") ? "concert" : /^tv:\d+$/.test(series) ? "tv" : "price";
  const cls = `mscene tick ${kind} ${hint === "yes" ? "s-yes" : hint === "no" ? "s-no" : ""}`;
  const cap = kind === "kp" ? "Kp ≥ " + m.params.threshold : alertLabel(series, msg) || (msg.cm[String(m.params.label ?? "")] ?? String(m.params.label ?? ""));
  if (series.startsWith("neo:")) {
    const near = hint === "yes" ? 74 : hint === "no" ? 20 : 48;
    return (
      <div class={`mscene tick neo ${hint === "yes" ? "s-yes" : hint === "no" ? "s-no" : ""}`} aria-hidden="true">
        <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
          <rect width="320" height="84" fill="#080c24" />
          {[[30, 12], [86, 54], [140, 16], [196, 62], [254, 20], [300, 48]].map(([x, y], i) => <circle key={i} class="lc-star" style={`--d:${i * 220}ms`} cx={x} cy={y} r="1.400" fill="#fff" />)}
          <circle cx="262" cy="64" r="34" fill="#2a6fdb" /><path d="M240 50q14-8 26 2t10 18q-14 10-30 4z" fill="#3fae6a" opacity=".9" />
          <path d="M20 70Q130 10 230 56" fill="none" stroke="#7a86b8" stroke-width="1" stroke-dasharray="4 5" />
          <g class="neo-rock" style={`transform:translateX(${near}px)`}><path d="M96 34l8-5 9 3 4 8-5 8-10 2-8-6z" fill="#b6a58c" /><circle cx="101" cy="36" r="2" fill="#8b7b64" /><circle cx="108" cy="40" r="1.500" fill="#8b7b64" /></g>
        </svg>
        <b>NASA</b>
      </div>
    );
  }
  if (series.startsWith("eonet:")) {
    const key = series.slice(6), cls = hint === "yes" ? "s-yes" : hint === "no" ? "s-no" : "";
    return (
      <div class={`mscene tick eonet eo-${key} ${cls}`} aria-hidden="true">
        <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
          {key === "volcanoes" && <g>
            <defs>
              <linearGradient id="eoSkyV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#150f2a" /><stop offset=".6" stop-color="#3a1c38" /><stop offset="1" stop-color="#7a2f2a" /></linearGradient>
              <radialGradient id="eoGlowV" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb347" stop-opacity=".95" /><stop offset=".5" stop-color="#ff5a1f" stop-opacity=".45" /><stop offset="1" stop-color="#ff3d00" stop-opacity="0" /></radialGradient>
            </defs>
            <rect width="320" height="84" fill="url(#eoSkyV)" />
            {[[24, 10], [70, 22], [118, 8], [236, 12], [280, 26], [300, 8]].map(([x, y], i) => <circle key={i} class="lc-star" style={`--d:${i * 260}ms`} cx={x} cy={y} r="1.200" fill="#fff" />)}
            <path d="M0 84V62l34-14 30 12 28-18 26 20V84z" fill="#2b1a2c" />
            <path d="M210 84V58l26-16 24 14 22-12 38 20V84z" fill="#2b1a2c" />
            <ellipse class="eo-glow" cx="160" cy="26" rx="46" ry="26" fill="url(#eoGlowV)" />
            <g class="eo-plume">{[[160, 22, 5], [153, 15, 6], [168, 12, 7], [158, 4, 8], [172, 0, 9]].map(([x, y, r], i) => <circle key={i} class="eo-ash" style={`--d:${i * 380}ms`} cx={x} cy={y} r={r} />)}</g>
            <g class="eo-sparks">{[[-22, -26], [-12, -34], [-4, -40], [6, -38], [14, -32], [24, -24], [-30, -14], [30, -16]].map(([dx, dy], i) => <circle key={i} class="eo-spark" style={`--dx:${dx}px;--dy:${dy}px;--d:${i * 170}ms`} cx="160" cy="28" r="1.600" />)}</g>
            <path d="M92 84l54-52 6-4h16l6 4 54 52z" fill="#3b2730" />
            <path d="M92 84l54-52 6-4-14 56z" fill="#30202a" />
            <path d="M146 32l6-4h16l6 4-8 3-6-3-6 3z" fill="#ff7a2a" class="eo-crater" />
            <path class="eo-flow" d="M158 31q-3 14-8 22t-10 20" fill="none" stroke="#ff7a1a" stroke-width="2.200" stroke-linecap="round" />
            <path class="eo-flow eo-flow2" d="M164 31q3 12 9 21t12 22" fill="none" stroke="#ff9a2a" stroke-width="1.800" stroke-linecap="round" />
            <path class="eo-flow eo-flow3" d="M161 32q0 16-2 30" fill="none" stroke="#ffc15a" stroke-width="1.400" stroke-linecap="round" />
            <path d="M0 84V72q40-6 80 0t90 2 80-2 70 2v10z" fill="#1b1220" />
          </g>}
          {key === "storms" && <g>
            <defs>
              <linearGradient id="eoSkyS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f2740" /><stop offset="1" stop-color="#4a5878" /></linearGradient>
              <linearGradient id="eoSeaS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d4766" /><stop offset="1" stop-color="#17263d" /></linearGradient>
            </defs>
            <rect width="320" height="84" fill="url(#eoSkyS)" />
            <g class="eo-sun"><circle cx="262" cy="22" r="11" fill="#ffd36b" /><circle cx="262" cy="22" r="18" fill="#ffd36b" opacity=".25" /></g>
            <g class="eo-cloudA"><path d="M-20 34q0-16 24-16 8-12 28-8 18 2 20 16 22 0 24 14H-8q-12 0-12-6z" fill="#6b7592" /><path d="M150 30q0-14 22-14 8-10 24-6 16 2 18 14 20 0 22 12H160q-10 0-10-6z" fill="#6b7592" /></g>
            <g class="eo-cloudB"><path d="M30 44q0-18 26-18 10-14 30-9 20 3 22 18 24 0 26 16H42q-12 0-12-7z" fill="#39435d" /><path d="M190 46q0-16 22-16 8-12 26-8 18 2 20 16 20 0 22 14H200q-10 0-10-6z" fill="#39435d" /></g>
            <rect class="eo-flash" width="320" height="84" fill="#fff" />
            <path class="eo-bolt" d="M142 40l-10 18h9l-7 20 18-24h-10l8-14z" fill="#ffe066" />
            <path class="eo-bolt eo-bolt2" d="M226 44l-7 13h7l-5 14 13-17h-7l6-10z" fill="#fff3b0" />
            <g class="eo-rain">{Array.from({ length: 22 }, (_, i) => <line key={i} x1={8 + i * 14.500} y1="30" x2={4 + i * 14.500} y2="42" style={`--d:${(i * 97) % 600}ms`} />)}</g>
            <g class="eo-waves"><path d="M0 70q20-8 40 0t40 0 40 0 40 0 40 0 40 0 40 0 40 0v14H0z" fill="url(#eoSeaS)" /><path d="M0 76q20-6 40 0t40 0 40 0 40 0 40 0 40 0 40 0 40 0v8H0z" fill="#10192b" opacity=".7" /></g>
          </g>}
          {key === "ice" && <g>
            <defs>
              <linearGradient id="eoSkyI" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f2547" /><stop offset=".55" stop-color="#6aa6d6" /><stop offset="1" stop-color="#dff1fb" /></linearGradient>
              <linearGradient id="eoAur" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3dffb0" stop-opacity="0" /><stop offset=".35" stop-color="#3dffb0" stop-opacity=".75" /><stop offset=".7" stop-color="#9b6bff" stop-opacity=".6" /><stop offset="1" stop-color="#9b6bff" stop-opacity="0" /></linearGradient>
            </defs>
            <rect width="320" height="84" fill="url(#eoSkyI)" />
            {[[30, 8], [92, 18], [176, 6], [250, 14], [296, 24]].map(([x, y], i) => <circle key={i} class="lc-star" style={`--d:${i * 300}ms`} cx={x} cy={y} r="1.200" fill="#fff" />)}
            <path class="eo-aurora" d="M0 26q50-26 110-8t110-6 110-4v16q-60 10-110 4T110 38 0 46z" fill="url(#eoAur)" />
            <path d="M60 62l22-26 12 10 20-30 18 24 14-10 22 32z" fill="#ffffff" opacity=".92" /><path d="M60 62l22-26 12 10 20-30-14 46z" fill="#cfe7f6" />
            <rect y="58" width="320" height="26" fill="#3f86b3" />
            <g class="eo-floes">
              <path class="eo-floe f1" d="M20 66l30-4 22 3 8 6-24 5-28-2z" fill="#f4fbff" />
              <path class="eo-floe f2" d="M110 70l34-5 26 4 6 5-30 5-30-3z" fill="#e6f4fc" />
              <path class="eo-floe f3" d="M210 66l28-3 30 3 6 6-26 5-34-3z" fill="#f4fbff" />
              <path class="eo-floe f4" d="M270 74l20-3 24 3 4 4-22 3-24-2z" fill="#e6f4fc" />
            </g>
            <path class="eo-crack" d="M142 64l6 4-4 4 6 5M236 65l-5 5 5 4-4 5" fill="none" stroke="#2e6a94" stroke-width="1.200" stroke-linecap="round" />
            <g class="eo-glint">{([[44, 64], [124, 68], [226, 65], [286, 73]] as [number, number][]).map(([x, y], i) => <path key={i} style={`--d:${i * 400}ms`} d={`M${x} ${y - 4}v8M${x - 4} ${y}h8`} stroke="#fff" stroke-width="1" stroke-linecap="round" />)}</g>
          </g>}
        </svg>
        <b>NASA EONET</b>
      </div>
    );
  }
  if (series === "hn:max") {
    const up = hint === "yes" ? -10 : hint === "no" ? 8 : 0;
    return (
      <div class={`mscene tick hn ${hint === "yes" ? "s-yes" : hint === "no" ? "s-no" : ""}`} aria-hidden="true">
        <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
          <rect width="320" height="84" fill="#f6efe6" />
          <rect x="22" y="14" width="56" height="56" rx="6" fill="#ff6600" /><path d="M38 28l12 18 12-18M50 46v14" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
          {[0, 1, 2, 3, 4].map((i) => <rect key={i} class="hn-bar" style={`--d:${i * 90}ms`} x={108 + i * 38} y={60 - (14 + i * 7) + up * (i / 4)} width="24" height={14 + i * 7 - up * (i / 4)} rx="3" fill="#ff9a4d" />)}
        </svg>
        <b>{m.params.label ? String(m.params.label) : "Hacker News"}</b>
      </div>
    );
  }
  if (series.startsWith("chess:")) {
    return (
      <div class={`mscene tick chess ${hint === "yes" ? "s-yes" : hint === "no" ? "s-no" : ""}`} aria-hidden="true">
        <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
          <rect width="320" height="84" fill="#312e2b" />
          {Array.from({ length: 16 }, (_, i) => Array.from({ length: 4 }, (_, j) => (i + j) % 2 ? <rect key={`${i}-${j}`} x={i * 20} y={j * 21} width="20" height="21" fill="#769656" /> : <rect key={`${i}-${j}`} x={i * 20} y={j * 21} width="20" height="21" fill="#eeeed2" />))}
          <g class="chess-knight" transform="translate(142 8)"><path d="M10 64h36v-6l-6-4c8-6 12-16 8-26L34 6 24 10l-4-4-6 12 6 6-8 14c-4 6-6 12-2 18z" fill="#1c1b19" stroke="#f5f5f5" stroke-width="2" stroke-linejoin="round" /><circle cx="36" cy="20" r="2" fill="#f5f5f5" /></g>
        </svg>
        <b>{String(m.params.label ?? "")}</b>
      </div>
    );
  }
  if (series.startsWith("launch:")) {
    return (
      <div class={`mscene tick launch ${hint === "yes" ? "s-yes" : hint === "no" ? "s-no" : ""}`} aria-hidden="true">
        <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
          <rect width="320" height="84" fill="#0c1230" />
          {[[30, 12], [80, 40], [120, 18], [210, 10], [260, 34], [296, 16], [180, 52]].map(([x, y], i) => <circle key={i} class="lc-star" style={`--d:${i * 200}ms`} cx={x} cy={y} r="1.500" fill="#fff" />)}
          <rect x="0" y="72" width="320" height="12" fill="#1c2750" />
          <g class="lc-smoke"><circle cx="146" cy="70" r="6" /><circle cx="160" cy="72" r="8" /><circle cx="174" cy="70" r="6" /></g>
          <g class="lc-rocket"><path d="M160 14c-9 10-9 28-9 38h18c0-10 0-28-9-38z" fill="#e8ecf5" /><circle cx="160" cy="34" r="4" fill="#4a7bff" /><path d="M151 46l-8 10 8-2zM169 46l8 10-8-2z" fill="#ff5a4d" /><g class="lc-flame"><path d="M154 52q6 24 12 0z" fill="#ff7a00" /><path d="M157 52q3 14 6 0z" fill="#ffe066" /></g></g>
        </svg>
        <b>{String(m.params.label ?? "")}</b>
      </div>
    );
  }
  if (series.startsWith("f1:")) {
    const shift = hint === "yes" ? 40 : hint === "no" ? -20 : 0;
    return (
      <div class={`mscene tick f1 ${hint === "yes" ? "s-yes" : hint === "no" ? "s-no" : ""}`} aria-hidden="true">
        <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
          <rect width="320" height="84" fill="#2a2d34" />
          <path d="M0 62H320" stroke="#fff" stroke-width="2" stroke-dasharray="14 10" opacity=".6" />
          {Array.from({ length: 6 }, (_, i) => Array.from({ length: 2 }, (_, j) => <rect key={`${i}-${j}`} x={282 + j * 10} y={6 + i * 10} width="10" height="10" fill={(i + j) % 2 ? "#fff" : "#111"} />))}
          <g class="f1-car" style={`transform:translateX(${shift}px)`}><path d="M96 54h96l10-8h14v8h6v8H92z" fill="#e10600" /><rect x="116" y="46" width="30" height="8" rx="3" fill="#111" /><circle cx="118" cy="62" r="8" fill="#111" /><circle cx="184" cy="62" r="8" fill="#111" /></g>
        </svg>
        <b>{String(m.params.label ?? "")}</b>
      </div>
    );
  }
  if (kind === "tv") {
    const stars = hint === "yes" ? 5 : hint === "no" ? 2 : 3;
    return (
      <div class={cls} aria-hidden="true">
        <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
          <rect width="320" height="84" fill="#1b1740" />
          <g class="tv-set"><rect x="102" y="8" width="116" height="60" rx="9" fill="#2c2760" /><rect x="110" y="15" width="100" height="46" rx="5" fill="#0d0b25" /><path class="tv-glow" d="M110 15h100v46H110z" fill="#7aa2ff" opacity=".18" /><path d="M148 68h24l6 8h-36z" fill="#2c2760" /></g>
          <g class="tv-stars" fill="#ffd24a">{[0, 1, 2, 3, 4].map((i) => <path key={i} class={`tv-star ${i < stars ? "on" : ""}`} style={`--k:${i}`} transform={`translate(${126 + i * 16} 38)`} d="M0-7L2 -2H7L3 1.500 4.500 6.500 0 3.500-4.500 6.500-3 1.500-7-2H-2Z" />)}</g>
        </svg>
        <b>{cap}</b>
      </div>
    );
  }
  if (kind === "concert") {
    const crowd = hint === "yes" ? 9 : hint === "no" ? 3 : 6;
    return (
      <div class={cls} aria-hidden="true">
        <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
          <defs><linearGradient id="tk-stage" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1240" /><stop offset="1" stop-color="#3a1b5e" /></linearGradient></defs>
          <rect width="320" height="84" fill="url(#tk-stage)" />
          <g class="cn-beams"><path class="b1" d="M70 0L40 60H100Z" fill="#ff5fa8" opacity=".35" /><path class="b2" d="M160 0L130 60H190Z" fill="#7aa2ff" opacity=".35" /><path class="b3" d="M250 0L220 60H280Z" fill="#ffd24a" opacity=".35" /></g>
          <rect x="60" y="46" width="200" height="8" rx="2" fill="#2b2250" /><rect x="150" y="30" width="20" height="16" rx="3" fill="#ff5fa8" />
          <g fill="#0c0820">{Array.from({ length: 11 }, (_, i) => <g key={i} class={`cn-fan ${i < crowd ? "on" : ""}`} style={`--k:${i}`}><circle cx={20 + i * 28} cy="68" r="6" /><rect x={14 + i * 28} y="72" width="12" height="14" rx="5" /></g>)}</g>
        </svg>
        <b>{cap}</b>
      </div>
    );
  }
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
    const k = series.slice(6);
    /** Each metal has its own colours and its own stamp; copper is shown as tubes, the others as bars. hi / mid / lo are the light, body and shadow of the metal. */
    const LOOK: Record<string, { hi: string; mid: string; lo: string; ink: string; stamp: string; spark: string; bg: [string, string] }> = {
      xau: { hi: "#fff3c0", mid: "#f4c430", lo: "#b87a0b", ink: "#7a4f06", stamp: "Au 999.9", spark: "#fff7d6", bg: ["#1b2136", "#0e1322"] },
      xag: { hi: "#f6f7f9", mid: "#bfc4cc", lo: "#6f7683", ink: "#434a57", stamp: "Ag 999", spark: "#ffffff", bg: ["#1c212d", "#10141d"] },
      xpt: { hi: "#eaf5ff", mid: "#9fbbd6", lo: "#4f6a88", ink: "#27405a", stamp: "Pt 950", spark: "#cfeaff", bg: ["#13203a", "#0a1226"] },
      hg: { hi: "#ffd0a8", mid: "#e2783a", lo: "#8a3414", ink: "#55200a", stamp: "Cu 999", spark: "#ffe2c8", bg: ["#241b1e", "#140f14"] },
    };
    const L = LOOK[k] ?? LOOK.xau!;
    const tube = k === "hg";
    const bar = (x: number, y: number, w: number, front: boolean) => (
      <g key={`${x}${y}`}>
        {tube
          ? <>
              <rect x={x + 4} y={y} width={w - 4} height="17" rx="8.500" fill={`url(#mt-bar-${k})`} />
              <ellipse cx={x + 6} cy={y + 8.500} rx="5.500" ry="8.500" fill={L.lo} /><ellipse cx={x + 6} cy={y + 8.500} rx="3.200" ry="6" fill="#1a0a06" /><ellipse cx={x + 5.200} cy={y + 7.500} rx="1.400" ry="3" fill={L.mid} opacity=".55" />
              <rect x={x + 12} y={y + 2.500} width={w - 20} height="3" rx="1.500" fill="#fff" opacity=".42" />
              {front && <text x={x + w / 2 + 4} y={y + 12.200} font-size="7" font-weight="800" text-anchor="middle" letter-spacing=".6" fill={L.ink} opacity=".6">{L.stamp}</text>}
            </>
          : <>
              <path d={`M${x + 7} ${y}H${x + w - 7}L${x + w} ${y + 17}H${x}Z`} fill={`url(#mt-bar-${k})`} /><path d={`M${x + 7} ${y}H${x + w - 7}L${x + w - 10} ${y + 5}H${x + 10}Z`} fill="#fff" opacity={k === "xag" ? ".5" : ".4"} />
              <path d={`M${x} ${y + 17}H${x + w}`} stroke="#000" opacity=".22" stroke-width="1.500" />
              {k === "xag" && [8, 11, 14].map((dy) => <path key={dy} d={`M${x + 12} ${y + dy}H${x + w - 12}`} stroke="#fff" opacity=".16" stroke-width=".7" />)}
              {k === "xpt" && <path d={`M${x + 9} ${y + 5.500}L${x + 5} ${y + 17}M${x + w - 9} ${y + 5.500}L${x + w - 5} ${y + 17}`} stroke={L.hi} opacity=".5" stroke-width="1" />}
              {front && <text x={x + w / 2} y={y + 12.800} font-size="7" font-weight="800" text-anchor="middle" letter-spacing=".6" fill={L.ink} opacity=".55">{L.stamp}</text>}
            </>}
      </g>
    );
    const spark = (x: number, y: number, d: number) => <path key={`${x}`} class="mtspark" style={`--d:${d}ms`} d={`M${x} ${y - 6}L${x + 1.600} ${y - 1.600}L${x + 6} ${y}L${x + 1.600} ${y + 1.600}L${x} ${y + 6}L${x - 1.600} ${y + 1.600}L${x - 6} ${y}L${x - 1.600} ${y - 1.600}Z`} fill={L.spark} />;
    return (
      <div class={`${cls} m-${k}`} aria-hidden="true">
        <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id={`mt-bg-${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color={L.bg[0]} /><stop offset="1" stop-color={L.bg[1]} /></linearGradient>
            <linearGradient id={`mt-bar-${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color={L.hi} /><stop offset=".45" stop-color={L.mid} /><stop offset="1" stop-color={L.lo} /></linearGradient>
            <clipPath id={`mt-clip-${tube ? "t" : "b"}`}>{tube ? <path d="M86 62H168V79H86Z M162 62H244V79H162Z M124 42H206V59H124Z" /> : <path d="M89 62H161L168 79H82Z M165 62H237L244 79H158Z M127 42H199L206 59H120Z" />}</clipPath>
          </defs>
          <rect width="320" height="84" fill={`url(#mt-bg-${k})`} />
          <ellipse cx="163" cy="80" rx="96" ry="4" fill="#000" opacity=".35" />
          <g class="mtstack">{bar(82, 62, 86, true)}{bar(158, 62, 86, true)}{bar(120, 42, 86, true)}
            <g clip-path={`url(#mt-clip-${tube ? "t" : "b"})`}><rect class="mtshine" x="-40" y="30" width="26" height="60" fill="#fff" opacity=".55" transform="skewX(-22)" /></g>
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
  // the dot at the end of the line wears the currency only where the number is a price
  const sym = isCrypto(series) ? "$" : series === "power:it" ? "€" : series.startsWith("fx:") ? "⇄" : "";
  return (
    <div class={cls} aria-hidden="true">
      <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
        <rect width="320" height="84" fill="#121a2e" />
        <g stroke="#26324d" stroke-width="1"><path d="M0 20H320M0 62H320M60 0V84M140 0V84M220 0V84M300 0V84" /></g>
        <path d="M0 42H320" stroke="#8ea0c8" stroke-width="1.500" stroke-dasharray="6 5" />
        <g class="pline"><polyline points="0,50 30,44 60,52 90,40 120,47 150,36 180,45 210,38 240,48 270,40 300,44" fill="none" stroke="#f7b733" stroke-width="2.500" stroke-linejoin="round" stroke-linecap="round" /><circle cx="300" cy="44" r="6" fill="#f7b733" /><text x="300" y="47.500" text-anchor="middle" font-size="9" font-weight="800" fill="#121a2e">{sym}</text></g>
      </svg>
      <b>{cap}</b>
    </div>
  );
}
