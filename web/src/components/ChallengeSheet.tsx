import { Share2, X } from "lucide-preact";
import { useCallback, useEffect, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { useBusy } from "../lib/busy.ts";
import { every } from "../lib/poll.ts";
import { countdown, money } from "../lib/format.ts";
import { FriendPicker } from "./FriendPicker.tsx";
import { Sheet } from "./Sheet.tsx";
import { Look } from "./looks/Look.tsx";
import { PlayerTitle } from "./PlayerTitle.tsx";
import { useLooks } from "../lib/looks.ts";
import { moneySigned } from "../lib/num.ts";

export interface Challenge {
  id: string; code: string; title: string; category: keyof Messages["friends"]["cats"]; stake: number; closes_at: string; status: "open" | "resolved" | "void"; outcome: "yes" | "no" | null; judge_mode: "creator" | "vote"; visibility: "private" | "public"; my_vote: "yes" | "no" | null; voted: number;
  creator: string; is_creator: boolean; my_pick: "yes" | "no" | null; my_payout: number | null; yes: number; no: number; pot: number; people: { uid?: string; name: string; pick: "yes" | "no" | null; payout: number | null }[];
}

export const challengeLink = (code: string) => `${location.origin}/?c=${code}`;

/** One friend challenge: look, pick, wait for the judge; the judge decides after closing. */
export function ChallengeSheet(p: { code: string; msg: Messages; locale: Locale; now: number; registered: boolean; onClose: () => void; onAuth: () => void; onChanged: () => void; onDeleted: (text: string) => void }) {
  const f = p.msg.friends;
  const [c, setC] = useState<Challenge | null | undefined>(undefined);
  const [busy, run] = useBusy(), [err, setErr] = useState<string | null>(null), [copied, setCopied] = useState(false);
  const looks = useLooks((c?.people ?? []).flatMap((x) => (x.uid ? [x.uid] : [])));
  const load = useCallback(async () => { const { data } = await sb.rpc("get_challenge", { p_code: p.code }); setC((data as Challenge | null) ?? null); }, [p.code]);
  useEffect(() => { load(); return every(load, 20_000); }, [load]);
  const fail = (e: { message?: string } | null) => { const key = Object.keys(f.errors).find((k) => e?.message?.includes(k)) as keyof typeof f.errors | undefined; const k2 = Object.keys(p.msg.fx.errors).find((k) => e?.message?.includes(k)) as keyof typeof p.msg.fx.errors | undefined; setErr(k2 ? p.msg.fx.errors[k2] : f.errors[key ?? "generic"]); };
  const oops = () => setErr(f.errors.generic);
  const act = (fn: string, args: Record<string, unknown>) => run(async () => {
    if (!p.registered) { p.onAuth(); return; }
    setErr(null);
    const { data, error } = await sb.rpc(fn, args);
    if (error) { fail(error); return; }
    setC(data as Challenge); p.onChanged();
  }, oops);
  const [asking, setAsking] = useState(false);
  const remove = () => run(async () => {
    setErr(null);
    const { data, error } = await sb.rpc("cancel_challenge", { p_code: p.code });
    if (error) { fail(error); return; }
    p.onChanged(); p.onDeleted(data === "deleted" ? f.deleted : f.voidedMsg);
  }, oops);
  const [reported, setReported] = useState(false);
  const [reporting, doReport] = useBusy();
  const report = () => c ? doReport(async () => { const { error } = await sb.rpc("report_challenge", { p_code: c.code }); if (error) throw error; setReported(true); }, oops) : undefined;
  /** What one more player would take home on a side: the pot with their stake in it, split among everyone on that side. */
  const winIf = (side: "yes" | "no") => (c && c.stake > 0 ? Math.floor((c.pot + c.stake) / ((side === "yes" ? c.yes : c.no) + 1)) : 0);
  const share = async () => {
    if (!c) return;
    const url = challengeLink(c.code), best = Math.max(winIf("yes"), winIf("no")), text = `${f.shareText} ${c.title}${c.stake > 0 ? ` ${f.shareStake(money(c.pot, p.locale), money(best, p.locale))}` : ""}`;
    try { if (navigator.share) { await navigator.share({ title: "LateBet", text, url }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(`${text} ${url}`); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* nothing */ }
  };
  const head = <div class="shead"><h2>{f.title}</h2><span class="grow" />{c && <button class="iconbtn" onClick={share} aria-label={f.share}><Share2 size={20} /></button>}<button class="iconbtn" onClick={p.onClose} aria-label={p.msg.common.close}><X size={22} /></button></div>;
  if (c === undefined) return <Sheet onClose={p.onClose} label={f.title}>{head}<div class="sk" /></Sheet>;
  if (c === null) return <Sheet onClose={p.onClose} label={f.title}>{head}<p class="hint">{f.errors.challenge_closed}</p></Sheet>;
  const left = Date.parse(c.closes_at) - p.now, isOpen = c.status === "open" && left > 0, awaiting = c.status === "open" && left <= 0;
  return (
    <Sheet onClose={p.onClose} label={f.title}>
      {head}
      <span class="byline">{f.cats[c.category]} · {c.creator || p.msg.ticker.anon} · {c.visibility === "public" ? p.msg.fx.publicBadge : p.msg.fx.privateBadge} · {c.judge_mode === "vote" ? p.msg.fx.byVote : p.msg.fx.byJudge}</span>
      <p class="q" style="font-weight:800;font-size:var(--fs-lg)">{c.title}</p>
      {copied && <p class="hint" role="status">{f.copied}</p>}
      <div class="tcstats">
        <span><em>{isOpen ? f.closesIn : f.closed}</em><b class="num">{isOpen ? countdown(left) : "—"}</b></span>
        <span><em>{f.perHead}</em><b class="num">{c.stake > 0 ? money(c.stake, p.locale) : f.noStake}</b></span>
        <span><em>{f.pot}</em><b class="num">{money(c.pot, p.locale)}</b></span>
        <span><em>{f.yes} / {f.no}</em><b class="num">{c.yes} / {c.no}</b></span>
      </div>
      {c.status === "resolved" && <p class="resultline"><b>{c.outcome === "yes" ? f.resolvedYes : f.resolvedNo}</b>{c.my_pick && c.my_payout !== null && c.my_payout > 0 ? ` · ${moneySigned(c.my_payout, p.locale)}` : ""}</p>}
      {c.status === "void" && <p class="resultline"><b>{f.voided}</b></p>}
      {isOpen && !c.my_pick && c.judge_mode === "creator" && c.is_creator && <p class="hint">{p.msg.fx.judgeCant}</p>}
      {isOpen && !c.my_pick && !(c.judge_mode === "creator" && c.is_creator) && <>
        <span class="detail">{p.registered ? f.join : f.joinToo}</span>
        <div class="actions2">
          {(["yes", "no"] as const).map((k) => <button key={k} class={`opt ${k}`} disabled={busy} onClick={() => act("pick_challenge", { p_code: c.code, p_pick: k })}><span class="l">{k === "yes" ? f.yes : f.no}</span>{c.stake > 0 && <small class="num">{f.potential}: {money(winIf(k), p.locale)}</small>}</button>)}
        </div>
      </>}
      {isOpen && c.my_pick && <p class="hint"><b>{c.my_pick === "yes" ? f.yes : f.no}</b></p>}
      {isOpen && p.registered && (c.is_creator || c.my_pick) && <FriendPicker code={c.code} locale={p.locale} msg={p.msg} onSent={() => p.onChanged()} />}
      {awaiting && c.judge_mode === "vote" && c.my_pick && !c.my_vote && <>
        <span class="detail">{p.msg.fx.voteTitle}</span>
        <div class="actions2">
          <button class="opt yes" disabled={busy} onClick={() => act("vote_challenge", { p_code: c.code, p_outcome: "yes" })}><span class="l">{f.decideYes}</span></button>
          <button class="opt no" disabled={busy} onClick={() => act("vote_challenge", { p_code: c.code, p_outcome: "no" })}><span class="l">{f.decideNo}</span></button>
        </div>
      </>}
      {awaiting && c.judge_mode === "vote" && c.my_vote && <p class="hint">{p.msg.fx.voteDone}: <b>{c.my_vote === "yes" ? f.yes : f.no}</b> · {p.msg.fx.voteWait} ({c.voted}/{c.yes + c.no})</p>}
      {awaiting && c.judge_mode === "creator" && c.is_creator && <>
        <span class="detail">{f.decide}</span>
        <div class="actions2">
          <button class="opt yes" disabled={busy} onClick={() => act("resolve_challenge", { p_code: c.code, p_outcome: "yes" })}><span class="l">{f.decideYes}</span></button>
          <button class="opt no" disabled={busy} onClick={() => act("resolve_challenge", { p_code: c.code, p_outcome: "no" })}><span class="l">{f.decideNo}</span></button>
        </div>
        <button class="btn secondary wide" disabled={busy} onClick={() => act("resolve_challenge", { p_code: c.code, p_outcome: "void" })}>{f.decideVoid}</button>
      </>}
      {awaiting && c.judge_mode === "creator" && !c.is_creator && <p class="hint">{f.waitJudge}: {c.creator || p.msg.ticker.anon}</p>}
      {isOpen && c.is_creator && (asking
        ? <div class="frask" role="alert"><span>{c.yes + c.no - (c.my_pick ? 1 : 0) > 0 ? f.askJoined : f.askSolo}</span><button class="btn secondary" disabled={busy} onClick={() => setAsking(false)}>{f.deleteNo}</button><button class="btn primary" disabled={busy} aria-busy={busy} onClick={remove}>{f.deleteYes}</button></div>
        : <button class="btn secondary" onClick={() => setAsking(true)}>{f.deleteBtn}</button>)}
      {c.visibility === "public" && !c.is_creator && <button class="btn secondary" disabled={reported || reporting} aria-busy={reporting} onClick={report}>{reported ? p.msg.fx.reported : p.msg.fx.report}</button>}
      {c.people.length > 0 && <div class="tickchart"><div class="tchead"><b>{f.people}</b></div>
        {[...c.people].sort((a, b) => (a.name === "?" ? "~" : a.name).localeCompare(b.name === "?" ? "~" : b.name, p.locale)).map((x, i) => (
          <div key={i} class="pplrow">
            <span class="lkwrap">{x.uid && looks[x.uid] ? <Look avatar={looks[x.uid]!.avatar} decoration={looks[x.uid]!.decoration} size={26} /> : <span class="lkph" />}</span>
            <span class="pplname">{x.name === "?" ? p.msg.ticker.anon : x.name}<PlayerTitle id={x.uid ? looks[x.uid]?.title : null} locale={p.locale} /></span>
            <span class="num pplpick"><b>{x.pick === null ? "✓" : x.pick === "yes" ? f.yes : f.no}</b>{(x.payout ?? 0) > 0 && c.status === "resolved" ? ` · ${f.won} ${money(x.payout ?? 0, p.locale)}` : ""}</span>
          </div>
        ))}
      </div>}
      {err && <p class="formerr" role="alert">{err}</p>}
    </Sheet>
  );
}
