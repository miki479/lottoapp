import { CircleAlert, CircleCheck } from "lucide-preact";

export function Toast({ text, kind = "ok" }: { text: string; kind?: "ok" | "err" }) {
  return <div class="toast" role="status">{kind === "ok" ? <CircleCheck size={18} /> : <CircleAlert size={18} />}<span>{text}</span></div>;
}
