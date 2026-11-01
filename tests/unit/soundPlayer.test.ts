import { describe, expect, it } from 'vitest';
import { createMuteStore } from '../../src/game/audio/muteStore';
import { createSoundPlayer } from '../../src/game/audio/soundPlayer';

function fakeContext(state = 'running') {
  const made: string[] = [];
  const param = () => ({
    setValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
  });
  const ctx = {
    state,
    currentTime: 0,
    destination: {},
    resumed: 0,
    resume() {
      this.resumed += 1;
      return Promise.resolve();
    },
    createOscillator: () => {
      made.push('osc');
      return { type: '', frequency: param(), connect: () => undefined, start: () => undefined, stop: () => undefined };
    },
    createGain: () => ({ gain: param(), connect: () => undefined }),
  };
  return { ctx, made };
}

describe('sound player', () => {
  it('makes no context before unlock, and only one after', () => {
    let calls = 0;
    const { ctx } = fakeContext();
    const p = createSoundPlayer({
      muteStore: createMuteStore(),
      makeContext: () => {
        calls += 1;
        return ctx as unknown as AudioContext;
      },
    });
    expect(calls).toBe(0);
    p.unlock();
    p.unlock();
    expect(calls).toBe(1);
  });

  it('counts and plays sounds, and records the last one', () => {
    const { ctx, made } = fakeContext();
    const p = createSoundPlayer({ muteStore: createMuteStore(), makeContext: () => ctx as unknown as AudioContext });
    p.unlock();
    p.play('flap');
    p.play('hit');
    expect(p.soundCount()).toBe(2);
    expect(p.lastSound()).toBe('hit');
    expect(p.counts()).toEqual({ flap: 1, point: 0, date: 0, hit: 1 });
    expect(made).toHaveLength(2);
  });

  it('is silent and does not count while muted', () => {
    const { ctx, made } = fakeContext();
    const store = createMuteStore();
    const p = createSoundPlayer({ muteStore: store, makeContext: () => ctx as unknown as AudioContext });
    p.unlock();
    p.setMuted(true);
    p.play('date');
    expect(p.soundCount()).toBe(0);
    expect(p.lastSound()).toBeNull();
    expect(made).toHaveLength(0);
    expect(p.toggleMuted()).toBe(false);
    p.play('date');
    expect(p.soundCount()).toBe(1);
  });

  it('wakes a suspended context but does not schedule on it', () => {
    const { ctx, made } = fakeContext('suspended');
    const p = createSoundPlayer({ muteStore: createMuteStore(), makeContext: () => ctx as unknown as AudioContext });
    p.unlock();
    p.play('point');
    expect(ctx.resumed).toBeGreaterThan(0);
    expect(made).toHaveLength(0);
    expect(p.soundCount()).toBe(1);
  });

  it('never throws when audio is missing or broken', () => {
    const makers = [
      () => {
        throw new Error('no audio');
      },
      () => null,
      () => ({ state: 'running', createOscillator: () => { throw new Error('boom'); } }) as unknown as AudioContext,
    ];
    for (const makeContext of makers) {
      const p = createSoundPlayer({ muteStore: createMuteStore(), makeContext });
      expect(() => {
        p.play('flap');
        p.unlock();
        p.play('flap');
        p.play('hit');
      }).not.toThrow();
      expect(p.soundCount()).toBe(3);
    }
  });
});
