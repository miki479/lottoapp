import { SHINES } from "../../../../shared/looks";
import { avatarSvg, decorationSvg } from "./art";
import { AURA_COLOR } from "../../../../shared/looks";

/** An avatar inside its decoration ring. Everything is drawn as SVG, so it stays sharp at any size. */
export function Look({ avatar, decoration, size = 48, label, aura }: { avatar: string; decoration?: string | null; size?: number; label?: string; aura?: boolean }) {
  const glow = aura && decoration ? (AURA_COLOR[decoration] ?? "#8b7bff") : null;
  const inner = (decoration ? decorationSvg(decoration, SHINES.has(decoration), size >= 56) : "") + avatarSvg(avatar);
  const svg = `<defs><clipPath id="lk-clip"><circle cx="60" cy="60" r="43"/></clipPath></defs>${inner}`;
  return <svg class={`look${glow ? " aura" : ""}`} style={glow ? `--aura:${glow};--ab:${Math.max(3, Math.round(size / 12))}px` : undefined} width={size} height={size} viewBox="-12 -12 144 144" role="img" aria-label={label ?? avatar} dangerouslySetInnerHTML={{ __html: svg }} />;
}
