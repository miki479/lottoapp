import type { Messages } from "../i18n/index.ts";
import type { MarketRow } from "../lib/format.ts";
import { numLocale } from "../lib/num.ts";

type Hint = "yes" | "no" | null | undefined;

const CAP: Record<string, string> = { it: "Ciliegi in fiore", "en-US": "Cherry blossom", "en-GB": "Cherry blossom", ja: "桜の開花" };

/**
 * The warm-day question of a Japanese city told as cherry blossom: at rest the tree is half in bloom and a few petals drift down;
 * YES (a warm day) pushes it into full bloom with a shower of petals, NO closes it back into buds and the petals stop.
 */
export function SakuraScene({ m, hint, msg }: { m: MarketRow; hint: Hint; msg: Messages }) {
  const f = m.params.forecast;
  const cap = `${CAP[numLocale()] ?? CAP["en-US"]}${typeof f === "number" ? ` · ${msg.wx.forecast(`${f}${String(m.params.unit ?? "")}`)}` : ""}`;
  return (
    <div class={`mscene sakura ${hint === "yes" ? "s-yes" : hint === "no" ? "s-no" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 320 84" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="sk-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd9e8" /><stop offset="1" stop-color="#fff3f7" /></linearGradient>
        </defs>
        <rect width="320" height="84" fill="url(#sk-bg)" />
        <circle class="sk-sun" cx="262" cy="26" r="13" fill="#ff8aa5" opacity=".55" />
        <path d="M0 70 L96 70 L132 34 L142 40 L152 30 L190 70 L320 70 V84 H0Z" fill="#b9a6d8" opacity=".6" />
        <path d="M132 34 L142 40 L152 30 L146 36 L140 38Z" fill="#fff" opacity=".9" />
        <path d="M0 76Q90 68 170 75T320 72V84H0Z" fill="#cfe9b7" />
        <g transform="translate(70 0)">
        <g class="sk-tree">
          <path d="M44 84 C46 62 52 50 66 38 C74 30 88 26 104 24" fill="none" stroke="#6b4a3a" stroke-width="5" stroke-linecap="round" />
          <path d="M60 52 C70 48 82 46 96 40" fill="none" stroke="#6b4a3a" stroke-width="3" stroke-linecap="round" />
          <g class="sk-buds" fill="#c2547a"><circle cx="66" cy="40" r="2.600" /><circle cx="80" cy="30" r="2.600" /><circle cx="96" cy="26" r="2.600" /><circle cx="90" cy="42" r="2.600" /><circle cx="104" cy="24" r="2.600" /><circle cx="74" cy="46" r="2.600" /></g>
          <g class="sk-bloom">
            <g fill="#ffb7cd"><circle cx="64" cy="38" r="11" /><circle cx="80" cy="28" r="12" /><circle cx="98" cy="24" r="11" /><circle cx="90" cy="42" r="10" /><circle cx="74" cy="46" r="9" /></g>
            <g fill="#ff8fb3"><circle cx="60" cy="42" r="6" /><circle cx="84" cy="32" r="6" /><circle cx="102" cy="28" r="5.500" /><circle cx="94" cy="46" r="5" /></g>
            <g fill="#fff0f5"><circle cx="70" cy="32" r="4" /><circle cx="90" cy="22" r="4" /><circle cx="82" cy="40" r="3.600" /><circle cx="106" cy="20" r="3.500" /></g>
          </g>
        </g>
        <g class="sk-petals" fill="#ffc2d6">
          <ellipse class="pt p1" cx="96" cy="26" rx="3" ry="1.800" /><ellipse class="pt p2" cx="110" cy="20" rx="3" ry="1.800" /><ellipse class="pt p3" cx="84" cy="30" rx="2.600" ry="1.600" />
          <ellipse class="pt p4" cx="120" cy="14" rx="3" ry="1.800" /><ellipse class="pt p5" cx="70" cy="36" rx="2.600" ry="1.600" /><ellipse class="pt p6" cx="132" cy="22" rx="3" ry="1.800" />
          <ellipse class="pt p7" cx="100" cy="34" rx="2.600" ry="1.600" /><ellipse class="pt p8" cx="148" cy="12" rx="3" ry="1.800" /><ellipse class="pt p9" cx="76" cy="26" rx="3" ry="1.800" />
          <ellipse class="pt p10" cx="160" cy="24" rx="2.600" ry="1.600" /><ellipse class="pt p11" cx="114" cy="30" rx="3" ry="1.800" /><ellipse class="pt p12" cx="176" cy="16" rx="3" ry="1.800" />
        </g>
        </g>
      </svg>
      <b>{cap}</b>
    </div>
  );
}
