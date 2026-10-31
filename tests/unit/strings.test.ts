import { describe, expect, it } from 'vitest';
import { STRINGS, type Lang, directionOf, formatNumber, t } from '../../src/game/i18n/strings';

describe('strings', () => {
  it('has the same non-empty keys in English and Arabic', () => {
    expect(Object.keys(STRINGS.ar).sort()).toEqual(Object.keys(STRINGS.en).sort());
    for (const lang of ['en', 'ar'] as const)
      for (const value of Object.values(STRINGS[lang])) expect(value.length).toBeGreaterThan(0);
  });

  it('names the game', () => {
    expect(t('en', 'title')).toBe('Sky Falcon');
  });

  it('falls back to English for an unknown language', () => {
    expect(t('xx' as Lang, 'play')).toBe('Play');
  });

  it('formats numbers per language and gives the direction', () => {
    expect(formatNumber(42, 'en')).toBe('42');
    expect(formatNumber(42, 'ar')).toBe('٤٢');
    expect(directionOf('ar')).toBe('rtl');
    expect(directionOf('en')).toBe('ltr');
  });
});
