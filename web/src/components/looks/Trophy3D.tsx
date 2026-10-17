import type { TrophyId } from "../../i18n/index.ts";
import { TROPHY_RARITY } from "../../i18n/index.ts";
import { trophySvg } from "./trophyArt";
import { useLayoutEffect, useRef } from "preact/hooks";

const CYCLE = 8;
/** One light crosses the whole shelf from the first trophy (top left) to the last (bottom right): each one gets the moment the light reaches it, on a clock shared by all of them. */
function useLight() {
  const ref = useRef<HTMLElement | SVGSVGElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current as HTMLElement | null;
    if (!el) return;
    const root = (el.closest(".stack") ?? document.body) as HTMLElement, a = el.getBoundingClientRect(), b = root.getBoundingClientRect();
    const offset = Math.max(0, (a.left - b.left) * 0.004 + (a.top - b.top) * 0.0048);
    const now = (performance.timeOrigin + performance.now()) / 1000;
    el.style.setProperty("--sd", `${-((((now - offset) % CYCLE) + CYCLE) % CYCLE)}s`);
  }, []);
  return ref;
}

/** Trophies that have a rendered picture (web/public/trophies/<id>.webp); the others keep their drawn badge until theirs arrives. */
const PICTURED = new Set<string>(["contrarian", "exact_minute", "double_sense", "local_explorer", "tide_turn", "friend_challenge", "limit_breaker", "first_win", "all_rings", "long_shot", "rain_man", "streak_7", "all_categories", "wins_500", "train_whisperer", "big_odds", "level_25", "streak_100", "level_50", "wins_100", "win_row_10", "collector", "bets_500", "streak_30", "chest_30", "friends_10", "high_roller", "ghost_feed", "alliance", "compass", "champion", "five_row", "cup", "pace", "diamond", "ghost_streak", "phoenix", "insight", "wave", "rocket", "veteran_365", "halloween_treni", "halloween_traffico", "halloween_meteo", "halloween_mercati", "halloween_sport", "avatars_30", "bets_2000", "big_odds_25", "category_100", "chal_joined_25", "comeback_10", "decos_15", "early_bird", "friends_25", "friends_50", "group_owner", "hall_25", "level_10", "level_100", "level_20", "level_30", "level_40", "level_60", "level_70", "level_80", "level_90", "night_owl", "organizer_10", "packs_100", "perfect_week", "recruiter_5", "regular_100", "rocket_x3", "single_win_25k", "win_row_20", "wins_1000", "wins_250"]);

/** A trophy as a 3D badge. The metal and shape are its own; the higher the rarity, the more it shines. */
export function Trophy3D({ id, have, size = 56 }: { id: TrophyId; have: boolean; size?: number }) {
  const light = useLight();
  if (PICTURED.has(id)) {
    const src = `/trophies/${id}.webp?v=8`;
    // the sheen is a moving light clipped to the picture's own shape (its alpha) by a CSS mask
    return (
      <span ref={light as never} class={`tr3dwrap ${have ? "lit" : ""}`} style={{ width: size, height: size, "--tm": `url(${src})` }}>
        <img class={`tr3d tr3dimg ${have ? "" : "lock"}`} src={src} width={size} height={size} alt="" loading="lazy" decoding="async" />
      </span>
    );
  }
  const shines = TROPHY_RARITY[id] !== "common" && TROPHY_RARITY[id] !== "rare";
  return <svg ref={light as never} class={`tr3d ${have ? "" : "lock"}`} width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={id} dangerouslySetInnerHTML={{ __html: trophySvg(id, have, shines) }} />;
}
