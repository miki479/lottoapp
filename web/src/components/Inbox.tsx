import { createPortal } from "preact/compat";
import { Coins, Mail, X, Zap } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { sb } from "../lib/api.ts";
import { loadMyProgress, type MyProgress } from "../lib/looks.ts";
import type { Locale } from "../i18n/index.ts";
import { Look } from "./looks/Look.tsx";
import { fmtInt } from "../lib/num.ts";

interface Gifts { credits?: number; boosts?: number; decoration?: string }
interface Msg { id: string; heading: string; body: string; gifts?: Gifts | null }

const T: Record<string, { go: string; credits: (n: number) => string; boosts: (n: number) => string; deco: string; jokes: string[] }> = {
  it: { go: "Ritira il bottino", credits: (n) => `+${fmtInt(n)} crediti finti`, boosts: (n) => `+${n} boost`, deco: "Decorazione per l'avatar", jokes: ["Valore reale: zero. Valore morale: incalcolabile.", "Niente tasse sul bottino: lo stato non ci arriva.", "Spenderli tutti subito è il modo più sicuro per non perderli.", "Il treno sarà in ritardo lo stesso, ma almeno ora hai un cerchio dorato."] },
  "en-US": { go: "Collect the loot", credits: (n) => `+${fmtInt(n)} pretend credits`, boosts: (n) => `+${n} boosts`, deco: "Avatar decoration", jokes: ["Real value: zero. Moral value: priceless.", "No tax on this loot: the government can't reach it.", "Spend it all right away. It's the only safe way to keep it.", "The train will still be late, but now you have a shiny ring."] },
  "en-GB": { go: "Collect the loot", credits: (n) => `+${fmtInt(n)} pretend credits`, boosts: (n) => `+${n} boosts`, deco: "Avatar decoration", jokes: ["Real value: nil. Moral value: priceless.", "No tax on this loot: the taxman can't reach it.", "Spend it all at once. It's the only safe way to keep it.", "The train will still be late, but now you have a shiny ring."] },
  ja: { go: "戦利品を受け取る", credits: (n) => `+${fmtInt(n)} ニセクレジット`, boosts: (n) => `+${n} ブースト`, deco: "アバターのかざり", jokes: ["現実の価値はゼロ。精神的価値は計り知れません。", "このお宝に税金はかかりません。税務署も届きません。", "全部すぐ使うのが、一番安全に持っておく方法です。", "電車はやっぱり遅れますが、キラキラのリングが手に入りました。"] },
};

/** A message from the team (also sent as a push). With gifts it opens as a reward screen at start; without, a card on top of Home. */
export function Inbox({ registered, ok, locale }: { registered: boolean; ok: string; locale: Locale }) {
  const [list, setList] = useState<Msg[]>([]);
  const [me, setMe] = useState<MyProgress | null>(null);
  useEffect(() => { if (!registered) return; let live = true; sb.rpc("my_messages").then(({ data }) => { if (live) setList((data ?? []) as Msg[]); }); return () => { live = false; }; }, [registered]);
  const m = list[0];
  const gifted = !!m?.gifts && (m.gifts.credits || m.gifts.boosts || m.gifts.decoration);
  useEffect(() => { if (!gifted) return; let live = true; void loadMyProgress().then((x) => { if (live) setMe(x); }); return () => { live = false; }; }, [gifted]);
  if (!m) return null;
  const done = () => { void sb.rpc("read_message", { p_id: m.id }); setList((l) => l.filter((x) => x.id !== m.id)); };
  if (!gifted) {
    return (
      <section class="card stack inbox" role="status">
        <div class="fyhead"><Mail size={20} /><b>{m.heading}</b><span class="grow" /><button class="iconbtn" onClick={done} aria-label={ok}><X size={18} /></button></div>
        <p>{m.body}</p>
        <button class="btn primary" onClick={done}>{ok}</button>
      </section>
    );
  }
  const t = T[locale] ?? T["en-US"]!, g = m.gifts!;
  const joke = t.jokes[[...m.id].reduce((a, c) => a + c.charCodeAt(0), 0) % t.jokes.length]!;
  // in the document body: inside the page the "screen" animation makes it the containing block of fixed children, so the card ended up far down the long page
  return createPortal(
    <div class="rwscrim" role="dialog" aria-modal="true" aria-label={m.heading}>
      <div class="rwcard">
        <i class="rwsp s1" /><i class="rwsp s2" /><i class="rwsp s3" /><i class="rwsp s4" />
        <h2>{m.heading}</h2>
        <p class="rwbody">{m.body}</p>
        <div class="rwgifts">
          {!!g.credits && <div class="rwgift"><span class="rwico coin"><Coins size={34} /></span><b>{t.credits(g.credits)}</b></div>}
          {!!g.boosts && <div class="rwgift"><span class="rwico bolt"><Zap size={34} /></span><b>{t.boosts(g.boosts)}</b></div>}
          {!!g.decoration && <div class="rwgift"><span class="rwlook"><Look avatar={me?.avatar ?? "fox"} decoration={g.decoration} size={84} /></span><b>{t.deco}</b></div>}
        </div>
        <p class="rwjoke">{joke}</p>
        <button class="btn primary wide" onClick={done}>{t.go}</button>
      </div>
    </div>,
    document.body,
  );
}
