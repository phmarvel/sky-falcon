/** Everything the player reads, in English and Arabic. Add new texts to both. */
export const STRINGS = {
  en: {
    title: 'Sky Falcon',
    bestScore: 'Best score',
    play: 'Play',
    gameOver: 'Game over',
    score: 'Score',
    playAgain: 'Play again',
    newBest: 'New best!',
    switchLanguage: 'العربية',
    mute: 'Sound off',
    unmute: 'Sound on',
    medal: 'Medal',
    bestMedal: 'Best medal',
    noMedal: 'None',
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    pause: 'Pause',
    paused: 'Paused',
    resumeHint: 'Tap to resume',
  },
  ar: {
    title: 'صقر السماء',
    bestScore: 'أفضل نتيجة',
    play: 'العب',
    gameOver: 'انتهت اللعبة',
    score: 'النتيجة',
    playAgain: 'العب مرة أخرى',
    newBest: 'رقم قياسي جديد!',
    switchLanguage: 'English',
    mute: 'كتم الصوت',
    unmute: 'تشغيل الصوت',
    medal: 'الميدالية',
    bestMedal: 'أفضل ميدالية',
    noMedal: 'لا شيء',
    bronze: 'برونزية',
    silver: 'فضية',
    gold: 'ذهبية',
    pause: 'إيقاف مؤقت',
    paused: 'متوقف مؤقتًا',
    resumeHint: 'المس للمتابعة',
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

const NUMBER_FORMATS = {
  en: new Intl.NumberFormat('en-US', { numberingSystem: 'latn', useGrouping: false, maximumFractionDigits: 0 }),
  ar: new Intl.NumberFormat('ar-EG', { numberingSystem: 'arab', useGrouping: false, maximumFractionDigits: 0 }),
};

/**
 * A number as the player reads it: Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) for Arabic, Western digits for English.
 * EVERY number the game shows must go through here with the current language.
 * Not a whole number >= 0 (NaN, infinity, negative) shows as 0; a fraction is rounded down.
 */
export function formatNumber(n: number, lang: Lang): string {
  const whole = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  return (NUMBER_FORMATS[lang] ?? NUMBER_FORMATS.en).format(whole);
}

/** Reading direction of a language. */
export function directionOf(lang: Lang): 'ltr' | 'rtl' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

/** The other language, for the switch. */
export function otherLang(lang: Lang): Lang {
  return lang === 'ar' ? 'en' : 'ar';
}
