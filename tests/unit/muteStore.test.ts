import { describe, expect, it } from 'vitest';
import { MUTE_KEY, createMuteStore, parseMuted } from '../../src/game/audio/muteStore';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
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

describe('parseMuted', () => {
  it('is muted only for 1 or true', () => {
    expect(parseMuted('1')).toBe(true);
    expect(parseMuted('true')).toBe(true);
    expect(parseMuted(' TRUE ')).toBe(true);
    for (const v of ['0', 'false', '', 'yes', 'null', null, undefined]) expect(parseMuted(v)).toBe(false);
  });
});

describe('mute store', () => {
  it('uses the key skyFalcon.muted and starts with sound on', () => {
    expect(MUTE_KEY).toBe('skyFalcon.muted');
    expect(createMuteStore(fakeStorage()).get()).toBe(false);
  });

  it('saves set and toggle, and a new store reads them', () => {
    const storage = fakeStorage();
    const store = createMuteStore(storage);
    store.set(true);
    expect(storage.data[MUTE_KEY]).toBe('1');
    expect(createMuteStore(storage).get()).toBe(true);
    expect(store.toggle()).toBe(false);
    expect(storage.data[MUTE_KEY]).toBe('0');
    expect(createMuteStore(storage).get()).toBe(false);
  });

  it('treats garbage as sound on', () => {
    expect(createMuteStore(fakeStorage({ [MUTE_KEY]: 'banana' })).get()).toBe(false);
  });

  it('falls back to memory when storage is blocked or missing', () => {
    for (const storage of [blocked, undefined]) {
      const store = createMuteStore(storage);
      expect(store.get()).toBe(false);
      store.set(true);
      expect(store.get()).toBe(true);
      expect(store.toggle()).toBe(false);
    }
  });
});
