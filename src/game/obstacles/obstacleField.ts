import { GAME_WIDTH } from '../constants';
import { randomStep } from './random';

/**
 * The towers and palm trees: where they are, how they move and where their gaps are.
 * Pure: no Phaser, so it can be tested on its own. Units are game pixels and game seconds.
 */
export const OBSTACLES = {
  /** How fast every obstacle moves left at the start, in pixels per second (it speeds up with the score). */
  speed: 180,
  /** Distance between the left edges of two obstacles that follow each other. */
  spacing: 300,
  width: 84,
  /** Height of the gap the falcon flies through. */
  gapSize: 230,
  /** The pieces above and below the gap are always at least this tall, so the gap stays inside the playing area. */
  minPiece: 70,
  /** Most a gap moves up or down from one obstacle to the next, so the next gap is always reachable. */
  maxShift: 200,
  /** Least a gap moves from one obstacle to the next, so gaps are never at the same height twice in a row. */
  minShift: 40,
  /** At most this many obstacles of the same kind in a row. */
  maxSameKind: 2,
  /** Where a new obstacle appears: just off the right edge. */
  spawnX: GAME_WIDTH,
  /** The first gap keeps the falcon's start height (y) at least this far inside it. */
  firstGapMargin: 60,
} as const;

/** The date floating in the middle of each gap: catching it is worth one point. */
export const DATE = {
  radius: 16,
  /** Distance from the obstacle's left edge to the date's centre: the middle of the obstacle. */
  offsetX: OBSTACLES.width / 2,
} as const;

export type ObstacleKind = 'tower' | 'palm';

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  /** Left edge, in game pixels. */
  x: number;
  width: number;
  /** Top and bottom of the gap (y grows downwards). */
  gapTop: number;
  gapBottom: number;
  /** True once the falcon has gone past it. */
  passed: boolean;
  /** The date in the gap: centred on the obstacle, halfway between `gapTop` and `gapBottom`. */
  date: { y: number; caught: boolean };
}

export interface ObstacleField {
  obstacles: Obstacle[];
  /** The y where the ground starts: the bottom of the playing area. */
  groundY: number;
  /** The falcon's start height: the first gap is placed around it. */
  startY: number;
  nextId: number;
  /** State of the seeded random generator. */
  random: number;
  lastGapTop: number | undefined;
  lastKind: ObstacleKind | undefined;
  /** How many obstacles of `lastKind` came in a row. */
  sameKindRun: number;
}

export function createField(seed: number, groundY: number, startY: number): ObstacleField {
  return {
    obstacles: [],
    groundY,
    startY,
    nextId: 1,
    random: seed | 0,
    lastGapTop: undefined,
    lastKind: undefined,
    sameKindRun: 0,
  };
}

/** The lowest and highest `gapTop` that keep the whole gap, and a piece above and below it, in the playing area. */
export function gapRange(groundY: number): { min: number; max: number } {
  return { min: OBSTACLES.minPiece, max: groundY - OBSTACLES.minPiece - OBSTACLES.gapSize };
}

/**
 * The next gap's top. The first one is around the falcon's start height; each later one moves between
 * `minShift` and `maxShift` from the one before, inside `gapRange`.
 */
export function nextGap(
  prevGapTop: number | undefined,
  rnd: () => number,
  groundY: number,
  startY: number,
): number {
  const range = gapRange(groundY);
  const clamp = (v: number) => Math.min(range.max, Math.max(range.min, v));
  if (prevGapTop === undefined) {
    const lo = clamp(startY - OBSTACLES.gapSize + OBSTACLES.firstGapMargin);
    const hi = clamp(startY - OBSTACLES.firstGapMargin);
    return Math.round(lo + (hi - lo) * rnd());
  }
  const lo = clamp(prevGapTop - OBSTACLES.maxShift);
  const hi = clamp(prevGapTop + OBSTACLES.maxShift);
  // Pick a shift up or down, then a size; only the sides with room for `minShift` are used.
  const roomUp = prevGapTop - lo;
  const roomDown = hi - prevGapTop;
  const canUp = roomUp >= OBSTACLES.minShift;
  const canDown = roomDown >= OBSTACLES.minShift;
  const goUp = canUp && canDown ? rnd() < 0.5 : canUp;
  const room = goUp ? roomUp : roomDown;
  const shift = OBSTACLES.minShift + (room - OBSTACLES.minShift) * rnd();
  return Math.round(goUp ? prevGapTop - shift : prevGapTop + shift);
}

function spawn(field: ObstacleField, x: number): ObstacleField {
  let random = field.random;
  const rnd = () => {
    const step = randomStep(random);
    random = step.state;
    return step.value;
  };
  const gapTop = nextGap(field.lastGapTop, rnd, field.groundY, field.startY);
  let kind: ObstacleKind = rnd() < 0.5 ? 'tower' : 'palm';
  if (field.lastKind === kind && field.sameKindRun >= OBSTACLES.maxSameKind) {
    kind = kind === 'tower' ? 'palm' : 'tower';
  }
  const obstacle: Obstacle = {
    id: field.nextId,
    kind,
    x,
    width: OBSTACLES.width,
    gapTop,
    gapBottom: gapTop + OBSTACLES.gapSize,
    passed: false,
    date: { y: gapTop + OBSTACLES.gapSize / 2, caught: false },
  };
  return {
    ...field,
    obstacles: [...field.obstacles, obstacle],
    nextId: field.nextId + 1,
    random,
    lastGapTop: gapTop,
    lastKind: kind,
    sameKindRun: field.lastKind === kind ? field.sameKindRun + 1 : 1,
  };
}

/** True once the obstacle is fully past the left edge of the screen. */
export function isOffScreen(obstacle: Obstacle): boolean {
  return obstacle.x + obstacle.width < 0;
}

/**
 * Moves every obstacle left by `speed * dt` (the starting speed unless given), drops the ones fully off the left edge and adds new ones on the right,
 * exactly `spacing` apart. The first call adds the first obstacle.
 */
export function stepField(field: ObstacleField, dt: number, speed: number = OBSTACLES.speed): ObstacleField {
  const move = speed * dt;
  let next: ObstacleField = {
    ...field,
    obstacles: field.obstacles.map((o) => ({ ...o, x: o.x - move })).filter((o) => !isOffScreen(o)),
  };
  if (field.obstacles.length === 0 && field.lastGapTop === undefined) next = spawn(next, OBSTACLES.spawnX);
  // Compare against the last obstacle ever added (it may not be culled: it is the rightmost one).
  for (let last = next.obstacles.at(-1); last && last.x + OBSTACLES.spacing <= OBSTACLES.spawnX; ) {
    next = spawn(next, last.x + OBSTACLES.spacing);
    last = next.obstacles.at(-1);
  }
  return next;
}
