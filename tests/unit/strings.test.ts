import { describe, expect, it } from 'vitest';
import { STRINGS, type Lang, directionOf, formatNumber, otherLang, t } from '../../src/game/i18n/strings';

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

  it('writes every digit in Arabic-Indic form in Arabic and Western in English', () => {
    expect(formatNumber(12, 'ar')).toBe('١٢');
    expect(formatNumber(0, 'ar')).toBe('٠');
    expect(formatNumber(1234, 'ar')).toBe('١٢٣٤');
    expect(formatNumber(1234567890, 'ar')).toBe('١٢٣٤٥٦٧٨٩٠');
    expect(formatNumber(12, 'en')).toBe('12');
    expect(formatNumber(1234, 'en')).toBe('1234');
  });

  it('shows 0 for bad numbers and rounds fractions down', () => {
    for (const lang of ['en', 'ar'] as const) {
      expect(formatNumber(NaN, lang)).toBe(formatNumber(0, lang));
      expect(formatNumber(-5, lang)).toBe(formatNumber(0, lang));
      expect(formatNumber(Infinity, lang)).toBe(formatNumber(0, lang));
      expect(formatNumber(3.7, lang)).toBe(formatNumber(3, lang));
    }
    expect(formatNumber(3.7, 'ar')).toBe('٣');
  });

  it('gives the other language', () => {
    expect(otherLang('en')).toBe('ar');
    expect(otherLang('ar')).toBe('en');
  });
});
