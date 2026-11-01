import { describe, expect, it } from 'vitest';
import { SOUNDS, SOUND_NAMES, isSoundName, recipeOf } from '../../src/game/audio/soundRecipes';

describe('sound recipes', () => {
  it('has flap, point, date and hit', () => {
    expect([...SOUND_NAMES].sort()).toEqual(['date', 'flap', 'hit', 'point']);
    for (const name of SOUND_NAMES) expect(recipeOf(name)).toBe(SOUNDS[name]);
  });

  it('has sensible numbers', () => {
    for (const name of SOUND_NAMES) {
      const r = SOUNDS[name];
      for (const n of [r.frequency, r.endFrequency, r.duration, r.volume]) {
        expect(Number.isFinite(n)).toBe(true);
        expect(n).toBeGreaterThan(0);
      }
      expect(r.volume).toBeLessThanOrEqual(1);
      expect(r.duration).toBeLessThan(1);
    }
  });

  it('makes every sound different from every other', () => {
    for (const a of SOUND_NAMES) {
      for (const b of SOUND_NAMES) {
        if (a >= b) continue;
        const x = SOUNDS[a];
        const y = SOUNDS[b];
        const same = x.wave === y.wave && x.frequency === y.frequency && x.endFrequency === y.endFrequency;
        expect(same, `${a} vs ${b}`).toBe(false);
        expect(x.wave === y.wave && x.duration === y.duration, `${a} vs ${b} wave+duration`).toBe(false);
      }
    }
  });

  it('slides up for flap, point and date, down for hit', () => {
    for (const name of ['flap', 'point', 'date'] as const) {
      expect(SOUNDS[name].endFrequency).toBeGreaterThan(SOUNDS[name].frequency);
    }
    expect(SOUNDS.hit.endFrequency).toBeLessThan(SOUNDS.hit.frequency);
  });

  it('recognises names', () => {
    expect(isSoundName('flap')).toBe(true);
    expect(isSoundName('boom')).toBe(false);
    expect(isSoundName(3)).toBe(false);
  });
});
