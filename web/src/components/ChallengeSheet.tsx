import { Share2, X } from "lucide-preact";
import { useCallback, useEffect, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { countdown, money } from "../lib/format.ts";
import { Sheet } from "./Sheet.tsx";

export interface Challenge {
  id: string; code: string; title: string; category: keyof Messages["friends"]["cats"]; stake: number; closes_at: string; status: "open" | "resolved" | "void"; outcome: "yes" | "no" | null;
  creator: string; is_creator: boolean; my_pick: "yes" | "no" | null; my_payout: number | null; yes: number; no: number; pot: number; people: { name: string; pick: "yes" | "no"; payout: number }[];
}

export const challengeLink = (code: string) => `${location.origin}/?c=${code}`;

/** One friend challenge: look, pick, wait for the judge; the judge decides after closing. */
export function ChallengeSheet(p: { code: string; msg: Messages; locale: Locale; now: number; registered: boolean; onClose: () => void; onAuth: () => void; onChanged: () => void }) {
  const f = p.msg.friends;
  const [c, setC] = useState<Challenge | null | undefined>(undefined);
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null), [copied, setCopied] = useState(false);
  const load = useCallback(async () => { const { data } = await sb.rpc("get_challenge", { p_code: p.code }); setC((data as Challenge | null) ?? null); }, [p.code]);
  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);
  const fail = (e: { message?: string } | null) => { const key = Object.keys(f.errors).find((k) => e?.message?.includes(k)) as keyof typeof f.errors | undefined; setErr(f.errors[key ?? "generic"]); };
  const act = async (fn: string, args: Record<string, unknown>) => {
    if (!p.registered) { p.onAuth(); return; }
    setBusy(true); setErr(null);
    const { data, error } = await sb.rpc(fn, args);
    setBusy(false);
    if (error) { fail(error); return; }
    setC(data as Challenge); p.onChanged();
  };
  const share = async () => {
    if (!c) return;
    const url = challengeLink(c.code), text = `${f.shareText} ${c.title}`;
    try { if (navigator.share) { await navigator.share({ title: "LateLotto", text, url }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(`${text} ${url}`); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* nothing */ }
  };
  const head = <div class="shead"><h2>{f.title}</h2><span class="grow" />{c && <button class="iconbtn" onClick={share} aria-label={f.share}><Share2 size={20} /></button>}<button class="iconbtn" onClick={p.onClose} aria-label={p.msg.common.close}><X size={22} /></button></div>;
  if (c === undefined) return <Sheet onClose={p.onClose} label={f.title}>{head}<div class="sk" /></Sheet>;
  if (c === null) return <Sheet onClose={p.onClose} label={f.title}>{head}<p class="hint">{f.errors.challenge_closed}</p></Sheet>;
  const left = Date.parse(c.closes_at) - p.now, isOpen = c.status === "open" && left > 0, awaiting = c.status === "open" && left <= 0;
  return (
    <Sheet onClose={p.onClose} label={f.title}>
      {head}
      <span class="byline">{f.cats[c.category]} · {c.creator || p.msg.ticker.anon}</span>
      <p class="q" style="font-weight:800;font-size:1.15rem">{c.title}</p>
      {copied && <p class="hint" role="status">{f.copied}</p>}
      <div class="tcstats">
        <span><em>{isOpen ? f.closesIn : f.closed}</em><b class="num">{isOpen ? countdown(left) : "—"}</b></span>
        <span><em>{f.perHead}</em><b class="num">{c.stake > 0 ? money(c.stake, p.locale) : f.noStake}</b></span>
        <span><em>{f.pot}</em><b class="num">{money(c.pot, p.locale)}</b></span>
        <span><em>{f.yes} / {f.no}</em><b class="num">{c.yes} / {c.no}</b></span>
      </div>
      {c.status === "resolved" && <p class="resultline"><b>{c.outcome === "yes" ? f.resolvedYes : f.resolvedNo}</b>{c.my_pick && c.my_payout !== null && c.my_payout > 0 ? ` · +${money(c.my_payout, p.locale)}` : ""}</p>}
      {c.status === "void" && <p class="resultline"><b>{f.voided}</b></p>}
      {isOpen && !c.my_pick && <>
        <span class="detail">{f.join}</span>
        <div class="actions2">
          {(["yes", "no"] as const).map((k) => <button key={k} class={`opt ${k}`} disabled={busy} onClick={() => act("pick_challenge", { p_code: c.code, p_pick: k })}><span class="l">{k === "yes" ? f.yes : f.no}</span></button>)}
        </div>
      </>}
      {isOpen && c.my_pick && <p class="hint"><b>{c.my_pick === "yes" ? f.yes : f.no}</b></p>}
      {awaiting && c.is_creator && <>
        <span class="detail">{f.decide}</span>
        <div class="actions2">
          <button class="opt yes" disabled={busy} onClick={() => act("resolve_challenge", { p_code: c.code, p_outcome: "yes" })}><span class="l">{f.decideYes}</span></button>
          <button class="opt no" disabled={busy} onClick={() => act("resolve_challenge", { p_code: c.code, p_outcome: "no" })}><span class="l">{f.decideNo}</span></button>
        </div>
        <button class="btn secondary wide" disabled={busy} onClick={() => act("resolve_challenge", { p_code: c.code, p_outcome: "void" })}>{f.decideVoid}</button>
      </>}
      {awaiting && !c.is_creator && <p class="hint">{f.waitJudge}: {c.creator || p.msg.ticker.anon}</p>}
      {c.people.length > 0 && <div class="tickchart"><div class="tchead"><b>{f.people}</b></div>
        {c.people.map((x, i) => <div key={i} class="tchead" style="padding:4px 0"><span>{x.name === "?" ? p.msg.ticker.anon : x.name}</span><span class="num"><b>{x.pick === "yes" ? f.yes : f.no}</b>{x.payout > 0 && c.status === "resolved" ? ` · ${f.won} ${money(x.payout, p.locale)}` : ""}</span></div>)}
      </div>}
      {err && <p class="formerr" role="alert">{err}</p>}
    </Sheet>
  );
}
