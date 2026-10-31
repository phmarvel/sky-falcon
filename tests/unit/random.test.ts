import { describe, expect, it } from 'vitest';
import { createRandom, randomSeed, randomStep } from '../../src/game/obstacles/random';

describe('seeded random', () => {
  it('gives the same numbers for the same seed and other numbers for another seed', () => {
    const a = createRandom(7);
    const b = createRandom(7);
    const c = createRandom(8);
    const seqA = Array.from({ length: 20 }, a);
    expect(Array.from({ length: 20 }, b)).toEqual(seqA);
    expect(Array.from({ length: 20 }, c)).not.toEqual(seqA);
  });

  it('stays in [0, 1) and spreads over the range', () => {
    const rnd = createRandom(123);
    const values = Array.from({ length: 2000 }, rnd);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const low = values.filter((v) => v < 0.5).length;
    expect(low).toBeGreaterThan(850);
    expect(low).toBeLessThan(1150);
  });

  it('randomStep is pure: it returns the next state instead of changing anything', () => {
    expect(randomStep(5)).toEqual(randomStep(5));
    expect(randomStep(5).state).not.toBe(5);
  });

  it('makes whole, non-negative seeds', () => {
    const s = randomSeed();
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
  });
});
