import { describe, expect, it } from 'vitest';
import { OBSTACLES } from '../../src/game/obstacles/obstacleField';
import { SPEED_UP, scrollSpeedOf, speedFactorOf, speedLevelOf } from '../../src/game/score/speedUp';

describe('speedLevelOf', () => {
  it('is 0 from 0 to 9, 1 from 10 to 19 and 2 at 20', () => {
    for (let s = 0; s < 10; s++) expect(speedLevelOf(s)).toBe(0);
    for (let s = 10; s < 20; s++) expect(speedLevelOf(s)).toBe(1);
    expect(speedLevelOf(20)).toBe(2);
  });

  it('a jump from 9 to 11 speeds up once', () => {
    expect(speedLevelOf(11) - speedLevelOf(9)).toBe(1);
  });

  it('stops at the maximum', () => {
    expect(speedLevelOf(SPEED_UP.every * SPEED_UP.maxLevel)).toBe(SPEED_UP.maxLevel);
    expect(speedLevelOf(10_000)).toBe(SPEED_UP.maxLevel);
  });

  it('copes with odd scores', () => {
    expect(speedLevelOf(Number.NaN)).toBe(0);
    expect(speedLevelOf(-5)).toBe(0);
    expect(speedLevelOf(Infinity)).toBe(0);
    expect(speedLevelOf(10.5)).toBe(1);
  });
});

describe('scrollSpeedOf', () => {
  it('starts at the obstacle speed', () => {
    expect(scrollSpeedOf(0)).toBe(OBSTACLES.speed);
    expect(speedFactorOf(0)).toBe(1);
  });

  it('rises by a small step at each multiple of 10 and by nothing in between', () => {
    expect(scrollSpeedOf(9)).toBe(scrollSpeedOf(0));
    expect(scrollSpeedOf(10)).toBeCloseTo(OBSTACLES.speed * (1 + SPEED_UP.step));
    expect(scrollSpeedOf(19)).toBe(scrollSpeedOf(10));
    expect(scrollSpeedOf(20)).toBeGreaterThan(scrollSpeedOf(19));
  });

  it('every step is at most `step` of the starting speed', () => {
    for (let level = 1; level <= SPEED_UP.maxLevel + 2; level++) {
      const gain = scrollSpeedOf(level * SPEED_UP.every) - scrollSpeedOf((level - 1) * SPEED_UP.every);
      expect(gain).toBeLessThanOrEqual(OBSTACLES.speed * SPEED_UP.step + 1e-9);
      expect(gain).toBeGreaterThanOrEqual(0);
    }
  });
});
