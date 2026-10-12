import { Bell, BellRing } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import type { Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";

/** "Remind me": the day before a question we wrote closes the player gets a push. It only touches our own database, no outside service is called. */
export function Remind({ id, msg }: { id: string; msg: Messages }) {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => { let live = true; sb.rpc("my_reminders").then(({ data }) => { if (live) setOn(((data ?? []) as string[]).includes(id)); }); return () => { live = false; }; }, [id]);
  const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  const toggle = async () => { if (busy) return; setBusy(true); setFailed(false); const { data, error } = await sb.rpc("toggle_reminder", { p_market: id }); setBusy(false); if (error) setFailed(true); else setOn(!!data); };
  const noPush = on && typeof Notification !== "undefined" && Notification.permission !== "granted";
  return (
    <div class="remind">
      <button class={`btn secondary ${on ? "on" : ""}`} aria-pressed={!!on} disabled={on === null || busy} onClick={toggle}>{on ? <BellRing size={18} /> : <Bell size={18} />}{on ? msg.house.reminding : msg.house.remind}</button>
      {noPush && <p class="hint">{msg.house.needPush}</p>}
      {failed && <p class="formerr" role="alert">{msg.errors.generic}</p>}
    </div>
  );
}
