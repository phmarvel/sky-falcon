import { OBSTACLES } from '../obstacles/obstacleField';

/**
 * The game gets a little faster each time the score reaches a new multiple of `every`.
 * Pure: the speed is worked out from the score, never stored, so a new run (score 0) is back at the starting speed,
 * a jump over a multiple (9 to 11) counts once, and the speed doesn't change between two multiples.
 */
export const SPEED_UP = {
  /** Points between two steps. */
  every: 10,
  /** Each step adds this share of the starting speed. */
  step: 0.04,
  /** No more steps after this many, so the game stays playable. */
  maxLevel: 6,
} as const;

/** How many times the game has sped up at this score. */
export function speedLevelOf(score: number): number {
  if (!Number.isFinite(score) || score < 0) return 0;
  return Math.min(SPEED_UP.maxLevel, Math.floor(score / SPEED_UP.every));
}

/** 1 at the start, 1.06 at 10 points, and so on. */
export function speedFactorOf(score: number): number {
  return 1 + SPEED_UP.step * speedLevelOf(score);
}

/**
 * How fast the world scrolls left, in pixels per second, at this score. Everything that moves with the world
 * (obstacles, and the dates once they exist) must take its speed from here.
 */
export function scrollSpeedOf(score: number): number {
  return OBSTACLES.speed * speedFactorOf(score);
}
