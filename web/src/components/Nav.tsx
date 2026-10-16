import { House, Ticket, Trophy, User, Users } from "lucide-preact";
import { BrandMark } from "./Header.tsx";
import type { Messages } from "../i18n/index.ts";

export type Screen = "home" | "bets" | "friends" | "ranking" | "profile" | "admin";
const ITEMS = [["home", House], ["bets", Ticket], ["friends", Users], ["ranking", Trophy], ["profile", User]] as const;

/** Bottom tab bar on phones. */
export function TabBar({ value, onPick, msg, openBets, profileDot, rankBadge, social = true }: { value: Screen; onPick: (s: Screen) => void; msg: Messages; openBets: number; profileDot?: boolean; rankBadge?: number; social?: boolean }) {
  return (
    <nav class="tabbar" role="tablist" aria-label={msg.nav.label}>
      {ITEMS.filter(([id]) => id !== "friends" || social).map(([id, Icon]) => (
        <button key={id} role="tab" aria-selected={value === id} class={value === id ? "on" : ""} onClick={() => onPick(id)}>
          <Icon size={22} strokeWidth={value === id ? 2.4 : 2} /><span>{msg.nav[id]}</span>
          {id === "bets" && openBets > 0 && <i class="badge">{openBets}</i>}
          {id === "friends" && (rankBadge ?? 0) > 0 && <i class="badge">{rankBadge}</i>}
          {id === "profile" && profileDot && <i class="badge dot" role="img" aria-label={msg.nav.fresh} />}
        </button>
      ))}
    </nav>
  );
}

/** Sidebar on desktop. */
export function Sidebar({ value, onPick, msg, openBets, profileDot, rankBadge, social = true }: { value: Screen; onPick: (s: Screen) => void; msg: Messages; openBets: number; profileDot?: boolean; rankBadge?: number; social?: boolean }) {
  return (
    <nav class="side" aria-label={msg.nav.label}>
      <div class="brand"><i><BrandMark /></i><span class="tx"><span class="wm">Late<b>BET</b></span><em class="stag">{msg.home.satire}</em></span></div>
      {ITEMS.filter(([id]) => id !== "friends" || social).map(([id, Icon]) => (
        <button key={id} class={value === id ? "on" : ""} onClick={() => onPick(id)} aria-current={value === id ? "page" : undefined}>
          <Icon size={20} strokeWidth={value === id ? 2.4 : 2} /><span>{msg.nav[id]}</span>
          {id === "bets" && openBets > 0 && <i class="badge">{openBets}</i>}
          {id === "friends" && (rankBadge ?? 0) > 0 && <i class="badge">{rankBadge}</i>}
          {id === "profile" && profileDot && <i class="badge dot" role="img" aria-label={msg.nav.fresh} />}
        </button>
      ))}
    </nav>
  );
}
