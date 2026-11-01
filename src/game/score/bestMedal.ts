import { type Medal, betterMedal, parseMedal, rankOf } from './medals';

/** The best medal ever won, kept on the device. Shared by the start screen and the game over screen. */
export const BEST_MEDAL_KEY = 'skyFalcon.medal';

type MedalStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface BestMedalStore {
  /** The best medal so far (null if none). */
  load(): Medal | null;
  /** Notes the medal of a finished run; saves it only when it is better than the best. Never lowers it. */
  record(medal: Medal | null): { best: Medal | null; isNewBest: boolean };
}

/** `storage` may be missing or blocked; the best medal of this visit is then kept in memory. */
export function createBestMedalStore(storage?: MedalStorage): BestMedalStore {
  let memory: Medal | null = null;
  const stored = (): Medal | null => {
    try {
      return storage ? parseMedal(storage.getItem(BEST_MEDAL_KEY)) : null;
    } catch {
      return null;
    }
  };
  const current = () => betterMedal(memory, stored());
  return {
    load: current,
    record(medal) {
      const best = current();
      if (rankOf(medal) <= rankOf(best)) return { best, isNewBest: false };
      memory = medal;
      try {
        storage?.setItem(BEST_MEDAL_KEY, medal as Medal);
      } catch {
        // Blocked storage: the best medal stays in memory for this visit.
      }
      return { best: medal, isNewBest: true };
    },
  };
}

let shared: BestMedalStore | undefined;

/** One store for the whole page, on the browser's localStorage when it can be reached. */
export function getBestMedalStore(): BestMedalStore {
  if (!shared) {
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      storage = undefined;
    }
    shared = createBestMedalStore(storage);
  }
  return shared;
}
