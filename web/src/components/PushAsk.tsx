import { Bell, X } from "lucide-preact";
import type { Locale, Messages } from "../i18n/index.ts";

export type PushVariant = "first" | "nag" | "blocked";
type Line = { t: string; b: string };
type Table = { first: Line; nag: Line[]; blocked: Line; ok: string };

// Playful on purpose: a little ironic, a little menacing, never about losses. Each language has its own jokes rather than a translation.
const T: Record<string, Table> = {
  it: {
    first: { t: "Posso avvisarti? 🔔", b: "Ti scrivo solo per cose che contano: super quote, bonus, esiti, eventi flash. Al massimo 2 al giorno, mai di notte. Se dici no ti guarderemo con affetto sospetto." },
    nag: [
      { t: "Le notifiche sono spente. LateBet se n'è accorto 👀", b: "Ti perdi bonus, super quote e regali. Non è una minaccia: è un fatto con un tono un po' inquietante." },
      { t: "Ehi, ti stiamo parlando 📣", b: "Senza notifiche non ti arrivano regali, quote speciali ed eventi flash. Noi non diciamo niente, ma i bus ritardano lo stesso e non ti avvisano." },
      { t: "Silenzio sospetto 🤫", b: "Le notifiche sono spente e i bonus passano senza che tu lo sappia. Riattivale, o continueremo a guardarti con affetto minaccioso." },
      { t: "Un piccolo promemoria dal fondo dello schermo 🕵️", b: "LateBet ti guarda, ma non può chiamarti. Con le notifiche attive, invece, ti bussa gentilmente alla porta." },
    ],
    blocked: { t: "Le notifiche sono bloccate dal telefono 🔒", b: "Le hai bloccate dalle impostazioni del telefono o del browser: riattivale da lì (Impostazioni → Notifiche → LateBet) e torneremo a bussare con garbo. Noi nel frattempo restiamo qui a guardarti 👀" },
    ok: "Ho capito",
  },
  "en-US": {
    first: { t: "May I tap you on the shoulder? 🔔", b: "Only for things that matter: super odds, bonuses, results, flash events. Two a day at most, never at night. Say no and we will look at you with mild suspicion." },
    nag: [
      { t: "Notifications are off. LateBet noticed 👀", b: "You are missing bonuses, super odds and gifts. Not a threat: a fact delivered in a slightly eerie tone." },
      { t: "Hey, we are talking to you 📣", b: "Without notifications no gifts, special odds or flash events reach you. We will not say a word, but the buses will keep running late without telling you." },
      { t: "Suspicious silence 🤫", b: "Notifications are off and bonuses slip by unnoticed. Turn them back on, or we will keep watching you with menacing affection." },
      { t: "A small reminder from the bottom of your screen 🕵️", b: "LateBet is watching, but it cannot call you. With notifications on, it knocks politely instead." },
    ],
    blocked: { t: "Notifications are blocked by your phone 🔒", b: "They are blocked in your phone or browser settings: switch them back on there (Settings → Notifications → LateBet) and we will go back to knocking politely. Meanwhile we will be here, watching 👀" },
    ok: "Got it",
  },
  ja: {
    first: { t: "お知らせしてもいいですか？🔔", b: "大事なことだけ：スーパーオッズ、ボーナス、結果、フラッシュイベント。1日2回まで、夜は送りません。断られたら、ちょっと疑いの目で見守ります。" },
    nag: [
      { t: "通知がオフです。LateBetは気づいています👀", b: "ボーナスやスーパーオッズ、プレゼントを逃しています。脅しではなく、少し不気味な口調の事実です。" },
      { t: "ねえ、あなたに話しかけています📣", b: "通知がないと、プレゼントも特別オッズもフラッシュイベントも届きません。バスは通知なしでも遅れ続けます。" },
      { t: "あやしい静けさ🤫", b: "通知がオフだと、ボーナスに気づかないまま過ぎていきます。オンに戻さないと、脅すような愛情でずっと見つめ続けます。" },
      { t: "画面の下からささやかなお知らせ🕵️", b: "LateBetは見ていますが、電話はできません。通知をオンにすれば、そっとノックします。" },
    ],
    blocked: { t: "通知が端末でブロックされています🔒", b: "端末またはブラウザの設定でブロックされています。そこでオンに戻してください（設定 → 通知 → LateBet）。その間も、こちらから見守っています👀" },
    ok: "わかりました",
  },
};
const tableOf = (l: Locale): Table => T[l] ?? T[l === "en-GB" ? "en-US" : "en-US"]!;

/** The question about notifications: asked right at the start, and again now and then (with a different joke) while they stay off. */
export function PushAsk({ msg, locale, variant, n = 0, lifted, onYes, onNo }: { msg: Messages; locale: Locale; variant: PushVariant; n?: number; lifted: boolean; onYes: () => void; onNo: () => void }) {
  const t = tableOf(locale), line = variant === "first" ? t.first : variant === "blocked" ? t.blocked : t.nag[n % t.nag.length]!;
  return (
    <div class={`pushask ${lifted ? "lifted" : ""}`} role="dialog" aria-label={line.t}>
      <span class="pi"><Bell size={20} /></span>
      <div class="pt"><b>{line.t}</b><span>{line.b}</span></div>
      <div class="pb">
        {variant === "blocked"
          ? <button class="btn primary" onClick={onNo}>{t.ok}</button>
          : <><button class="btn primary" onClick={onYes}>{msg.push.yes}</button><button class="btn secondary" onClick={onNo}><X size={16} />{msg.push.later}</button></>}
      </div>
    </div>
  );
}
