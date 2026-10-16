import type { Locale, Messages } from "../i18n/index.ts";
import { emphasize, question, type MarketRow } from "../lib/format.ts";

/** A market's question with the important words in bold: what it is about, the delay or value, the time. */
export function Q({ m, msg, locale, city, tz, now }: { m: MarketRow; msg: Messages; locale: Locale; city: string; tz: string; now?: Date }) {
  const text = question(m, msg, locale, city, tz, now);
  return <>{emphasize(text, m, city).map((x, i) => (x.b ? <b key={i} class="qb">{x.t}</b> : x.t))}</>;
}
