import { describe, expect, it } from 'vitest';
import { BEST_MEDAL_KEY, createBestMedalStore } from '../../src/game/score/bestMedal';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}
const blocked = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('best medal store', () => {
  it('uses the key skyFalcon.medal and starts empty', () => {
    expect(BEST_MEDAL_KEY).toBe('skyFalcon.medal');
    expect(createBestMedalStore(memoryStorage()).load()).toBeNull();
    expect(createBestMedalStore().load()).toBeNull();
  });
  it('saves better medals and never lowers the stored one', () => {
    const storage = memoryStorage();
    const store = createBestMedalStore(storage);
    expect(store.record(null)).toEqual({ best: null, isNewBest: false });
    expect(store.record('bronze')).toEqual({ best: 'bronze', isNewBest: true });
    expect(store.record('gold')).toEqual({ best: 'gold', isNewBest: true });
    expect(store.record('silver')).toEqual({ best: 'gold', isNewBest: false });
    expect(store.record('gold')).toEqual({ best: 'gold', isNewBest: false });
    expect(store.record(null).best).toBe('gold');
    expect(storage.data[BEST_MEDAL_KEY]).toBe('gold');
  });
  it('is remembered by a second store on the same storage (a reload)', () => {
    const storage = memoryStorage();
    createBestMedalStore(storage).record('silver');
    const again = createBestMedalStore(storage);
    expect(again.load()).toBe('silver');
    expect(again.record('bronze').best).toBe('silver');
  });
  it('ignores junk in storage', () => {
    const store = createBestMedalStore(memoryStorage({ [BEST_MEDAL_KEY]: 'diamond' }));
    expect(store.load()).toBeNull();
    expect(store.record('bronze').best).toBe('bronze');
  });
  it('keeps the best in memory when storage is blocked', () => {
    const store = createBestMedalStore(blocked);
    expect(store.load()).toBeNull();
    expect(store.record('silver')).toEqual({ best: 'silver', isNewBest: true });
    expect(store.record('bronze')).toEqual({ best: 'silver', isNewBest: false });
    expect(store.load()).toBe('silver');
  });
});
