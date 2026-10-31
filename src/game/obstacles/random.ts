/**
 * A small seeded random generator (mulberry32). Pure: the state is a plain number kept in the game state,
 * so the same seed always gives the same obstacles.
 */
export interface RandomStep {
  /** A number in [0, 1). */
  value: number;
  state: number;
}

export function randomStep(state: number): RandomStep {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: next };
}

/** A generator function over `randomStep`, for code that only needs numbers. */
export function createRandom(seed: number): () => number {
  let state = seed | 0;
  return () => {
    const step = randomStep(state);
    state = step.state;
    return step.value;
  };
}

/** A seed for a new run when none is given. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}
