import { useState } from "preact/hooks";

/**
 * Country flag from the self-hosted flag-icons set (MIT, see /flags/LICENSE.txt): every ISO country has one.
 * If a file is ever missing, a neutral badge with the country code is shown instead of a broken image.
 */
export function Flag({ cc, size = 14 }: { cc: string; size?: number }) {
  const [bad, setBad] = useState(false);
  const code = (cc || "").toLowerCase();
  const w = Math.round(size * 1.4);
  if (bad || !/^[a-z]{2}$/.test(code)) return <span class="flag fallback" style={`width:${w}px;height:${size}px;font-size:${Math.max(7, size - 6)}px`} aria-hidden="true">{(cc || "").toUpperCase()}</span>;
  return <img class="flag" src={`/flags/${code}.svg`} width={w} height={size} alt="" loading="lazy" decoding="async" onError={() => setBad(true)} />;
}
