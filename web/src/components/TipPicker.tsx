import { Check } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import type { Locale, Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { useBusy } from "../lib/busy.ts";
import { loadFriends, type FriendRow } from "../lib/friends.ts";
import { Look } from "./looks/Look.tsx";
import { useLooks } from "../lib/looks.ts";
import type { Pick } from "../lib/types.ts";

/** "Tip a friend": choose friends, they get a push and open this very question with a "X suggests you bet on this" banner. */
export function TipPicker(p: { marketId: string; pick: Pick; locale: Locale; msg: Messages }) {
  const t = p.msg.tip;
  const [friends, setFriends] = useState<FriendRow[] | null>(null), [sel, setSel] = useState<Set<string>>(new Set()), [note, setNote] = useState<string | null>(null), [err, setErr] = useState<string | null>(null);
  const [busy, run] = useBusy();
  useEffect(() => { loadFriends().then((f) => setFriends(f.filter((x) => !x.is_me)), () => setFriends([])); }, []);
  const looks = useLooks((friends ?? []).map((x) => x.user_id));
  if (friends === null) return <div class="sk s" />;
  if (friends.length === 0) return <p class="hint">{t.noFriends}</p>;
  const toggle = (id: string) => { const n = new Set(sel); if (n.has(id)) n.delete(id); else n.add(id); setSel(n); setNote(null); };
  const send = () => sel.size === 0 ? undefined : run(async () => {
    setErr(null); setNote(null);
    const { data, error } = await sb.rpc("tip_bet", { p_to: [...sel], p_market: p.marketId, p_pick: p.pick });
    if (error) { setErr(t.error); return; }
    const n = Number(data ?? 0);
    setNote(n > 0 ? t.sent(n) : t.none); setSel(new Set());
  }, () => setErr(t.error));
  return (
    <div class="friendpick tippick">
      <p class="hint">{t.hint}</p>
      <div class="frgrid">
        {friends.map((f) => {
          const on = sel.has(f.user_id), name = f.display_name || p.msg.frd.anon;
          return (
            <button key={f.user_id} class={`frchip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggle(f.user_id)}>
              <span class="fav" aria-hidden="true">{looks[f.user_id] ? <Look avatar={looks[f.user_id]!.avatar} decoration={looks[f.user_id]!.decoration} aura={looks[f.user_id]!.aura} size={30} /> : on ? <Check size={14} strokeWidth={3} /> : name.slice(0, 1).toUpperCase()}</span>
              <span class="fn"><span>{name}</span></span>
            </button>
          );
        })}
      </div>
      <button class="btn primary wide" disabled={sel.size === 0 || busy} aria-busy={busy} onClick={send}>{t.send(sel.size)}</button>
      {note && <p class="hint" role="status">{note}</p>}
      {err && <p class="formerr" role="alert">{err}</p>}
    </div>
  );
}
