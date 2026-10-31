/** The best score kept on the device. Shared by the start screen and the game over screen. */
export const BEST_SCORE_KEY = "skyFalcon.best";

type ScoreStorage = Pick<Storage, "getItem" | "setItem">;

/** A stored value as a score: a whole number, 0 or more; anything else is 0. */
export function parseBest(raw: string | null | undefined): number {
  if (raw == null || !/^\d+$/.test(raw.trim())) return 0;
  const n = Number(raw.trim());
  return Number.isSafeInteger(n) ? n : 0;
}

export interface BestScoreStore {
  /** The best score so far (0 if none). */
  load(): number;
  /** Notes a finished run's score; saves it when it beats the best. */
  record(score: number): { best: number; isNewBest: boolean };
}

/** `storage` may be missing or blocked; the best of this visit is then kept in memory. */
export function createBestScoreStore(storage?: ScoreStorage): BestScoreStore {
  let memory = 0;
  const stored = (): number => {
    try {
      return storage ? parseBest(storage.getItem(BEST_SCORE_KEY)) : 0;
    } catch {
      return 0;
    }
  };
  return {
    load: () => Math.max(memory, stored()),
    record(score) {
      const current = Math.max(memory, stored());
      const value = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
      if (value <= current) return { best: current, isNewBest: false };
      memory = value;
      try {
        storage?.setItem(BEST_SCORE_KEY, String(value));
      } catch {
        // Blocked storage: the best stays in memory for this visit.
      }
      return { best: value, isNewBest: true };
    },
  };
}

let shared: BestScoreStore | undefined;

/** One store for the whole page, on the browser's localStorage when it can be reached. */
export function getBestScoreStore(): BestScoreStore {
  if (!shared) {
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      storage = undefined;
    }
    shared = createBestScoreStore(storage);
  }
  return shared;
}
