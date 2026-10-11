import { reducedMotion } from "./anim.ts";

/** Light haptic feedback where the device supports it (Android browsers; ignored elsewhere). */
function buzz(pattern: number | number[]) {
  try { if (!reducedMotion() && "vibrate" in navigator) navigator.vibrate(pattern); } catch { /* not supported */ }
}
export const haptic = {
  tap: () => buzz(10),
  success: () => buzz([18, 40, 24]),
  error: () => buzz([40, 30, 40]),
};
