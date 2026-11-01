import { describe, expect, it } from 'vitest';
import { MEDAL_THRESHOLDS, betterMedal, medalOf, parseMedal, rankOf } from '../../src/game/score/medals';

describe('medalOf', () => {
  it('gives no medal below 10 points', () => {
    for (const s of [0, 1, 9]) expect(medalOf(s)).toBeNull();
  });
  it('gives bronze from 10, silver from 25 and gold from 50', () => {
    expect(medalOf(10)).toBe('bronze');
    expect(medalOf(24)).toBe('bronze');
    expect(medalOf(25)).toBe('silver');
    expect(medalOf(49)).toBe('silver');
    expect(medalOf(50)).toBe('gold');
    expect(medalOf(1000)).toBe('gold');
  });
  it('gives no medal for scores that are not usable numbers', () => {
    for (const s of [NaN, -5, -Infinity]) expect(medalOf(s)).toBeNull();
    expect(MEDAL_THRESHOLDS).toEqual({ bronze: 10, silver: 25, gold: 50 });
  });
});

describe('rankOf, betterMedal, parseMedal', () => {
  it('ranks null < bronze < silver < gold', () => {
    expect([null, 'bronze', 'silver', 'gold'].map((m) => rankOf(m as never))).toEqual([0, 1, 2, 3]);
    expect(betterMedal('silver', 'bronze')).toBe('silver');
    expect(betterMedal(null, 'bronze')).toBe('bronze');
    expect(betterMedal('gold', null)).toBe('gold');
    expect(betterMedal(null, null)).toBeNull();
  });
  it('parses only medal names', () => {
    expect(parseMedal('gold')).toBe('gold');
    expect(parseMedal(' silver ')).toBe('silver');
    for (const bad of [null, undefined, '', 'platinum', 'GOLD', '3']) expect(parseMedal(bad)).toBeNull();
  });
});
