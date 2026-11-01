/** The mute choice kept on the device. */
export const MUTE_KEY = 'skyFalcon.muted';

type MuteStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** A stored value as "muted": only '1' or 'true'; anything else (or nothing) is sound on. */
export function parseMuted(raw: string | null | undefined): boolean {
  const value = raw?.trim().toLowerCase();
  return value === '1' || value === 'true';
}

export interface MuteStore {
  get(): boolean;
  set(muted: boolean): void;
  toggle(): boolean;
}

/** `storage` may be missing or blocked; the choice then lasts for this visit (kept in memory). */
export function createMuteStore(storage?: MuteStorage): MuteStore {
  let memory: boolean | null = null;
  const stored = (): boolean => {
    try {
      return storage ? parseMuted(storage.getItem(MUTE_KEY)) : false;
    } catch {
      return false;
    }
  };
  const store: MuteStore = {
    get: () => memory ?? stored(),
    set(muted) {
      memory = muted;
      try {
        storage?.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {
        // Blocked storage: the choice stays in memory for this visit.
      }
    },
    toggle() {
      store.set(!store.get());
      return store.get();
    },
  };
  return store;
}

let shared: MuteStore | undefined;

/** One store for the whole page, on the browser's localStorage when it can be reached. */
export function getMuteStore(): MuteStore {
  if (!shared) {
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      storage = undefined;
    }
    shared = createMuteStore(storage);
  }
  return shared;
}
