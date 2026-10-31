import { describe, expect, it } from "vitest";
import {
  BEST_SCORE_KEY,
  createBestScoreStore,
  parseBest,
} from "../../src/game/score/bestScore";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

const blocked = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("parseBest", () => {
  it("reads whole numbers and falls back to 0", () => {
    expect(parseBest("17")).toBe(17);
    expect(parseBest(null)).toBe(0);
    expect(parseBest(undefined)).toBe(0);
    for (const bad of ["", "abc", "-3", "2.5", "NaN", "1e3"])
      expect(parseBest(bad)).toBe(0);
  });
});

describe("createBestScoreStore", () => {
  it("uses the shared key", () => {
    expect(BEST_SCORE_KEY).toBe("skyFalcon.best");
  });

  it("loads 0 when nothing was saved, or storage is missing", () => {
    expect(createBestScoreStore(memoryStorage()).load()).toBe(0);
    expect(createBestScoreStore().load()).toBe(0);
  });

  it("loads a saved best", () => {
    expect(
      createBestScoreStore(memoryStorage({ [BEST_SCORE_KEY]: "42" })).load(),
    ).toBe(42);
  });

  it("records only a higher score and never lowers the best", () => {
    const storage = memoryStorage();
    const store = createBestScoreStore(storage);
    expect(store.record(5)).toEqual({ best: 5, isNewBest: true });
    expect(store.record(3)).toEqual({ best: 5, isNewBest: false });
    expect(store.record(5)).toEqual({ best: 5, isNewBest: false });
    expect(storage.data[BEST_SCORE_KEY]).toBe("5");
    expect(store.load()).toBe(5);
  });

  it("keeps the best of the visit in memory when storage is blocked", () => {
    const store = createBestScoreStore(blocked);
    expect(store.load()).toBe(0);
    expect(store.record(9)).toEqual({ best: 9, isNewBest: true });
    expect(store.load()).toBe(9);
    expect(store.record(4).isNewBest).toBe(false);
  });
});
