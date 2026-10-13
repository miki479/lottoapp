import { CircleAlert, CircleCheck } from "lucide-preact";

export function Toast({ text, kind = "ok", lift = false }: { text: string; kind?: "ok" | "err"; lift?: boolean }) {
  return <div class={`toast ${lift ? "lift" : ""}`} role="status">{kind === "ok" ? <CircleCheck size={18} /> : <CircleAlert size={18} />}<span>{text}</span></div>;
}
