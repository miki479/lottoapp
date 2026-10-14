import { ChevronDown, X } from "lucide-preact";
import { useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { useBusy } from "../lib/busy.ts";
import { sb } from "../lib/api.ts";
import { Sheet } from "./Sheet.tsx";
import { fmtInt } from "../lib/num.ts";

type CatKey = keyof Messages["friends"]["cats"];
const MAIN: CatKey[] = ["friends", "family", "work", "dinner", "trip", "sport"];
const MORE: CatKey[] = ["games", "home", "school", "party", "music", "food", "pets", "tech", "money_fun", "random"];
const STAKES = [0, 10, 25, 50];
type CloseKey = keyof Messages["friends"]["closeOpts"];

/** Closing time presets, in the player's own time zone. */
function closeAt(k: CloseKey, custom = ""): Date {
  const d = new Date();
  if (k === "custom") return custom ? new Date(custom) : new Date(NaN);
  if (k === "h1") return new Date(d.getTime() + 3600_000);
  if (k === "h3") return new Date(d.getTime() + 3 * 3600_000);
  if (k === "d3") return new Date(d.getTime() + 3 * 86400_000);
  if (k === "d7") return new Date(d.getTime() + 7 * 86400_000);
  const t = new Date(d); t.setHours(k === "tonight" ? 21 : 12, 0, 0, 0);
  if (k === "tomorrow") t.setDate(t.getDate() + 1);
  if (t.getTime() < d.getTime() + 15 * 60_000) t.setDate(t.getDate() + 1);
  return t;
}

/** Write your own question for friends. Only people with the link see it; you are the judge. */
export function ChallengeMaker(p: { msg: Messages; locale: Locale; registered: boolean; hasHome: boolean; onClose: () => void; onCreated: (code: string) => void; onAuth: () => void }) {
  const f = p.msg.friends;
  const [title, setTitle] = useState(""), [cat, setCat] = useState<CatKey>("friends"), [more, setMore] = useState(false), [close, setClose] = useState<CloseKey>("tomorrow"), [stake, setStake] = useState(0), [customStake, setCustomStake] = useState(""), [customAt, setCustomAt] = useState("");
  const [vis, setVis] = useState<"private" | "friends" | "public">("private"), [judge, setJudge] = useState<"creator" | "vote">("vote"), [world, setWorld] = useState(false);
  const [busy, run] = useBusy(), [err, setErr] = useState<string | null>(null);
  const pub = vis === "public";
  const when = closeAt(close, customAt), whenOk = Number.isFinite(when.getTime()) && when.getTime() >= Date.now() + 10 * 60_000 && when.getTime() <= Date.now() + 30 * 86_400_000;
  const local = (t: number) => { const d = new Date(t); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const create = () => run(async () => {
    if (!p.registered) { p.onAuth(); return; }
    setErr(null);
    const { data, error } = await sb.rpc("create_challenge", { p_title: title.trim(), p_category: cat, p_stake: pub ? 0 : stake, p_closes_at: when.toISOString(), p_judge: pub ? "vote" : judge, p_visibility: vis, p_world: pub && world });
    if (error || !data?.code) {
      const key = Object.keys(f.errors).find((k) => error?.message?.includes(k)) as keyof typeof f.errors | undefined;
      const k2 = Object.keys(p.msg.fx.errors).find((k) => error?.message?.includes(k)) as keyof typeof p.msg.fx.errors | undefined;
      setErr(k2 ? p.msg.fx.errors[k2] : f.errors[key ?? "generic"]); return;
    }
    p.onCreated(String(data.code));
  }, () => setErr(f.errors.generic));
  const chip = (k: CatKey) => <button key={k} class={`mkchip ${cat === k ? "on" : ""}`} aria-pressed={cat === k} onClick={() => setCat(k)}>{f.cats[k]}</button>;
  return (
    <Sheet onClose={p.onClose} label={f.title}>
      <div class="shead"><h2>{f.title}</h2><button class="iconbtn" onClick={p.onClose} aria-label={p.msg.common.close}><X size={22} /></button></div>
      <p class="hint">{f.hint}</p>
      <label class="qmfield"><textarea class="field" rows={3} maxLength={120} value={title} placeholder={f.placeholder} onInput={(e) => setTitle((e.target as HTMLTextAreaElement).value)} /></label>
      <span class="detail">{f.category}</span>
      <div class="mkchips wrap">
        {MAIN.map(chip)}
        {more && MORE.map(chip)}
      </div>
      <button class={`morecats ${more ? "open" : ""}`} aria-expanded={more} onClick={() => setMore(!more)}>{more ? f.lessCats : f.moreCats}<ChevronDown size={16} /></button>
      <span class="detail">{f.closes}</span>
      <div class="mkchips wrap">{(Object.keys(f.closeOpts) as CloseKey[]).map((k) => <button key={k} class={`mkchip ${close === k ? "on" : ""}`} aria-pressed={close === k} onClick={() => setClose(k)}>{f.closeOpts[k]}</button>)}</div>
      {close === "custom" && <>
        <input class="field" type="datetime-local" value={customAt} min={local(Date.now() + 10 * 60_000)} max={local(Date.now() + 30 * 86_400_000)} aria-label={f.closeOpts.custom} onInput={(e) => setCustomAt((e.target as HTMLInputElement).value)} />
        <p class={customAt && !whenOk ? "formerr" : "hint"}>{customAt && !whenOk ? f.customBad : f.customHint}</p>
      </>}
      <span class="detail">{p.msg.fx.visibility}</span>
      <div class="mkchips">
        <button class={`mkchip ${vis === "private" ? "on" : ""}`} aria-pressed={vis === "private"} onClick={() => setVis("private")}>{p.msg.fx.vPrivate}</button>
        <button class={`mkchip ${vis === "friends" ? "on" : ""}`} aria-pressed={vis === "friends"} onClick={() => setVis("friends")}>{p.msg.fx.vFriends}</button>
        <button class={`mkchip ${vis === "public" ? "on" : ""}`} aria-pressed={vis === "public"} onClick={() => setVis("public")}>{p.msg.fx.vPublic}</button>
      </div>
      <p class="hint">{pub ? p.msg.fx.vPublicHint : vis === "friends" ? p.msg.fx.vFriendsHint : p.msg.fx.vPrivateHint}</p>
      {pub && !p.hasHome && <p class="formerr" role="note">{p.msg.fx.needHome}</p>}
      {pub && <label class="switchrow"><input type="checkbox" checked={world} onChange={(e) => setWorld((e.target as HTMLInputElement).checked)} /><span>{p.msg.fx.world}</span></label>}
      {!pub && <>
        <span class="detail">{p.msg.fx.judgeLabel}</span>
        <div class="mkchips">
          <button class={`mkchip ${judge === "vote" ? "on" : ""}`} aria-pressed={judge === "vote"} onClick={() => setJudge("vote")}>{p.msg.fx.judgeVote}</button>
          <button class={`mkchip ${judge === "creator" ? "on" : ""}`} aria-pressed={judge === "creator"} onClick={() => setJudge("creator")}>{p.msg.fx.judgeCreator}</button>
        </div>
        <p class="hint">{p.msg.fx.judgeHint}</p>
      </>}
      <span class="detail">{f.stake}</span>
      <div class="mkchips" style={pub ? "opacity:.5;pointer-events:none" : ""}>{STAKES.map((s) => <button key={s} class={`mkchip ${stake === s && customStake === "" ? "on" : ""}`} aria-pressed={stake === s && customStake === ""} onClick={() => { setCustomStake(""); setStake(s); }}>{s === 0 ? f.noStake : fmtInt(s)}</button>)}</div>
      {!pub && <input class="field" type="number" inputMode="numeric" min={0} max={1000} step={1} placeholder={f.customStake} value={customStake} onInput={(e) => { const raw = (e.target as HTMLInputElement).value; const n = Math.floor(Number(raw)); if (raw === "" || !Number.isFinite(n)) { setCustomStake(""); setStake(0); return; } const v = Math.max(0, Math.min(1000, n)); setCustomStake(String(v)); setStake(v); }} />}
      {!pub && stake > 0 && <p class="hint">{f.stakeNote}</p>}
      <p class="hint">{f.rules}</p>
      {err && <p class="formerr" role="alert">{err}</p>}
      <button class="btn primary wide" disabled={busy || !whenOk || title.trim().length < 8 || (pub && !p.hasHome)} aria-busy={busy} onClick={create}>{busy ? f.creating : f.create}</button>
    </Sheet>
  );
}
