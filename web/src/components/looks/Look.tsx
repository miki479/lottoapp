import { SHINES } from "../../../../shared/looks";
import { avatarSvg, decorationSvg } from "./art";

/** An avatar inside its decoration ring. Everything is drawn as SVG, so it stays sharp at any size. */
export function Look({ avatar, decoration, size = 48, label }: { avatar: string; decoration?: string | null; size?: number; label?: string }) {
  const inner = (decoration ? decorationSvg(decoration, SHINES.has(decoration), size >= 56) : "") + avatarSvg(avatar);
  const svg = `<defs><clipPath id="lk-clip"><circle cx="60" cy="60" r="43"/></clipPath></defs>${inner}`;
  return <svg class="look" width={size} height={size} viewBox="-12 -12 144 144" role="img" aria-label={label ?? avatar} dangerouslySetInnerHTML={{ __html: svg }} />;
}
