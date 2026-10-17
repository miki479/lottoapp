import { Check, Mail, Send } from "lucide-preact";
import { useState } from "preact/hooks";
import type { Locale } from "../i18n/index.ts";
import { useBusy } from "../lib/busy.ts";
import { sb } from "../lib/api.ts";

const T: Record<string, { open: string; msg: string; email: string; send: string; sent: string; fail: string; short: string; limit: string }> = {
  it: { open: "Scrivici", msg: "Il tuo messaggio", email: "La tua email (facoltativa, per risponderti)", send: "Invia", sent: "Messaggio inviato, grazie!", fail: "Non riesco a inviarlo. Riprova tra poco.", short: "Scrivi almeno 10 caratteri.", limit: "Hai già scritto molto oggi: riprova domani." },
  "en-US": { open: "Write to us", msg: "Your message", email: "Your email (optional, so we can reply)", send: "Send", sent: "Message sent, thank you!", fail: "Could not send it. Try again soon.", short: "Write at least 10 characters.", limit: "You've written a lot today: try again tomorrow." },
  "en-GB": { open: "Write to us", msg: "Your message", email: "Your email (optional, so we can reply)", send: "Send", sent: "Message sent, thank you!", fail: "Could not send it. Try again soon.", short: "Write at least 10 characters.", limit: "You've written a lot today: try again tomorrow." },
  ja: { open: "お問い合わせ", msg: "メッセージ", email: "メールアドレス（任意・返信用）", send: "送信", sent: "送信しました。ありがとうございます！", fail: "送信できませんでした。しばらくしてからもう一度お試しください。", short: "10文字以上入力してください。", limit: "本日の送信上限です。明日もう一度お試しください。" },
};

/** The contact form of the footer: it goes to the server, which keeps the message and forwards it; the address it ends up at is never in the app. */
export function ContactForm({ locale }: { locale: Locale }) {
  const t = T[locale] ?? T["en-US"]!;
  const [open, setOpen] = useState(false), [text, setText] = useState(""), [email, setEmail] = useState(""), [trap, setTrap] = useState("");
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, run] = useBusy();
  const send = () => run(async () => {
    setNote(null);
    if (text.trim().length < 10) { setNote({ ok: false, text: t.short }); return; }
    const { data, error } = await sb.functions.invoke("contact", { body: { message: text, email, website: trap } });
    if (error || !(data as { ok?: boolean } | null)?.ok) {
      const limited = String((error as { context?: { status?: number } } | null)?.context?.status) === "429";
      setNote({ ok: false, text: limited ? t.limit : t.fail }); return;
    }
    setText(""); setNote({ ok: true, text: t.sent });
  }, () => setNote({ ok: false, text: t.fail }));
  return (
    <div class="contact">
      <button type="button" class="link contactopen" aria-expanded={open} onClick={() => setOpen(!open)}><Mail size={16} aria-hidden="true" />{t.open}</button>
      {open && (
        <form class="contactform" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <textarea class="field" rows={4} maxLength={2000} placeholder={t.msg} aria-label={t.msg} value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
          <input class="field" type="email" autocomplete="email" inputMode="email" maxLength={200} placeholder={t.email} aria-label={t.email} value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
          <input class="hp" type="text" name="website" tabIndex={-1} autocomplete="off" aria-hidden="true" value={trap} onInput={(e) => setTrap((e.target as HTMLInputElement).value)} />
          {note && <p class={note.ok ? "note" : "formerr"} role="status">{note.ok && <Check size={14} aria-hidden="true" />} {note.text}</p>}
          <button class="btn primary" type="submit" disabled={busy} aria-busy={busy}><Send size={16} aria-hidden="true" />{t.send}</button>
        </form>
      )}
    </div>
  );
}
