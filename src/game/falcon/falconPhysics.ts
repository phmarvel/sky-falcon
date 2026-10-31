import { GAME_HEIGHT, GAME_WIDTH } from '../constants';

/**
 * How the falcon moves. Pure: no Phaser, so it can be tested on its own.
 * Units are game pixels (540x960) and seconds; y grows downwards.
 */
export const FALCON = {
  /** Radius of the falcon's body, used for the ceiling and the ground. */
  radius: 22,
  x: Math.round(GAME_WIDTH * 0.3),
  startY: Math.round(GAME_HEIGHT * 0.42),
  /** Pixels per second, per second. */
  gravity: 1800,
  /** The vertical speed a flap sets (negative: upwards). */
  flapVelocity: -560,
  /** Highest falling speed; high enough that a normal fall keeps speeding up. */
  maxFallSpeed: 1000,
} as const;

/** The physics runs in fixed steps, so it behaves the same at any frame rate. */
export const STEP_SECONDS = 1 / 120;
/** A longer frame (a slow device, a tab coming back) counts as this long, so the falcon never jumps through the ground. */
export const MAX_FRAME_MS = 100;

export type FalconPhase = 'ready' | 'flying' | 'down';

export interface FalconState {
  y: number;
  /** Vertical speed in pixels per second (negative: upwards). */
  vy: number;
  phase: FalconPhase;
  /** How many flaps the player made in this run. */
  flaps: number;
  /** Time not yet simulated, carried to the next frame (seconds). */
  carry: number;
}

export interface FalconBounds {
  /** The top of the screen. */
  top: number;
  /** Where the ground starts. */
  groundY: number;
}

export function createFalcon(y: number = FALCON.startY): FalconState {
  return { y, vy: 0, phase: 'ready', flaps: 0, carry: 0 };
}

/** A flap: starts the run from 'ready', pushes the falcon up while flying, and does nothing once it is down. */
export function flap(state: FalconState): FalconState {
  if (state.phase === 'down') return state;
  return { ...state, phase: 'flying', vy: FALCON.flapVelocity, flaps: state.flaps + 1 };
}

/** One step of `dt` seconds: gravity, then the ceiling and the ground. */
export function stepFalcon(state: FalconState, dt: number, bounds: FalconBounds): FalconState {
  if (state.phase !== 'flying') return state;
  const vy = Math.min(state.vy + FALCON.gravity * dt, FALCON.maxFallSpeed);
  let y = state.y + vy * dt;
  const ceiling = bounds.top + FALCON.radius;
  if (y <= ceiling) {
    // Held at the top edge; the upward speed is lost so it doesn't stick there.
    return { ...state, y: ceiling, vy: Math.max(vy, 0) };
  }
  const floor = bounds.groundY - FALCON.radius;
  if (y >= floor) {
    y = floor;
    return { ...state, y, vy: 0, phase: 'down', carry: 0 };
  }
  return { ...state, y, vy };
}

/** Moves the falcon on by one frame of `elapsedMs`, in fixed steps. */
export function advanceFalcon(state: FalconState, elapsedMs: number, bounds: FalconBounds): FalconState {
  if (state.phase !== 'flying') return state;
  let time = state.carry + Math.min(Math.max(elapsedMs, 0), MAX_FRAME_MS) / 1000;
  let next: FalconState = { ...state, carry: 0 };
  // A small tolerance so that float error doesn't drop a whole step.
  while (time >= STEP_SECONDS - 1e-9) {
    next = stepFalcon(next, STEP_SECONDS, bounds);
    time -= STEP_SECONDS;
    if (next.phase !== 'flying') return next;
  }
  return { ...next, carry: Math.max(time, 0) };
}

export const MIN_TILT = -25;
export const MAX_TILT = 70;

/** The angle to draw the falcon at, in degrees: nose up when climbing, nose down when diving. */
export function falconTilt(vy: number, phase: FalconPhase): number {
  if (phase === 'ready') return 0;
  if (phase === 'down') return 20;
  // Climbing at flap speed gives MIN_TILT; falling at maxFallSpeed gives MAX_TILT.
  const angle = vy < 0 ? (vy / -FALCON.flapVelocity) * -MIN_TILT : (vy / FALCON.maxFallSpeed) * MAX_TILT;
  return Math.min(MAX_TILT, Math.max(MIN_TILT, angle));
}
