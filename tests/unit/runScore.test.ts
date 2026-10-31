import { describe, expect, it } from 'vitest';
import { createFalcon } from '../../src/game/falcon/falconPhysics';
import { createRun } from '../../src/game/run/runState';
import { scoreOf } from '../../src/game/score/runScore';

describe('scoreOf', () => {
  it('is one point for each obstacle passed', () => {
    expect(scoreOf({ passed: 0 })).toBe(0);
    expect(scoreOf({ passed: 6 })).toBe(6);
  });

  it('is 0 for a new run', () => {
    expect(scoreOf(createRun(createFalcon(), { top: 0, groundY: 749 }, 1))).toBe(0);
  });
});
