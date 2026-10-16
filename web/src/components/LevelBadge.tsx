import { Star } from "lucide-preact";
import type { Messages } from "../i18n/index.ts";

/** A player's level next to the nick: a small star and the number. */
export function LevelBadge({ level, msg }: { level: number | undefined; msg: Messages }) {
  if (!level || level < 1) return null;
  return <span class="lvlb num" role="img" title={msg.look.level(level)} aria-label={msg.look.level(level)}><Star size={11} fill="currentColor" aria-hidden="true" />{level}</span>;
}
