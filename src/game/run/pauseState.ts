/**
 * The pause state machine, PURE: running -> paused -> counting (3, 2, 1) -> running.
 * The scene skips the run's step while `isFrozen`, so nothing in the run moves; this only decides when.
 * Time is the game's frame time in seconds (never the wall clock).
 */
export type PauseMode = 'running' | 'paused' | 'counting';

export interface PauseState {
  mode: PauseMode;
  /** Seconds of the countdown left; only meaningful while counting. */
  left: number;
}

export const PAUSE = {
  /** The countdown shows 3, 2, 1. */
  countdownFrom: 3,
  /** Seconds each number stays. */
  stepSeconds: 1,
  /** A slow frame counts for at most this many seconds, so no number is skipped. */
  maxFrame: 0.1,
} as const;

export function createPause(): PauseState {
  return { mode: 'running', left: 0 };
}

/** running -> paused. Any other mode stays as it is. */
export function pause(state: PauseState): PauseState {
  return state.mode === 'running' ? { mode: 'paused', left: 0 } : state;
}

/** paused -> counting from 3. Any other mode stays as it is. */
export function resume(state: PauseState): PauseState {
  return state.mode === 'paused' ? { mode: 'counting', left: PAUSE.countdownFrom * PAUSE.stepSeconds } : state;
}

/** The pause button / key: running -> paused, paused -> counting; ignored while counting. */
export function toggle(state: PauseState): PauseState {
  return state.mode === 'running' ? pause(state) : resume(state);
}

/** Advances the countdown by `dt` seconds; when it reaches 0 the run is running again. */
export function tickPause(state: PauseState, dt: number): PauseState {
  if (state.mode !== 'counting') return state;
  const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, PAUSE.maxFrame) : 0;
  const left = state.left - step;
  return left > 1e-9 ? { mode: 'counting', left } : { mode: 'running', left: 0 };
}

/** 3, 2 or 1 while counting, else null. */
export function countdownNumber(state: PauseState): number | null {
  if (state.mode !== 'counting') return null;
  return Math.min(PAUSE.countdownFrom, Math.max(1, Math.ceil(state.left / PAUSE.stepSeconds)));
}

/** True while paused or counting: the run must not advance. */
export function isFrozen(state: PauseState): boolean {
  return state.mode !== 'running';
}
