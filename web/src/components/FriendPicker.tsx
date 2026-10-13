import { Check } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { useBusy } from "../lib/busy.ts";
import { Collapse } from "./Collapse.tsx";
import { loadFriends, type FriendRow } from "../lib/friends.ts";
import { Look } from "./looks/Look.tsx";
import { PlayerTitle } from "./PlayerTitle.tsx";
import { useLooks } from "../lib/looks.ts";

/** Invite some of my friends to one friend challenge. They get a notification and find it in "My bets". */
export function FriendPicker(p: { code: string; locale: Locale; msg: Messages; onSent: (n: number) => void }) {
  const t = p.msg.frd;
  const [friends, setFriends] = useState<FriendRow[] | null>(null), [inside, setInside] = useState<Map<string, "joined" | "invited">>(new Map());
  const [sel, setSel] = useState<Set<string>>(new Set()), [err, setErr] = useState<string | null>(null), [note, setNote] = useState<string | null>(null);
  const [busy, run] = useBusy();
  const load = async () => {
    const [f, s] = await Promise.all([loadFriends(), sb.rpc("challenge_friend_state2", { p_code: p.code })]);
    setFriends(f.filter((x) => !x.is_me)); setInside(new Map(((s.data ?? []) as { id: string; state: "joined" | "invited" }[]).map((x) => [String(x.id), x.state])));
  };
  useEffect(() => { load(); }, [p.code]);
  const looks = useLooks((friends ?? []).map((x) => x.user_id));
  if (friends === null) return <div class="sk s" />;
  if (friends.length === 0) return <p class="hint">{t.invNoFriends}</p>;
  const toggle = (id: string) => { const n = new Set(sel); if (n.has(id)) n.delete(id); else n.add(id); setSel(n); setNote(null); };
  const send = () => sel.size === 0 ? undefined : run(async () => {
    setErr(null); setNote(null);
    const { data, error } = await sb.rpc("invite_friends", { p_code: p.code, p_friends: [...sel] });
    if (error) { const k = (Object.keys(t.errors) as (keyof typeof t.errors)[]).find((x) => error.message.includes(x)) ?? "generic"; setErr(t.errors[k]); return; }
    const n = Number(data ?? 0);
    setNote(n > 0 ? t.invSent(n) : t.invNone); setSel(new Set()); await load(); if (n > 0) p.onSent(n);
  }, () => setErr(t.errors.generic));
  return (
    <Collapse id="friendpick" class="friendpick" title={t.invTitle} open={true}>
      <p class="hint">{t.invHint}</p>
      <div class="frgrid">
        {friends.map((f) => {
          const st = inside.get(f.user_id), done = !!st, on = sel.has(f.user_id), name = f.display_name || t.anon;
          return (
            <button key={f.user_id} class={`frchip ${on ? "on" : ""} ${done ? "done" : ""}`} disabled={done} aria-pressed={on} onClick={() => toggle(f.user_id)}>
              <span class="fav" aria-hidden="true">{looks[f.user_id] ? <Look avatar={looks[f.user_id]!.avatar} decoration={looks[f.user_id]!.decoration} size={30} /> : on || done ? <Check size={14} strokeWidth={3} /> : name.slice(0, 1).toUpperCase()}</span>
              <span class="fn"><span>{name}</span><PlayerTitle id={looks[f.user_id]?.title} locale={p.locale} />{done && <em>{st === "joined" ? t.invJoined : t.invDone}</em>}</span>
            </button>
          );
        })}
      </div>
      <button class="btn primary wide" disabled={sel.size === 0 || busy} aria-busy={busy} onClick={send}>{t.invSend(sel.size)}</button>
      {note && <p class="hint" role="status">{note}</p>}
      {err && <p class="formerr" role="alert">{err}</p>}
    </Collapse>
  );
}
