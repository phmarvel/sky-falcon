import { DEFAULT_LANG, type Lang } from './strings';

/** The chosen language kept on the device. */
export const LANG_KEY = 'skyFalcon.lang';

type LangStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** A stored or typed value as a language; anything else is null. */
export function parseLang(raw: string | null | undefined): Lang | null {
  const value = raw?.trim().toLowerCase();
  return value === 'en' || value === 'ar' ? value : null;
}

/** `?lang=ar|en` from the address, or null. */
export function langFromSearch(search: string): Lang | null {
  return parseLang(new URLSearchParams(search).get('lang'));
}

export interface LangStore {
  get(): Lang;
  set(lang: Lang): void;
}

/**
 * Before a switch the language is `override` (from the address), else the saved one, else the default.
 * `storage` may be missing or blocked; a switch then lasts for this visit (kept in memory).
 */
export function createLangStore(storage?: LangStorage, override: Lang | null = null): LangStore {
  let memory: Lang | null = null;
  const stored = (): Lang | null => {
    try {
      return storage ? parseLang(storage.getItem(LANG_KEY)) : null;
    } catch {
      return null;
    }
  };
  return {
    get: () => memory ?? override ?? stored() ?? DEFAULT_LANG,
    set(lang) {
      memory = lang;
      try {
        storage?.setItem(LANG_KEY, lang);
      } catch {
        // Blocked storage: the choice stays in memory for this visit.
      }
    },
  };
}

let shared: LangStore | undefined;

/** One store for the whole page, on the browser's localStorage when it can be reached. */
export function getLangStore(): LangStore {
  if (!shared) {
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      storage = undefined;
    }
    shared = createLangStore(storage, langFromSearch(window.location.search));
  }
  return shared;
}
