import { X } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { LEAGUES, LEAGUE_BONUS, PROMOTE_CREDITS, PROMOTE_TOP, promoteSlots, promotionGap, resetBalance } from "../../../shared/leagues.ts";
import { INTL_TAG, type Locale, type Messages } from "../i18n/index.ts";
import { sb } from "../lib/api.ts";
import { PlayerTitle } from "./PlayerTitle.tsx";
import { useLooks } from "../lib/looks.ts";
import { Collapse } from "./Collapse.tsx";
import { LevelBadge } from "./LevelBadge.tsx";
import { Meter } from "./Meter.tsx";
import { SeasonBanner } from "./Season.tsx";
import { LeagueEmblem } from "./LeagueEmblem.tsx";
import { Sheet } from "./Sheet.tsx";
import { Look } from "./looks/Look.tsx";
import { M } from "./looks/art.ts";
import "./league.css";
import { fmtInt } from "../lib/num.ts";

/** Monthly leagues: card on top of the Ranking view, the board of each league, and a small badge for the profile. Strings live here, per locale. */
const T = {
  it: {
    ord: (n: number) => `${n}º`, gapTo: (n: string, o: string) => `${n} crediti dal ${o}`, leadOver: (n: string, o: string) => `${n} crediti di vantaggio sul ${o}`, promo: "Promozione", rewardsTitle: "Premi di lega",
    rewardsBody: (step: string) => `Salire di lega sblocca l'anello del suo metallo per il tuo avatar e fa ripartire ogni mese da più crediti (${step} in più a ogni lega).`, restart: (n: string) => `ripartenza ${n}`, here: "Tu", next: "Prossima",
    names: ["Bronzo", "Argento", "Oro", "Platino", "Diamante"], league: (n: string) => `Lega ${n}`, none: "Gioca una giocata questo mese per entrare in classifica",
    zone: "Sei in zona promozione", gap: (n: string) => `Ti mancano ${n} crediti per salire`, top: "Sei nella lega più alta", board: "Classifica della lega", empty: "Nessun giocatore in questa lega, per ora.", you: "tu", how: "Come funzionano le leghe",
    rows: (base: string) => [`Ogni mese i crediti ripartono da ${base} (un po' di più nelle leghe alte), così si gioca alla pari.`, `A fine mese, tra chi ha giocato almeno una volta, il primo quarto di ogni lega (al massimo ${PROMOTE_TOP} persone, con un posto garantito anche nelle leghe piccole) sale alla lega successiva. Sale anche chi arriva a 1.000.000 di crediti.`, "Salendo si sblocca l'anello della lega sul tuo avatar, più un boost in regalo.", "Chi non fa nemmeno una puntata in un mese scende di una lega (il Bronzo resta Bronzo) e tiene i suoi crediti."],
    note: "Sono crediti di gioco, senza alcun valore reale.", close: "Chiudi",
  },
  "en-US": {
    ord: (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`, gapTo: (n: string, o: string) => `${n} credits behind ${o}`, leadOver: (n: string, o: string) => `${n} credits ahead of ${o}`, promo: "Promotion", rewardsTitle: "League rewards",
    rewardsBody: (step: string) => `Moving up a league unlocks the ring of its metal for your avatar and restarts every month from more credits (${step} more per league).`, restart: (n: string) => `restart ${n}`, here: "You", next: "Next",
    names: ["Bronze", "Silver", "Gold", "Platinum", "Diamond"], league: (n: string) => `${n} league`, none: "Make one pick this month to join the table",
    zone: "You are in the promotion zone", gap: (n: string) => `${n} credits to move up`, top: "You are in the top league", board: "League table", empty: "No players in this league yet.", you: "you", how: "How leagues work",
    rows: (base: string) => [`Every month credits restart from ${base} (a little more in the higher leagues), so everyone starts level.`, `At month end, among players who played at least once, the top quarter of each league (at most ${PROMOTE_TOP} people, and at least one place even in small leagues) moves up. Reaching 1,000,000 credits also moves you up.`, "Moving up unlocks the league ring for your avatar, plus a free boost.", "A month without a single bet moves you down one league (Bronze stays Bronze) and you keep your credits."],
    note: "Game credits only, with no real-world value.", close: "Close",
  },
  "en-GB": {
    ord: (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`, gapTo: (n: string, o: string) => `${n} credits behind ${o}`, leadOver: (n: string, o: string) => `${n} credits ahead of ${o}`, promo: "Promotion", rewardsTitle: "League rewards",
    rewardsBody: (step: string) => `Moving up a league unlocks the ring of its metal for your avatar and restarts every month from more credits (${step} more per league).`, restart: (n: string) => `restart ${n}`, here: "You", next: "Next",
    names: ["Bronze", "Silver", "Gold", "Platinum", "Diamond"], league: (n: string) => `${n} league`, none: "Make one pick this month to join the table",
    zone: "You are in the promotion zone", gap: (n: string) => `${n} credits to move up`, top: "You are in the top league", board: "League table", empty: "No players in this league yet.", you: "you", how: "How leagues work",
    rows: (base: string) => [`Every month credits restart from ${base} (a little more in the higher leagues), so everyone starts level.`, `At month end, among players who played at least once, the top quarter of each league (at most ${PROMOTE_TOP} people, and at least one place even in small leagues) moves up. Reaching 1,000,000 credits also moves you up.`, "Moving up unlocks the league ring for your avatar, plus a free boost.", "A month without a single bet moves you down one league (Bronze stays Bronze) and you keep your credits."],
    note: "Game credits only, with no real-world value.", close: "Close",
  },
  ja: {
    ord: (n: number) => `${n}位`, gapTo: (n: string, o: string) => `${o}まであと${n}クレジット`, leadOver: (n: string, o: string) => `${o}に${n}クレジット差で首位`, promo: "昇格", rewardsTitle: "リーグの報酬",
    rewardsBody: (step: string) => `昇格すると、そのリーグの金属のリングがアバターに解放され、毎月の再スタート額が増えます（リーグごとに${step}増）。`, restart: (n: string) => `再スタート ${n}`, here: "あなた", next: "次",
    names: ["ブロンズ", "シルバー", "ゴールド", "プラチナ", "ダイヤモンド"], league: (n: string) => `${n}リーグ`, none: "今月1回予想すると順位表に載ります",
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

function Board({ league, locale, msg, onProfile }: { league: number; locale: Locale; msg: Messages; onProfile: (id: string) => void }) {
  const t = tx(locale), nf = { format: (n: number) => fmtInt(n, locale) };
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
    <><p class="detail scorelegend">{msg.ranking.leagueLegend}</p><div class="list">{rows.map((r) => {
      const l = looks[r.user_id];
      return (
        <div class={`row ${r.is_me ? "me" : ""}`} key={r.user_id}>
          <span class={`rank ${r.rank <= 3 ? "top" : ""}`}>{r.rank}</span>
          {l ? <Look avatar={l.avatar} decoration={l.decoration} size={36} /> : <span class="lkph" />}
          <button class="grow rowlink" onClick={() => onProfile(r.user_id)}><span class="nick"><b>{r.display_name}</b><LevelBadge level={l?.level} msg={msg} /></span><span class="subline">{r.is_me && <em class="youtag">{t.you}</em>}<PlayerTitle id={l?.title} locale={locale} /></span></button>
          <span class="scorebox"><span class="score num zero">{nf.format(r.credits)}</span><small class="scorelbl">{msg.ranking.monthLbl}</small></span>
        </div>
      );
    })}</div></>
  );
}

interface Rival { rank: number; credits: number; nextRank: number | null; nextCredits: number | null; belowRank: number | null; belowCredits: number | null }
/** Where the player stands among the others of the league: the next one up (or, in front, the one right behind), read from the league table. */
function useRival(d: My | null): Rival | null {
  const [r, setR] = useState<Rival | null>(null);
  useEffect(() => {
    if (!d || d.rank == null || d.players < 2) { setR(null); return; }
    let live = true;
    sb.rpc("league_board", { p_league: d.league, p_limit: Math.min(100, Math.max(2, d.rank + 1)) }).then(({ data }) => {
      if (!live) return;
      const rows = ((data ?? []) as { rank: number | string; credits: number | string; is_me: boolean }[]).map((x) => ({ rank: Number(x.rank), credits: Number(x.credits), me: x.is_me }));
      const me = rows.find((x) => x.me);
      if (!me) { setR(null); return; }
      const above = rows.filter((x) => x.rank < me.rank).sort((a, b) => b.rank - a.rank)[0], below = rows.filter((x) => x.rank > me.rank).sort((a, b) => a.rank - b.rank)[0];
      setR({ rank: me.rank, credits: me.credits, nextRank: above?.rank ?? null, nextCredits: above?.credits ?? null, belowRank: below?.rank ?? null, belowCredits: below?.credits ?? null });
    }, () => { if (live) setR(null); });
    return () => { live = false; };
  }, [d?.league, d?.rank, d?.credits, d?.players]);
  return r;
}

/** The five leagues in a row: what each restarts from every month, where the player is and which one is next; what moving up gives. */
function Rewards({ league, locale }: { league: number; locale: Locale }) {
  const t = tx(locale), nf = (n: number) => fmtInt(n, locale);
  return (
    <div class="lgrewards">
      <b>{t.rewardsTitle}</b>
      <ol class="lgsteps">
        {LEAGUES.map((_, i) => (
          <li key={i} class={`${i === league ? "here" : ""} ${i === league + 1 ? "next" : ""} ${i < league ? "done" : ""}`} aria-current={i === league ? "step" : undefined}>
            <Badge league={i} size={32} /><span class="lgn">{t.names[i]}</span><span class="lgr num">{nf(resetBalance(i))}</span>
            {(i === league || i === league + 1) && <em>{i === league ? t.here : t.next}</em>}
          </li>
        ))}
      </ol>
      <p class="hint">{t.rewardsBody(nf(LEAGUE_BONUS))}</p>
    </div>
  );
}

/** Card for the Friends view: own league, the position as a bar with the gap to the next one up, the way to promotion, the season, the tables and what each league gives. Nothing shows until leagues are on. */
export function LeaguePanel(p: { locale: Locale; msg: Messages; registered: boolean; onProfile: (id: string) => void }) {
  const d = useMyLeague(p.registered), t = tx(p.locale), rival = useRival(d);
  const [view, setView] = useState<number | null>(null);
  const [how, setHow] = useState(false);
  if (!d) return null;
  const nf = { format: (n: number) => fmtInt(n, p.locale) };
  const gap = promotionGap(d.league, d.credits, d.threshold);
  const line = Math.min(d.threshold ?? PROMOTE_CREDITS, PROMOTE_CREDITS), inZone = d.rank != null && (gap === 0 || d.rank <= promoteSlots(d.players));
  const sel = view ?? d.league;
  return (
    <>
      <section class="card lgcard">
        <div class="lgtop">
          <Badge league={d.league} />
          <div class="lgtxt"><b>{t.league(t.names[d.league]!)}</b>{d.rank == null && <span class="hint">{t.none}</span>}</div>
          <button class="infodot" onClick={() => setHow(true)} aria-label={t.how}>i</button>
        </div>
        <SeasonBanner msg={p.msg} flat />
        {d.rank != null && rival && (rival.nextRank !== null
          ? <Meter tone="brand" name={t.gapTo(nf.format(Math.max(0, (rival.nextCredits ?? 0) - rival.credits)), t.ord(rival.nextRank))} value={rival.credits} max={Math.max(1, rival.nextCredits ?? 1)} label={<b class="num">{t.ord(rival.rank)}</b>} end={t.ord(rival.nextRank)} foot={t.gapTo(nf.format(Math.max(0, (rival.nextCredits ?? 0) - rival.credits)), t.ord(rival.nextRank))} />
          : rival.belowRank !== null && <Meter tone="brand" name={t.leadOver(nf.format(Math.max(0, rival.credits - (rival.belowCredits ?? 0))), t.ord(rival.belowRank))} value={Math.max(0, rival.credits - (rival.belowCredits ?? 0))} max={Math.max(1, rival.credits)} label={<b class="num">{t.ord(rival.rank)}</b>} end={t.ord(rival.belowRank)} foot={t.leadOver(nf.format(Math.max(0, rival.credits - (rival.belowCredits ?? 0))), t.ord(rival.belowRank))} />)}
        {d.league >= 4
          ? <p class="hint">{t.top}</p>
          : d.rank != null && <Meter tone="streak" name={t.promo} value={inZone ? 1 : d.credits} max={inZone ? 1 : Math.max(1, line)} label={t.promo} end={inZone ? undefined : nf.format(line)} foot={inZone ? t.zone : t.gap(nf.format(gap ?? 0))} />}
        <Collapse id="league-board" title={t.board} open={false}>
          <div class="mkchips">{LEAGUES.map((_, i) => <button key={i} class={`mkchip ${sel === i ? "on" : ""}`} aria-pressed={sel === i} onClick={() => setView(i)}>{t.names[i]}</button>)}</div>
          <Board league={sel} locale={p.locale} msg={p.msg} onProfile={p.onProfile} />
        </Collapse>
        <Rewards league={d.league} locale={p.locale} />
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
