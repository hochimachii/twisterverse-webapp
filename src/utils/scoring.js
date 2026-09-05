// src/utils/scoring.js
//
// Points awarded per completed level, based on how much of the 5-second
// window was left when the student finished and how many attempts that
// level took. Rewards speed and fluency (the actual skill a tongue
// twister trains) without punishing a student into a dead end.

export const BASE_POINTS = 100;
export const SPEED_BONUS_MAX = 50;   // full bonus for finishing instantly
export const ACCURACY_BONUS = 25;    // extra for a flawless recitation
export const ATTEMPT_PENALTY = 15;   // per retry after the first
export const MIN_POINTS = 20;        // a completed level always earns something

/**
 * @param {object} p
 * @param {number} p.secondsLeft   seconds remaining when they finished
 * @param {number} p.totalSeconds  the level's time limit
 * @param {number} p.attempts      attempts used, including the successful one
 * @param {string} p.tier          "perfect" | "pass"
 */
export function calculateScore({ secondsLeft, totalSeconds, attempts, tier }) {
  const safeTotal = totalSeconds || 1;
  const timeRatio = Math.max(0, Math.min(1, secondsLeft / safeTotal));

  const speedBonus = Math.round(SPEED_BONUS_MAX * timeRatio);
  const accuracyBonus = tier === "perfect" ? ACCURACY_BONUS : 0;
  const penalty = Math.max(0, attempts - 1) * ATTEMPT_PENALTY;

  const total = BASE_POINTS + speedBonus + accuracyBonus - penalty;
  return {
    total: Math.max(MIN_POINTS, total),
    base: BASE_POINTS,
    speedBonus,
    accuracyBonus,
    penalty,
    stars: starsFor(Math.max(MIN_POINTS, total))
  };
}

/** 1-3 stars, for a quick visual read of how well a level went. */
export function starsFor(points) {
  if (points >= 150) return 3;
  if (points >= 110) return 2;
  return 1;
}
