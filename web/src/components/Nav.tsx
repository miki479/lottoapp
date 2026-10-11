import { Clock3, House, Ticket, Trophy, User } from "lucide-preact";
import type { Messages } from "../i18n/index.ts";

export type Screen = "home" | "bets" | "ranking" | "profile" | "admin";
const ITEMS = [["home", House], ["bets", Ticket], ["ranking", Trophy], ["profile", User]] as const;

/** Bottom tab bar on phones. */
export function TabBar({ value, onPick, msg, openBets, profileDot }: { value: Screen; onPick: (s: Screen) => void; msg: Messages; openBets: number; profileDot?: boolean }) {
  return (
    <nav class="tabbar" role="tablist" aria-label="Main">
      {ITEMS.map(([id, Icon]) => (
        <button key={id} role="tab" aria-selected={value === id} class={value === id ? "on" : ""} onClick={() => onPick(id)}>
          <Icon size={22} strokeWidth={value === id ? 2.4 : 2} /><span>{msg.nav[id]}</span>
          {id === "bets" && openBets > 0 && <i class="badge">{openBets}</i>}
          {id === "profile" && profileDot && <i class="badge dot" aria-label="new" />}
        </button>
      ))}
    </nav>
  );
}

/** Sidebar on desktop. */
export function Sidebar({ value, onPick, msg, openBets, profileDot }: { value: Screen; onPick: (s: Screen) => void; msg: Messages; openBets: number; profileDot?: boolean }) {
  return (
    <nav class="side" aria-label="Main">
      <div class="brand"><i><Clock3 size={20} strokeWidth={2.4} /></i><span>Late<b>Lotto</b></span></div>
      {ITEMS.map(([id, Icon]) => (
        <button key={id} class={value === id ? "on" : ""} onClick={() => onPick(id)} aria-current={value === id ? "page" : undefined}>
          <Icon size={20} strokeWidth={value === id ? 2.4 : 2} /><span>{msg.nav[id]}</span>
          {id === "bets" && openBets > 0 && <i class="badge">{openBets}</i>}
          {id === "profile" && profileDot && <i class="badge dot" aria-label="new" />}
        </button>
      ))}
    </nav>
  );
}
