import { Mail, X } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { sb } from "../lib/api.ts";

interface Msg { id: string; heading: string; body: string }
/** A message from the team (also sent as a push), shown on top of Home until it is dismissed. */
export function Inbox({ registered, ok }: { registered: boolean; ok: string }) {
  const [list, setList] = useState<Msg[]>([]);
  useEffect(() => { if (registered) sb.rpc("my_messages").then(({ data }) => setList((data ?? []) as Msg[])); }, [registered]);
  if (list.length === 0) return null;
  const m = list[0]!;
  const done = () => { void sb.rpc("read_message", { p_id: m.id }); setList((l) => l.filter((x) => x.id !== m.id)); };
  return (
    <section class="card stack inbox" role="status">
      <div class="fyhead"><Mail size={20} /><b>{m.heading}</b><span class="grow" /><button class="iconbtn" onClick={done} aria-label={ok}><X size={18} /></button></div>
      <p>{m.body}</p>
      <button class="btn primary" onClick={done}>{ok}</button>
    </section>
  );
}
