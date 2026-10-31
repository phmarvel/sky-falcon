/** Everything the player reads, in English and Arabic. Add new texts to both. */
export const STRINGS = {
  en: {
    title: 'Sky Falcon',
    bestScore: 'Best score',
    play: 'Play',
  },
  ar: {
    title: 'صقر السماء',
    bestScore: 'أفضل نتيجة',
    play: 'العب',
  },
} as const;

export type Lang = keyof typeof STRINGS;
export type StringKey = keyof (typeof STRINGS)['en'];

export const DEFAULT_LANG: Lang = 'en';

/** The text for `key` in `lang`; English when the language or the text is missing. */
export function t(lang: Lang, key: StringKey): string {
  const table = (STRINGS as Record<string, Record<string, string>>)[lang] ?? STRINGS.en;
  return table[key] ?? STRINGS.en[key];
}

/** A number as the player reads it: Arabic-Indic digits for Arabic. */
export function formatNumber(n: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US', { useGrouping: false }).format(n);
}

/** Reading direction of a language. */
export function directionOf(lang: Lang): 'ltr' | 'rtl' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}
