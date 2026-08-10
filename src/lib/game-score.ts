/**
 * Scoring for "Blazing the Trail to Coverage".
 *
 * Two layers, and they agree on one par model:
 *  - Per-zone pace bonuses paid during the run, against the eight zone pars.
 *  - One whole-run speed multiplier on a completed run, against the SUM of
 *    those same pars. A player who hits every advertised zone par therefore
 *    lands on a neutral x1.0 multiplier instead of being penalised.
 *
 * There is deliberately no separate finish-time bonus: finish speed is already
 * paid by the multiplier, and paying it twice made fast runs run away with the
 * board.
 */

/** Par (seconds) to clear each of the 8 zones. */
export const ZONE_PAR_S = [24, 28, 28, 34, 28, 40, 38, 24];

/** Whole-run par (ms) — the sum of the advertised zone pars. */
export const RUN_PAR_MS = ZONE_PAR_S.reduce((a, b) => a + b, 0) * 1000;

export const WIN_BONUS = 2000;
export const LIFE_BONUS = 500;

/** Speed bonus for clearing one zone in `splitS` seconds. */
export function zoneSpeedBonus(zoneIndex: number, splitS: number): number {
  const par = ZONE_PAR_S[zoneIndex] ?? 30;
  // 1 at instant, 0 at 2x par; squared so quick clears pay much more.
  const pace = Math.max(0, Math.min(1, (par * 2 - splitS) / (par * 2)));
  return Math.round(pace * pace * 2600 + pace * 400);
}

/**
 * Whole-run multiplier. Only completed runs get it, so dying quickly can never
 * out-score playing well and finishing.
 */
export function runSpeedMultiplier(won: boolean, durationMs: number): number {
  if (!won) return 1;
  const ratio = Math.max(0.35, durationMs / RUN_PAR_MS);
  return Math.max(0.5, Math.min(2.2, Math.pow(1 / ratio, 1.25)));
}

/**
 * Sub-point tiebreaker (0-99) derived from the exact finish time, so two runs
 * never share a leaderboard number by coincidence.
 */
export function tiebreaker(durationMs: number): number {
  return 99 - Math.floor((durationMs % 1000) / 10.11);
}

export function computeFinalScore(input: {
  won: boolean;
  /** Score accumulated during play, including banked zone speed bonuses. */
  playScore: number;
  durationMs: number;
  lives: number;
}): number {
  const { won, playScore, durationMs, lives } = input;
  let total = playScore * runSpeedMultiplier(won, durationMs);
  if (won) total += WIN_BONUS + Math.max(0, lives) * LIFE_BONUS;
  total += tiebreaker(durationMs);
  return Math.max(0, Math.round(total));
}
