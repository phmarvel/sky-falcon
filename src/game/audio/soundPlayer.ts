import { type MuteStore, getMuteStore } from './muteStore';
import { SOUND_NAMES, type SoundName, recipeOf } from './soundRecipes';

export interface SoundPlayer {
  /** Creates the AudioContext (once) and wakes it up. Call it from a user gesture. Never throws. */
  unlock(): void;
  /** Plays the sound unless muted. Never throws. Muted calls are not counted. */
  play(name: SoundName): void;
  isMuted(): boolean;
  setMuted(muted: boolean): void;
  toggleMuted(): boolean;
  lastSound(): SoundName | null;
  /** All sounds played (asked for while not muted), also when the browser has no audio. */
  soundCount(): number;
  counts(): Record<SoundName, number>;
}

export interface SoundPlayerOptions {
  muteStore: MuteStore;
  /** Makes the audio context; null or a throw means "no audio". Defaults to the browser's. */
  makeContext?: () => AudioContext | null;
}

function browserContext(): AudioContext | null {
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

export function createSoundPlayer({ muteStore, makeContext = browserContext }: SoundPlayerOptions): SoundPlayer {
  let ctx: AudioContext | null = null;
  let tried = false;
  let last: SoundName | null = null;
  let total = 0;
  const counts = Object.fromEntries(SOUND_NAMES.map((n) => [n, 0])) as Record<SoundName, number>;

  const wake = () => {
    try {
      if (ctx && ctx.state === 'suspended') void Promise.resolve(ctx.resume()).catch(() => undefined);
    } catch {
      // Blocked: the game goes on silently.
    }
  };

  const tone = (name: SoundName) => {
    if (!ctx || ctx.state !== 'running') return;
    const r = recipeOf(name);
    const t0 = ctx.currentTime;
    const t1 = t0 + r.duration;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = r.wave;
    osc.frequency.setValueAtTime(r.frequency, t0);
    osc.frequency.exponentialRampToValueAtTime(r.endFrequency, t1);
    gain.gain.setValueAtTime(r.volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  };

  return {
    unlock() {
      if (!tried) {
        tried = true;
        try {
          ctx = makeContext();
        } catch {
          ctx = null;
        }
      }
      wake();
    },
    play(name) {
      if (muteStore.get()) return;
      last = name;
      total += 1;
      counts[name] += 1;
      wake();
      try {
        tone(name);
      } catch {
        // Audio failed: ignore, the game must not stop.
      }
    },
    isMuted: () => muteStore.get(),
    setMuted: (muted) => muteStore.set(muted),
    toggleMuted: () => muteStore.toggle(),
    lastSound: () => last,
    soundCount: () => total,
    counts: () => ({ ...counts }),
  };
}

let shared: SoundPlayer | undefined;

/** One player for the whole page, so both scenes share the mute choice and the audio context. */
export function getSoundPlayer(): SoundPlayer {
  if (!shared) shared = createSoundPlayer({ muteStore: getMuteStore() });
  return shared;
}
