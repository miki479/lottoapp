import { useState } from "preact/hooks";
import type { Messages } from "../i18n/index.ts";
import type { MarketRow } from "../lib/format.ts";

/** A club crest (from the data source), or the club's initials when the picture is missing or does not load. */
export function Crest({ src, name, size = 30 }: { src?: string; name: string; size?: number }) {
  const [bad, setBad] = useState(false);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  return src && !bad
    ? <img class="crest" src={src} alt="" width={size} height={size} loading="lazy" decoding="async" referrerpolicy="no-referrer" onError={() => setBad(true)} />
    : <span class="crest ph" style={`width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px`} aria-hidden="true">{initials}</span>;
}

/** The two sides of a match: crest and bold name on each side of a small "vs". */
export function MatchVs({ home, away, homeBadge, awayBadge, size = 30, stack }: { home: string; away: string; homeBadge?: string; awayBadge?: string; size?: number; stack?: boolean }) {
  return (
    <div class={`vs ${stack ? "stack-vs" : ""}`}>
      <span class="vsside"><Crest src={homeBadge} name={home} size={size} /><b>{home}</b></span>
      <i class="vsmark">vs</i>
      <span class="vsside away"><b>{away}</b><Crest src={awayBadge} name={away} size={size} /></span>
    </div>
  );
}

/** The match of a football market as a "vs" card header; null for any other market. */
export function MarketVs({ m, size }: { m: MarketRow; size?: number }) {
  if (m.kind !== "match_bet") return null;
  return <MatchVs home={String(m.params.home)} away={String(m.params.away)} homeBadge={m.params.homeBadge as string | undefined} awayBadge={m.params.awayBadge as string | undefined} size={size} />;
}

/** The reason of the bet in a few words (what the pick is about), for the highlighted pill. */
/** What "No" means on a football question: the other side of the bet, in words ("Udinese wins" for "Udinese does not lose"). */
export function noOf(m: MarketRow, msg: Messages): string | null {
  if (m.kind !== "match_bet") return null;
  const bet = String(m.params.bet), h = String(m.params.home), a = String(m.params.away), o = msg.sportui.opp;
  switch (bet) {
    case "home_win": return o.notWin(h);
    case "away_win": return o.notWin(a);
    case "draw": return o.noDraw;
    case "dc_1x": return msg.sportui.wins(a);
    case "dc_x2": return msg.sportui.wins(h);
    case "dc_12": return msg.matchmaker.bets.draw;
    case "over_1_5": return o.atMost(1);
    case "over_2_5": return o.atMost(2);
    case "over_3_5": return o.atMost(3);
    case "btts": return o.notBoth;
    case "home_clean": return o.concede(h);
    case "away_clean": return o.concede(a);
    default: return null;
  }
}

export function reasonOf(m: MarketRow, msg: Messages): string | null {
  if (m.kind !== "match_bet") return null;
  const bet = String(m.params.bet);
  if (/^(pg|pa|ps):/.test(bet)) { const n = String((m.params.player as { name?: string } | undefined)?.name ?? ""); return `${n} · ${bet.startsWith("pg") ? msg.sportui.pgL : bet.startsWith("pa") ? msg.sportui.paL : msg.sportui.psL}`; }
  if (bet === "home_win") return msg.sportui.wins(String(m.params.home));
  if (bet === "away_win") return msg.sportui.wins(String(m.params.away));
  return msg.matchmaker.bets[bet as keyof typeof msg.matchmaker.bets] ?? null;
}
