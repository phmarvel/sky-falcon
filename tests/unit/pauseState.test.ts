import { describe, expect, it } from 'vitest';
import {
  PAUSE,
  type PauseState,
  countdownNumber,
  createPause,
  isFrozen,
  pause,
  resume,
  tickPause,
  toggle,
} from '../../src/game/run/pauseState';

/** Ticks in 1/60 s frames for `seconds`. */
function tick(state: PauseState, seconds: number): PauseState {
  let s = state;
  for (let i = 0; i < Math.round(seconds * 60); i++) s = tickPause(s, 1 / 60);
  return s;
}

describe('pauseState', () => {
  it('starts running and is not frozen', () => {
    const s = createPause();
    expect(s.mode).toBe('running');
    expect(isFrozen(s)).toBe(false);
    expect(countdownNumber(s)).toBeNull();
  });

  it('goes running -> paused -> counting -> running', () => {
    const paused = pause(createPause());
    expect(paused.mode).toBe('paused');
    expect(isFrozen(paused)).toBe(true);
    expect(countdownNumber(paused)).toBeNull();
    const counting = resume(paused);
    expect(counting.mode).toBe('counting');
    expect(isFrozen(counting)).toBe(true);
    expect(countdownNumber(counting)).toBe(3);
    const running = tick(counting, PAUSE.countdownFrom * PAUSE.stepSeconds + 0.1);
    expect(running.mode).toBe('running');
    expect(isFrozen(running)).toBe(false);
    expect(countdownNumber(running)).toBeNull();
  });

  it('counts 3, then 2, then 1', () => {
    let s = resume(pause(createPause()));
    const seen: number[] = [];
    for (let i = 0; i < 300 && s.mode === 'counting'; i++) {
      const n = countdownNumber(s)!;
      if (seen[seen.length - 1] !== n) seen.push(n);
      s = tickPause(s, 1 / 60);
    }
    expect(seen).toEqual([3, 2, 1]);
    expect(s.mode).toBe('running');
  });

  it('shows 2 after a bit more than one second and 1 after a bit more than two', () => {
    const counting = resume(pause(createPause()));
    expect(countdownNumber(tick(counting, 1.2))).toBe(2);
    expect(countdownNumber(tick(counting, 2.2))).toBe(1);
  });

  it('caps a slow frame so no number is skipped', () => {
    const counting = resume(pause(createPause()));
    const after = tickPause(counting, 5);
    expect(after.mode).toBe('counting');
    expect(countdownNumber(after)).toBe(3);
    expect(tickPause(counting, NaN)).toEqual(counting);
    expect(tickPause(counting, -1)).toEqual(counting);
  });

  it('pause is ignored unless running, resume unless paused', () => {
    const paused = pause(createPause());
    const counting = resume(paused);
    expect(pause(paused)).toBe(paused);
    expect(pause(counting)).toBe(counting);
    expect(resume(createPause())).toEqual(createPause());
    expect(resume(counting)).toBe(counting);
  });

  it('toggle pauses, then resumes, and is ignored while counting', () => {
    const paused = toggle(createPause());
    expect(paused.mode).toBe('paused');
    const counting = toggle(paused);
    expect(counting.mode).toBe('counting');
    expect(toggle(counting)).toBe(counting);
  });

  it('tickPause does nothing while running or paused', () => {
    const running = createPause();
    const paused = pause(running);
    expect(tickPause(running, 1)).toBe(running);
    expect(tickPause(paused, 1)).toBe(paused);
  });

  it('never changes the state it is given', () => {
    const paused = Object.freeze(pause(createPause()));
    const counting = Object.freeze(resume(paused));
    expect(() => tickPause(counting, 0.5)).not.toThrow();
    expect(counting.left).toBe(PAUSE.countdownFrom * PAUSE.stepSeconds);
    expect(paused.mode).toBe('paused');
  });
});
