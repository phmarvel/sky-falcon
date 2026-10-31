import { describe, expect, it } from 'vitest';
import { createFalcon } from '../../src/game/falcon/falconPhysics';
import { createRun } from '../../src/game/run/runState';
import { scoreOf } from '../../src/game/score/runScore';

describe('scoreOf', () => {
  it('is one point for each obstacle passed', () => {
    expect(scoreOf({ passed: 0, dates: 0 })).toBe(0);
    expect(scoreOf({ passed: 6, dates: 0 })).toBe(6);
  });

  it('adds one point for each date caught', () => {
    expect(scoreOf({ passed: 3, dates: 2 })).toBe(5);
    expect(scoreOf({ passed: 0, dates: 1 })).toBe(1);
  });

  it('is 0 for a new run', () => {
    expect(scoreOf(createRun(createFalcon(), { top: 0, groundY: 749 }, 1))).toBe(0);
  });
});
