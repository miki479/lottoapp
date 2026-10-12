import { ChevronDown, X } from "lucide-preact";
import { useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { Sheet } from "./Sheet.tsx";

type CatKey = keyof Messages["friends"]["cats"];
const MAIN: CatKey[] = ["friends", "family", "work", "dinner", "trip", "sport"];
const MORE: CatKey[] = ["games", "home", "school", "party", "music", "food", "pets", "tech", "money_fun", "random"];
const STAKES = [0, 10, 25, 50];
type CloseKey = keyof Messages["friends"]["closeOpts"];

/** Closing time presets, in the player's own time zone. */
function closeAt(k: CloseKey): Date {
  const d = new Date();
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
export function ChallengeMaker(p: { msg: Messages; locale: Locale; registered: boolean; onClose: () => void; onCreated: (code: string) => void; onAuth: () => void }) {
  const f = p.msg.friends;
  const [title, setTitle] = useState(""), [cat, setCat] = useState<CatKey>("friends"), [more, setMore] = useState(false), [close, setClose] = useState<CloseKey>("tomorrow"), [stake, setStake] = useState(0);
  const [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  const create = async () => {
    if (!p.registered) { p.onAuth(); return; }
    setBusy(true); setErr(null);
    const { data, error } = await sb.rpc("create_challenge", { p_title: title.trim(), p_category: cat, p_stake: stake, p_closes_at: closeAt(close).toISOString() });
    setBusy(false);
    if (error || !data?.code) {
      const key = Object.keys(f.errors).find((k) => error?.message?.includes(k)) as keyof typeof f.errors | undefined;
      setErr(f.errors[key ?? "generic"]); return;
    }
    p.onCreated(String(data.code));
  };
  const chip = (k: CatKey) => <button key={k} class={`mkchip ${cat === k ? "on" : ""}`} aria-pressed={cat === k} onClick={() => setCat(k)}>{f.cats[k]}</button>;
  return (
    <Sheet onClose={p.onClose} label={f.title}>
      <div class="shead"><h2>{f.title}</h2><button class="iconbtn" onClick={p.onClose} aria-label={p.msg.common.close}><X size={22} /></button></div>
      <p class="hint">{f.hint}</p>
      <label class="qmfield"><textarea class="field" rows={3} maxLength={120} value={title} placeholder={f.placeholder} onInput={(e) => setTitle((e.target as HTMLTextAreaElement).value)} /></label>
      <span class="detail">{f.category}</span>
      <div class="mkchips">
        {MAIN.map(chip)}
        {more && MORE.map(chip)}
      </div>
      <button class={`morecats ${more ? "open" : ""}`} aria-expanded={more} onClick={() => setMore(!more)}>{more ? f.lessCats : f.moreCats}<ChevronDown size={16} /></button>
      <span class="detail">{f.closes}</span>
      <div class="mkchips">{(Object.keys(f.closeOpts) as CloseKey[]).map((k) => <button key={k} class={`mkchip ${close === k ? "on" : ""}`} aria-pressed={close === k} onClick={() => setClose(k)}>{f.closeOpts[k]}</button>)}</div>
      <span class="detail">{f.stake}</span>
      <div class="mkchips">{STAKES.map((s) => <button key={s} class={`mkchip ${stake === s ? "on" : ""}`} aria-pressed={stake === s} onClick={() => setStake(s)}>{s === 0 ? f.noStake : s}</button>)}</div>
      {stake > 0 && <p class="hint">{f.stakeNote}</p>}
      <p class="hint">{f.rules}</p>
      {err && <p class="formerr" role="alert">{err}</p>}
      <button class="btn primary wide" disabled={busy || title.trim().length < 8} onClick={create}>{busy ? f.creating : f.create}</button>
    </Sheet>
  );
}
