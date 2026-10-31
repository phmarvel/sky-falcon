/**
 * Turns key events into presses: a key held down (with the system's auto-repeat) counts once,
 * and counts again only after it is released. Pure: no Phaser.
 */
export interface PressGate {
  /** True when this keydown is a new press. */
  down(key: string, isRepeat?: boolean): boolean;
  up(key: string): void;
  isDown(key: string): boolean;
}

export function createPressGate(): PressGate {
  const held = new Set<string>();
  return {
    down(key, isRepeat = false) {
      if (isRepeat || held.has(key)) {
        held.add(key);
        return false;
      }
      held.add(key);
      return true;
    },
    up(key) {
      held.delete(key);
    },
    isDown(key) {
      return held.has(key);
    },
  };
}
