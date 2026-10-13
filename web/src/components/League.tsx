import { X } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { LEAGUES, PROMOTE_CREDITS, PROMOTE_TOP, promoteSlots, promotionGap, resetBalance } from "../../../shared/leagues.ts";
import { INTL_TAG, type Locale, type Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { PlayerTitle } from "./PlayerTitle.tsx";
import { useLooks } from "../lib/looks.ts";
import { Collapse } from "./Collapse.tsx";
import { LeagueEmblem } from "./LeagueEmblem.tsx";
import { Sheet } from "./Sheet.tsx";
import { Look } from "./looks/Look.tsx";
import { M } from "./looks/art.ts";
import "./league.css";

/** Monthly leagues: card on top of the Ranking view, the board of each league, and a small badge for the profile. Strings live here, per locale. */
const T = {
  it: {
    names: ["Bronzo", "Argento", "Oro", "Platino", "Diamante"], league: (n: string) => `Lega ${n}`, rank: (r: number, n: number) => `${r}º su ${n} giocatori`, none: "Gioca una giocata questo mese per entrare in classifica", days: (d: number) => (d === 1 ? "Ultimo giorno del mese" : `${d} giorni al nuovo mese`),
    zone: "Sei in zona promozione", gap: (n: string) => `Ti mancano ${n} crediti per salire`, top: "Sei nella lega più alta", board: "Classifica della lega", empty: "Nessun giocatore in questa lega, per ora.", you: "tu", how: "Come funzionano le leghe",
    rows: (base: string) => [`Ogni mese i crediti ripartono da ${base} (un po' di più nelle leghe alte), così si gioca alla pari.`, `A fine mese, tra chi ha giocato almeno una volta, il primo quarto di ogni lega (al massimo ${PROMOTE_TOP} persone, con un posto garantito anche nelle leghe piccole) sale alla lega successiva. Sale anche chi arriva a 1.000.000 di crediti.`, "Salendo si sblocca l'anello della lega sul tuo avatar, più un boost in regalo.", "Chi non fa nemmeno una puntata in un mese scende di una lega (il Bronzo resta Bronzo) e tiene i suoi crediti."],
    note: "Sono crediti di gioco, senza alcun valore reale.", close: "Chiudi",
  },
  "en-US": {
    names: ["Bronze", "Silver", "Gold", "Platinum", "Diamond"], league: (n: string) => `${n} league`, rank: (r: number, n: number) => `${r}${r % 10 === 1 && r !== 11 ? "st" : r % 10 === 2 && r !== 12 ? "nd" : r % 10 === 3 && r !== 13 ? "rd" : "th"} of ${n} players`, none: "Make one pick this month to join the table", days: (d: number) => (d === 1 ? "Last day of the month" : `${d} days to the new month`),
    zone: "You are in the promotion zone", gap: (n: string) => `${n} credits to move up`, top: "You are in the top league", board: "League table", empty: "No players in this league yet.", you: "you", how: "How leagues work",
    rows: (base: string) => [`Every month credits restart from ${base} (a little more in the higher leagues), so everyone starts level.`, `At month end, among players who played at least once, the top quarter of each league (at most ${PROMOTE_TOP} people, and at least one place even in small leagues) moves up. Reaching 1,000,000 credits also moves you up.`, "Moving up unlocks the league ring for your avatar, plus a free boost.", "A month without a single bet moves you down one league (Bronze stays Bronze) and you keep your credits."],
    note: "Game credits only, with no real-world value.", close: "Close",
  },
  "en-GB": {
    names: ["Bronze", "Silver", "Gold", "Platinum", "Diamond"], league: (n: string) => `${n} league`, rank: (r: number, n: number) => `${r}${r % 10 === 1 && r !== 11 ? "st" : r % 10 === 2 && r !== 12 ? "nd" : r % 10 === 3 && r !== 13 ? "rd" : "th"} of ${n} players`, none: "Make one pick this month to join the table", days: (d: number) => (d === 1 ? "Last day of the month" : `${d} days to the new month`),
    zone: "You are in the promotion zone", gap: (n: string) => `${n} credits to move up`, top: "You are in the top league", board: "League table", empty: "No players in this league yet.", you: "you", how: "How leagues work",
    rows: (base: string) => [`Every month credits restart from ${base} (a little more in the higher leagues), so everyone starts level.`, `At month end, among players who played at least once, the top quarter of each league (at most ${PROMOTE_TOP} people, and at least one place even in small leagues) moves up. Reaching 1,000,000 credits also moves you up.`, "Moving up unlocks the league ring for your avatar, plus a free boost.", "A month without a single bet moves you down one league (Bronze stays Bronze) and you keep your credits."],
    note: "Game credits only, with no real-world value.", close: "Close",
  },
  ja: {
    names: ["ブロンズ", "シルバー", "ゴールド", "プラチナ", "ダイヤモンド"], league: (n: string) => `${n}リーグ`, rank: (r: number, n: number) => `${n}人中${r}位`, none: "今月1回予想すると順位表に載ります", days: (d: number) => (d === 1 ? "今月の最終日" : `新しい月まであと${d}日`),
    zone: "昇格圏内です", gap: (n: string) => `昇格まであと${n}クレジット`, top: "最上位リーグです", board: "リーグ順位表", empty: "このリーグにはまだ誰もいません。", you: "あなた", how: "リーグのしくみ",
    rows: (base: string) => [`毎月クレジットは${base}から再スタート（上位リーグは少し多め）。みんな同じ条件で始まります。`, `月末に、1回以上遊んだ人のうち各リーグの上位4分の1（最大${PROMOTE_TOP}人、小さなリーグでも最低1枠）が昇格します。1,000,000クレジットに届いた人も昇格します。`, "昇格するとリーグのリングがアバターに解放され、ブーストももらえます。", "1か月まったく賭けないと1つ下のリーグに下がります（ブロンズはそのまま）。クレジットは保持されます。"],
    note: "ゲーム内クレジットで、現実の価値はありません。", close: "閉じる",
  },
} as const;

interface My { league: number; credits: number; rank: number | null; players: number; threshold: number | null; days_left: number; on: boolean }
let mine: { at: number; p: Promise<My | null> } | null = null;
/** The player's league, asked once a minute at most. Null while loading, signed out, or when leagues are not switched on. */
function useMyLeague(registered: boolean): My | null {
  const [d, setD] = useState<My | null>(null);
  useEffect(() => {
    if (!registered) { setD(null); return; }
    if (!mine || Date.now() - mine.at > 60_000) mine = { at: Date.now(), p: Promise.resolve(sb.rpc("my_league")).then(({ data, error }) => (error || !data ? null : (data as My))).catch(() => null) };
    let live = true; mine.p.then((x) => { if (live) setD(x && x.on ? x : null); });
    return () => { live = false; };
  }, [registered]);
  return d;
}

const DEMOTE: Record<string, string> = {
  it: "Un mese intero senza puntare ti fa scendere di una lega (il Bronzo non scende): i crediti restano tuoi. Basta giocare per tenere il posto.",
  "en-US": "A whole month without a bet drops you one league (Bronze stays Bronze): your credits stay yours. Just keep playing to hold your place.",
  "en-GB": "A whole month without a bet drops you one league (Bronze stays Bronze): your credits stay yours. Just keep playing to hold your place.",
  ja: "1か月まったく予想しないと1つ下のリーグに下がります（ブロンズは下がりません）。クレジットはそのままです。遊び続ければ順位を保てます。",
};
const tx = (l: Locale) => T[l] ?? T["en-US"];
const metal = (i: number) => M[LEAGUES[Math.min(4, Math.max(0, i))]!]!;
export function Badge({ league, size = 44 }: { league: number; size?: number }) {
  return <LeagueEmblem league={league} size={size} />;
}

function Board({ league, locale, onProfile }: { league: number; locale: Locale; onProfile: (id: string) => void }) {
  const t = tx(locale), nf = new Intl.NumberFormat(INTL_TAG[locale]);
  const [rows, setRows] = useState<{ rank: number; user_id: string; display_name: string; credits: number; is_me: boolean }[] | null>(null);
  useEffect(() => {
    setRows(null); let live = true;
    sb.rpc("league_board", { p_league: league, p_limit: 20 }).then(({ data }) => { if (live) setRows(((data ?? []) as typeof rows & object[]).map((r) => ({ ...r, rank: Number(r.rank), credits: Number(r.credits) }))); });
    return () => { live = false; };
  }, [league]);
  const looks = useLooks((rows ?? []).map((r) => r.user_id));
  if (rows === null) return <>{[0, 1, 2].map((i) => <div class="sk s" key={i} />)}</>;
  if (rows.length === 0) return <p class="hint">{t.empty}</p>;
  return (
    <div class="list">{rows.map((r) => {
      const l = looks[r.user_id];
      return (
        <div class={`row ${r.is_me ? "me" : ""}`} key={r.user_id}>
          <span class={`rank ${r.rank <= 3 ? "top" : ""}`}>{r.rank}</span>
          {l ? <Look avatar={l.avatar} decoration={l.decoration} size={36} /> : <span class="lkph" />}
          <button class="grow rowlink" onClick={() => onProfile(r.user_id)}><b>{r.display_name}</b>{r.is_me && <span class="detail"> · {t.you}</span>}<PlayerTitle id={l?.title} locale={locale} /></button>
          <span class="score num zero">{nf.format(r.credits)}</span>
        </div>
      );
    })}</div>
  );
}

/** Card for the top of Ranking: own league, place, days left, distance from promotion, the tables and the explainer. Nothing shows until leagues are on. */
export function LeaguePanel(p: { locale: Locale; registered: boolean; onProfile: (id: string) => void }) {
  const d = useMyLeague(p.registered), t = tx(p.locale);
  const [view, setView] = useState<number | null>(null);
  const [how, setHow] = useState(false);
  if (!d) return null;
  const nf = new Intl.NumberFormat(INTL_TAG[p.locale]);
  const gap = promotionGap(d.league, d.credits, d.threshold);
  const progress = d.league >= 4 ? 1 : Math.min(1, d.credits / Math.max(1, d.threshold != null ? Math.min(d.threshold, PROMOTE_CREDITS) : PROMOTE_CREDITS));
  const line = d.league >= 4 ? t.top : d.rank == null ? t.none : gap === 0 || (d.rank <= promoteSlots(d.players)) ? t.zone : t.gap(nf.format(gap ?? 0));
  const sel = view ?? d.league;
  return (
    <>
      <section class="card lgcard">
        <div class="lgtop">
          <Badge league={d.league} />
          <div class="lgtxt"><b>{t.league(t.names[d.league]!)}</b><span class="hint">{d.rank != null ? t.rank(d.rank, d.players) : t.none}</span></div>
          <button class="infodot" onClick={() => setHow(true)} aria-label={t.how}>i</button>
        </div>
        {d.rank != null && <><div class="lgbar" role="presentation"><i style={`width:${Math.round(progress * 100)}%`} /></div><span class="hint">{line}</span></>}
        <span class="detail">{t.days(d.days_left)}</span>
        <Collapse id="league-board" title={t.board} open={false}>
          <div class="mkchips">{LEAGUES.map((_, i) => <button key={i} class={`mkchip ${sel === i ? "on" : ""}`} aria-pressed={sel === i} onClick={() => setView(i)}>{t.names[i]}</button>)}</div>
          <Board league={sel} locale={p.locale} onProfile={p.onProfile} />
        </Collapse>
      </section>
      {how && (
        <Sheet onClose={() => setHow(false)} label={t.how}>
          <div class="shead"><h2>{t.how}</h2><button class="iconbtn" onClick={() => setHow(false)} aria-label={t.close}><X size={22} /></button></div>
          <ul class="xplist">{[...t.rows(nf.format(resetBalance(0))), DEMOTE[p.locale] ?? DEMOTE["en-US"]!].map((r) => <li key={r}>{r}</li>)}</ul>
          <div class="mkchips">{LEAGUES.map((_, i) => <span class="lgchip" key={i}><Badge league={i} size={22} />{t.names[i]} · {nf.format(resetBalance(i))}</span>)}</div>
          <p class="hint">{t.note}</p>
        </Sheet>
      )}
    </>
  );
}

/** Small pill for the own profile. */
export function LeagueBadge({ locale, registered }: { locale: Locale; registered: boolean; msg?: Messages }) {
  const d = useMyLeague(registered), t = tx(locale);
  if (!d) return null;
  return <span class="lgchip" title={t.league(t.names[d.league]!)}><Badge league={d.league} size={22} />{t.league(t.names[d.league]!)}</span>;
}
