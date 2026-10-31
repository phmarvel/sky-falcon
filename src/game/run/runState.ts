import {
  FALCON,
  type FalconBounds,
  type FalconState,
  MAX_FRAME_MS,
  STEP_SECONDS,
  crash,
  stepFalcon,
} from "../falcon/falconPhysics";
import { falconHitsField } from "../obstacles/collision";
import {
  type ObstacleField,
  createField,
  stepField,
} from "../obstacles/obstacleField";

/**
 * One run: the falcon and the obstacles, moved together in fixed steps and checked for a hit on every step.
 * Pure: no Phaser, so it can be tested on its own.
 */
export type RunOverReason = "ground" | "obstacle";

export interface RunState {
  falcon: FalconState;
  /** The obstacles; null when they are switched off (`?obstacles=off`). */
  field: ObstacleField | null;
  over: RunOverReason | null;
  /** How many obstacles the falcon has gone past. */
  passed: number;
}

export interface RunOptions {
  obstacles: boolean;
  /** Seed for the obstacles; a random one when not given. */
  seed: number | undefined;
  /** The game plays itself (a demo, for screenshots). */
  autopilot: boolean;
}

/**
 * Reads the run settings from the page address: `?seed=7` gives the same obstacles every time, `?obstacles=off` flies
 * without them, `?autopilot=1` lets the game play itself.
 */
export function parseRunOptions(search: string): RunOptions {
  const params = new URLSearchParams(search);
  const seedText = params.get("seed");
  const seed =
    seedText !== null && /^-?\d+$/.test(seedText.trim())
      ? Number(seedText)
      : undefined;
  return {
    obstacles: params.get("obstacles") !== "off",
    seed,
    autopilot: params.get("autopilot") === "1",
  };
}

export function createRun(
  falcon: FalconState,
  bounds: FalconBounds,
  seed: number,
  obstacles = true,
): RunState {
  return {
    falcon,
    field: obstacles ? createField(seed, bounds.groundY, falcon.y) : null,
    over: null,
    passed: 0,
  };
}

/** The x the falcon's back edge sits at: an obstacle whose right edge is left of it has been passed. */
const PASS_LINE = FALCON.x - FALCON.radius;

/** One fixed step of `dt` seconds: the falcon, then the obstacles, then the hit check. */
export function stepRun(
  state: RunState,
  dt: number,
  bounds: FalconBounds,
): RunState {
  if (state.over || state.falcon.phase !== "flying") return state;
  const falcon = stepFalcon(state.falcon, dt, bounds);
  if (!state.field)
    return falcon.phase === "down"
      ? { ...state, falcon, over: "ground" }
      : { ...state, falcon };

  const moved = stepField(state.field, dt);
  if (falconHitsField(FALCON.x, falcon.y, FALCON.radius, moved)) {
    // A touch ends the run with no point for this step.
    return {
      falcon: crash(falcon),
      field: moved,
      passed: state.passed,
      over: "obstacle",
    };
  }
  let passed = state.passed;
  const field: ObstacleField = {
    ...moved,
    obstacles: moved.obstacles.map((o) => {
      if (o.passed || o.x + o.width >= PASS_LINE) return o;
      passed++;
      return { ...o, passed: true };
    }),
  };
  if (falcon.phase === "down") return { falcon, field, passed, over: "ground" };
  return { falcon, field, passed, over: null };
}

/** Moves the run on by one frame of `elapsedMs` (capped at MAX_FRAME_MS), in fixed steps; stops at the first hit. */
export function advanceRun(
  state: RunState,
  elapsedMs: number,
  bounds: FalconBounds,
): RunState {
  if (state.over || state.falcon.phase !== "flying") return state;
  let time =
    state.falcon.carry + Math.min(Math.max(elapsedMs, 0), MAX_FRAME_MS) / 1000;
  let next: RunState = { ...state, falcon: { ...state.falcon, carry: 0 } };
  // A small tolerance so that float error doesn't drop a whole step.
  while (time >= STEP_SECONDS - 1e-9) {
    next = stepRun(next, STEP_SECONDS, bounds);
    time -= STEP_SECONDS;
    if (next.over) return next;
  }
  return { ...next, falcon: { ...next.falcon, carry: Math.max(time, 0) } };
}
