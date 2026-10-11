/** Reward constants. Mirrored by supabase/migrations/0010_flash_rewards.sql (checked by scripts/e2e-retention.mjs). */
export const RING_BONUS = 150;
/** Streak day -> credits paid the day that streak length is reached. */
export const STREAK_MILESTONES: Record<number, number> = { 3: 50, 7: 150, 14: 300, 30: 1000 };
export const FLASH_MULT_WEATHER = 3;
export const FLASH_MULT_RUSH = 2;

export function nextMilestone(streak: number): { day: number; bonus: number } | null {
  const days = Object.keys(STREAK_MILESTONES).map(Number).sort((a, b) => a - b);
  const day = days.find((d) => d > streak);
  return day === undefined ? null : { day, bonus: STREAK_MILESTONES[day]! };
}
