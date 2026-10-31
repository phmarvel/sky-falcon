import { describe, expect, it } from 'vitest';
import { LANG_KEY, createLangStore, langFromSearch, parseLang } from '../../src/game/i18n/langStore';

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

describe('langStore', () => {
  it('parses only en and ar', () => {
    expect(parseLang('en')).toBe('en');
    expect(parseLang('ar')).toBe('ar');
    expect(parseLang('AR')).toBe('ar');
    for (const bad of [null, undefined, '', 'fr']) expect(parseLang(bad)).toBeNull();
  });

  it('reads ?lang=', () => {
    expect(langFromSearch('?lang=ar')).toBe('ar');
    expect(langFromSearch('?lang=xx')).toBeNull();
    expect(langFromSearch('')).toBeNull();
  });

  it('defaults to English when nothing was chosen', () => {
    expect(createLangStore(fakeStorage()).get()).toBe('en');
  });

  it('remembers the choice for a new store (reload)', () => {
    const storage = fakeStorage();
    createLangStore(storage).set('ar');
    expect(storage.data[LANG_KEY]).toBe('ar');
    expect(createLangStore(storage).get()).toBe('ar');
  });

  it('ignores a garbage stored value', () => {
    expect(createLangStore(fakeStorage({ [LANG_KEY]: 'zz' })).get()).toBe('en');
  });

  it('works for this visit when storage is blocked or missing', () => {
    for (const storage of [blocked, undefined]) {
      const store = createLangStore(storage);
      expect(store.get()).toBe('en');
      expect(() => store.set('ar')).not.toThrow();
      expect(store.get()).toBe('ar');
      store.set('en');
      expect(store.get()).toBe('en');
    }
  });

  it('lets the address override the saved language until a switch', () => {
    const store = createLangStore(fakeStorage({ [LANG_KEY]: 'en' }), 'ar');
    expect(store.get()).toBe('ar');
    store.set('en');
    expect(store.get()).toBe('en');
  });
});
