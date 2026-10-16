import { Users } from "lucide-preact";
import { useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { CROWD, CROWD_AVERAGE, CROWD_SOURCE, CROWD_YEAR } from "../lib/crowding.ts";

/** What a crowding rate feels like (MLIT's own reference points). */
const SCALE = [100, 150, 180, 200, 250] as const;

/** Tokyo trains: how packed the main lines are at the morning peak. Official yearly statistics, not live and not bettable. */
export function CrowdCard({ msg, locale }: { msg: Messages; locale: Locale }) {
  const [all, setAll] = useState(false);
  const rows = [...CROWD].sort((a, b) => b.pct - a.pct);
  const shown = all ? rows : rows.slice(0, 8);
  return (
    <section class="card crowdcard" aria-label={msg.crowd.title}>
      <div class="crowdhead"><span class="refico"><Users size={20} /></span><div><b>{msg.crowd.title}</b><p class="hint">{msg.crowd.note(CROWD_YEAR, CROWD_AVERAGE)}</p></div></div>
      <ul class="crowdlist">
        {shown.map((r) => (
          <li key={r.en}>
            <span class="cname">{locale === "ja" ? r.ja : r.en}<small>{r.seg}</small></span>
            <span class={`cbar ${r.pct >= 150 ? "hot" : r.pct >= 130 ? "warm" : "ok"}`}><i style={`width:${Math.min(100, Math.round((r.pct / 200) * 100))}%`} /></span>
            <b class="num">{r.pct}%</b>
          </li>
        ))}
      </ul>
      <button class="btn secondary wide" onClick={() => setAll(!all)}>{all ? msg.crowd.less : msg.crowd.all(rows.length)}</button>
      <details class="crowdscale"><summary>{msg.crowd.scaleTitle}</summary>
        <ul>{SCALE.map((s) => <li key={s}><b class="num">{s}%</b> {msg.crowd.scale[s]}</li>)}</ul>
      </details>
      <p class="hint">{msg.crowd.source} <a href={CROWD_SOURCE.url} target="_blank" rel="noopener noreferrer">{CROWD_SOURCE.name}</a> · <a href={CROWD_SOURCE.licenseUrl} target="_blank" rel="noopener noreferrer">{CROWD_SOURCE.license}</a></p>
    </section>
  );
}
