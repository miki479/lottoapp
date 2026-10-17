import type { TrophyId } from "../../i18n/index.ts";
import { TROPHY_RARITY } from "../../i18n/index.ts";
import { trophySvg } from "./trophyArt";

/** Trophies that have a rendered picture (web/public/trophies/<id>.webp); the others keep their drawn badge until theirs arrives. */
const PICTURED = new Set<string>(["limit_breaker", "first_win", "all_rings", "long_shot", "rain_man", "streak_7", "all_categories", "wins_500", "train_whisperer", "big_odds", "level_25", "streak_100", "level_50", "wins_100", "win_row_10", "collector", "bets_500", "streak_30", "chest_30", "friends_10", "high_roller", "ghost_feed"]);

/** A trophy as a 3D badge. The metal and shape are its own; the higher the rarity, the more it shines. */
export function Trophy3D({ id, have, size = 56 }: { id: TrophyId; have: boolean; size?: number }) {
  if (PICTURED.has(id)) {
    const src = `/trophies/${id}.webp`;
    // the sheen is a moving light clipped to the picture's own shape (its alpha) by a CSS mask
    return (
      <span class={`tr3dwrap ${have ? "lit" : ""}`} style={{ width: size, height: size, "--tm": `url(${src})` }}>
        <img class={`tr3d tr3dimg ${have ? "" : "lock"}`} src={src} width={size} height={size} alt="" loading="lazy" decoding="async" />
      </span>
    );
  }
  const shines = TROPHY_RARITY[id] !== "common" && TROPHY_RARITY[id] !== "rare";
  return <svg class={`tr3d ${have ? "" : "lock"}`} width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={id} dangerouslySetInnerHTML={{ __html: trophySvg(id, have, shines) }} />;
}
