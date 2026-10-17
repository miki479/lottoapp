import { useEffect, useState } from "preact/hooks";
import { sb } from "../lib/api.ts";
import type { Messages } from "../i18n/index.ts";
import { HALLOWEEN_PICTURES, type HalloweenId } from "../../../shared/halloween.ts";

type Row = { id: HalloweenId; category: "train" | "weather" | "traffic" | "finance" | "sport"; wins: number; target: number; unlocked: boolean };
type Status = { published: boolean; starts_at?: string | null; ends_at?: string | null; settle_by?: string | null; challenges?: Row[] };

const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

/** The five Halloween cards. Hidden while the event is a draft; the counting happens in the database (halloween_status). */
export function HalloweenChallenges({ msg }: { msg: Messages }) {
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => { let live = true; sb.rpc("halloween_status").then(({ data }) => { if (live && data) setS(data as Status); }); return () => { live = false; }; }, []);
  if (!s?.published || !s.challenges?.length) return null;
  const h = msg.halloween;
  const dated = s.starts_at && s.ends_at;
  return (
    <section class="halloween" aria-label={h.title}>
      <h2>{h.title}</h2>
      <p class="hint">{dated ? h.period.replace("{from}", day(s.starts_at)).replace("{to}", day(s.ends_at)) : h.notSet}{dated && s.settle_by ? ` · ${h.settle.replace("{settle}", day(s.settle_by))}` : ""}</p>
      <div class="hwgrid">
        {s.challenges.map((c) => {
          const t = msg.profile.trophy[c.id], pic = HALLOWEEN_PICTURES.includes(c.id);
          return (
            <article class={`card hwcard ${c.unlocked ? "on" : "off"}`} key={c.id} data-cat={c.category}>
              <div class="hwpic">{pic ? <img src={`/trophies/${c.id}.webp?v=8`} width={112} height={112} alt="" loading="lazy" decoding="async" /> : <span class="hwempty">{h.noPicture}</span>}</div>
              <div class="hwbody">
                <small class="detail">{h.cat}: {msg.tabs[c.category]}</small>
                <b>{t.name}</b>
                <small>{t.desc}</small>
                <div class="hwprog" role="progressbar" aria-valuemin={0} aria-valuemax={c.target} aria-valuenow={c.wins}>
                  {Array.from({ length: c.target }, (_, i) => <i key={i} class={i < c.wins ? "full" : ""} />)}
                  <span class="num">{h.progress.replace("{n}", String(c.wins)).replace("{t}", String(c.target))}</span>
                </div>
                <span class="hwstate">{c.unlocked ? h.unlocked : h.locked}</span>
              </div>
            </article>
          );
        })}
      </div>
      <details class="hwrules"><summary>{h.rulesBtn}</summary><ul>{h.rules.map((r) => <li key={r}>{r}</li>)}</ul></details>
    </section>
  );
}
