import { describe, expect, it } from 'vitest';
import { scoreOf } from '../../src/game/score/runScore';

describe('scoreOf', () => {
  it('is one point for each obstacle passed', () => {
    expect(scoreOf({ passed: 0 })).toBe(0);
    expect(scoreOf({ passed: 6 })).toBe(6);
  });
});
