import { Check, Users } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import type { Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { loadFriends, type FriendRow } from "../lib/friends.ts";

/** Invite some of my friends to one friend challenge. They get a notification and find it in "My bets". */
export function FriendPicker(p: { code: string; msg: Messages; onSent: (n: number) => void }) {
  const t = p.msg.frd;
  const [friends, setFriends] = useState<FriendRow[] | null>(null), [inside, setInside] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Set<string>>(new Set()), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null), [note, setNote] = useState<string | null>(null);
  const load = async () => {
    const [f, s] = await Promise.all([loadFriends(), sb.rpc("challenge_friend_state", { p_code: p.code })]);
    setFriends(f.filter((x) => !x.is_me)); setInside(new Set(((s.data ?? []) as string[]).map(String)));
  };
  useEffect(() => { load(); }, [p.code]);
  if (friends === null) return <div class="sk s" />;
  if (friends.length === 0) return <p class="hint">{t.invNoFriends}</p>;
  const toggle = (id: string) => { const n = new Set(sel); if (n.has(id)) n.delete(id); else n.add(id); setSel(n); setNote(null); };
  const send = async () => {
    if (sel.size === 0) return;
    setBusy(true); setErr(null); setNote(null);
    const { data, error } = await sb.rpc("invite_friends", { p_code: p.code, p_friends: [...sel] });
    setBusy(false);
    if (error) { const k = (Object.keys(t.errors) as (keyof typeof t.errors)[]).find((x) => error.message.includes(x)) ?? "generic"; setErr(t.errors[k]); return; }
    const n = Number(data ?? 0);
    setNote(n > 0 ? t.invSent(n) : t.invNone); setSel(new Set()); await load(); if (n > 0) p.onSent(n);
  };
  return (
    <section class="stack friendpick" style="gap:8px">
      <span class="detail"><Users size={14} /> {t.invTitle}</span>
      <p class="hint">{t.invHint}</p>
      <div class="frgrid">
        {friends.map((f) => {
          const done = inside.has(f.user_id), on = sel.has(f.user_id), name = f.display_name || t.anon;
          return (
            <button key={f.user_id} class={`frchip ${on ? "on" : ""} ${done ? "done" : ""}`} disabled={done} aria-pressed={on} onClick={() => toggle(f.user_id)}>
              <span class="fav" aria-hidden="true">{on || done ? <Check size={14} strokeWidth={3} /> : name.slice(0, 1).toUpperCase()}</span>
              <span class="fn"><span>{name}</span>{done && <em>{t.invDone}</em>}</span>
            </button>
          );
        })}
      </div>
      <button class="btn primary wide" disabled={sel.size === 0 || busy} onClick={send}>{t.invSend(sel.size)}</button>
      {note && <p class="hint" role="status">{note}</p>}
      {err && <p class="formerr" role="alert">{err}</p>}
    </section>
  );
}
