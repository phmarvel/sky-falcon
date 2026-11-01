/** The four sound effects, as recipes for an oscillator: no audio files. PURE (no Phaser, no browser). */
export type SoundName = 'flap' | 'point' | 'date' | 'hit';

export const SOUND_NAMES: readonly SoundName[] = ['flap', 'point', 'date', 'hit'];

export interface SoundRecipe {
  wave: 'sine' | 'square' | 'triangle' | 'sawtooth';
  /** Start pitch in Hz. */
  frequency: number;
  /** Pitch in Hz at the end: the sound slides from `frequency` to this. */
  endFrequency: number;
  /** Seconds. */
  duration: number;
  /** Peak gain, 0..1 (kept low: these play often). */
  volume: number;
}

/** Tune the sounds here. Each one must differ from the others (a unit test checks it). */
export const SOUNDS: Record<SoundName, SoundRecipe> = {
  flap: { wave: 'triangle', frequency: 320, endFrequency: 520, duration: 0.09, volume: 0.18 },
  point: { wave: 'square', frequency: 660, endFrequency: 880, duration: 0.12, volume: 0.1 },
  date: { wave: 'sine', frequency: 988, endFrequency: 1318, duration: 0.18, volume: 0.2 },
  hit: { wave: 'sawtooth', frequency: 200, endFrequency: 55, duration: 0.35, volume: 0.22 },
};

export function recipeOf(name: SoundName): SoundRecipe {
  return SOUNDS[name];
}

export function isSoundName(value: unknown): value is SoundName {
  return typeof value === 'string' && (SOUND_NAMES as readonly string[]).includes(value);
}
