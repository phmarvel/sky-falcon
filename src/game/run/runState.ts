import {
  FALCON,
  type FalconBounds,
  type FalconState,
  MAX_FRAME_MS,
  STEP_SECONDS,
  bounce,
  crash,
  stepFalcon,
} from '../falcon/falconPhysics';
import { falconTouchesDate, falconTouchesFeather, obstaclesHit } from '../obstacles/collision';
import { type FeatherMode, type ObstacleField, createField, stepField } from '../obstacles/obstacleField';
import { scoreOf } from '../score/runScore';
import { scrollSpeedOf } from '../score/speedUp';

/**
 * One run: the falcon and the obstacles, moved together in fixed steps and checked for a hit on every step.
 * Pure: no Phaser, so it can be tested on its own.
 */
export type RunOverReason = 'ground' | 'obstacle';

export interface RunState {
  falcon: FalconState;
  /** The obstacles; null when they are switched off (`?obstacles=off`). */
  field: ObstacleField | null;
  over: RunOverReason | null;
  /** How many obstacles the falcon has gone past. */
  passed: number;
  /** How many dates the falcon has caught. */
  dates: number;
  /** True while a golden feather protects the falcon: the next hit (obstacle or sand) is absorbed once. */
  shield: boolean;
  /** How many feathers gave a shield in this run (one caught while shielded does nothing and is not counted). */
  feathers: number;
}

export interface RunOptions {
  obstacles: boolean;
  /** Seed for the obstacles; a random one when not given. */
  seed: number | undefined;
  /** The game plays itself (a demo, for screenshots). */
  autopilot: boolean;
  /** Feathers: 'rare' (seeded), 'always' (every gap after the first) or 'off'. */
  feather: FeatherMode;
  /** The flight opens paused (after one flap), for screenshots. */
  pause: boolean;
}

/**
 * Reads the run settings from the page address: `?seed=7` gives the same obstacles every time, `?obstacles=off` flies
 * without them, `?autopilot=1` lets the game play itself,
 * `?feather=always|off` puts a feather in every gap or in none (rare and seeded otherwise),
 * `?pause=1` opens the flight paused (after one flap).
 */
export function parseRunOptions(search: string): RunOptions {
  const params = new URLSearchParams(search);
  const seedText = params.get('seed');
  const seed = seedText !== null && /^-?\d+$/.test(seedText.trim()) ? Number(seedText) : undefined;
  const featherText = params.get('feather');
  const feather: FeatherMode = featherText === 'always' || featherText === 'off' ? featherText : 'rare';
  return {
    obstacles: params.get('obstacles') !== 'off',
    seed,
    autopilot: params.get('autopilot') === '1',
    feather,
    pause: params.get('pause') === '1',
  };
}

export function createRun(
  falcon: FalconState,
  bounds: FalconBounds,
  seed: number,
  obstacles = true,
  feather: FeatherMode = 'rare',
): RunState {
  return {
    falcon,
    field: obstacles ? createField(seed, bounds.groundY, falcon.y, feather) : null,
    over: null,
    passed: 0,
    dates: 0,
    shield: false,
    feathers: 0,
  };
}

/** The x the falcon's back edge sits at: an obstacle whose right edge is left of it has been passed. */
const PASS_LINE = FALCON.x - FALCON.radius;

/** One fixed step of `dt` seconds: the falcon, then the obstacles, then the hit check. */
export function stepRun(state: RunState, dt: number, bounds: FalconBounds): RunState {
  if (state.over || state.falcon.phase !== 'flying') return state;
  let falcon = stepFalcon(state.falcon, dt, bounds);
  let shield = state.shield;
  // The sand with a shield: the shield breaks and the falcon bounces up; the run goes on.
  if (falcon.phase === 'down' && shield) {
    falcon = bounce(falcon, bounds);
    shield = false;
  }
  if (!state.field) {
    return falcon.phase === 'down' ? { ...state, falcon, shield, over: 'ground' } : { ...state, falcon, shield };
  }

  let moved = stepField(state.field, dt, scrollSpeedOf(scoreOf(state)));
  const hits = obstaclesHit(FALCON.x, falcon.y, FALCON.radius, moved);
  if (hits.length > 0) {
    if (!shield) {
      // A touch ends the run with no point for this step.
      return { ...state, falcon: crash(falcon), field: moved, shield, over: 'obstacle' };
    }
    // The shield takes the hit: it breaks, and these obstacles can't hit the falcon again.
    shield = false;
    moved = { ...moved, obstacles: moved.obstacles.map((o) => (hits.includes(o) ? { ...o, hitAbsorbed: true } : o)) };
  }
  let passed = state.passed;
  let dates = state.dates;
  let feathers = state.feathers;
  const field: ObstacleField = {
    ...moved,
    obstacles: moved.obstacles.map((o) => {
      // A date is caught once: it is marked, so staying near it adds nothing more.
      if (falconTouchesDate(FALCON.x, falcon.y, FALCON.radius, o)) {
        dates++;
        o = { ...o, date: { ...o.date, caught: true } };
      }
      // A feather is taken once. It gives a shield only when there is none; no points either way.
      if (o.feather && falconTouchesFeather(FALCON.x, falcon.y, FALCON.radius, o)) {
        if (!shield) {
          shield = true;
          feathers++;
        }
        o = { ...o, feather: { ...o.feather, caught: true } };
      }
      if (o.passed || o.x + o.width >= PASS_LINE) return o;
      passed++;
      return { ...o, passed: true };
    }),
  };
  return { falcon, field, passed, dates, shield, feathers, over: falcon.phase === 'down' ? 'ground' : null };
}

/** Moves the run on by one frame of `elapsedMs` (capped at MAX_FRAME_MS), in fixed steps; stops at the first hit. */
export function advanceRun(state: RunState, elapsedMs: number, bounds: FalconBounds): RunState {
  if (state.over || state.falcon.phase !== 'flying') return state;
  let time = state.falcon.carry + Math.min(Math.max(elapsedMs, 0), MAX_FRAME_MS) / 1000;
  let next: RunState = { ...state, falcon: { ...state.falcon, carry: 0 } };
  // A small tolerance so that float error doesn't drop a whole step.
  while (time >= STEP_SECONDS - 1e-9) {
    next = stepRun(next, STEP_SECONDS, bounds);
    time -= STEP_SECONDS;
    if (next.over) return next;
  }
  return { ...next, falcon: { ...next.falcon, carry: Math.max(time, 0) } };
}
