import type { TrophyId } from "../../i18n/index.ts";
import { TROPHY_RARITY } from "../../i18n/index.ts";
import { trophySvg } from "./trophyArt";

/** A trophy as a 3D badge. The metal and shape are its own; the higher the rarity, the more it shines. */
export function Trophy3D({ id, have, size = 56 }: { id: TrophyId; have: boolean; size?: number }) {
  const shines = TROPHY_RARITY[id] === "epic";
  return <svg class={`tr3d ${have ? "" : "lock"}`} width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={id} dangerouslySetInnerHTML={{ __html: trophySvg(id, have, shines) }} />;
}
