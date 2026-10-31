import { describe, expect, it } from 'vitest';
import { FALCON } from '../../src/game/falcon/falconPhysics';
import {
  OBSTACLES,
  type ObstacleField,
  createField,
  gapRange,
  isOffScreen,
  nextGap,
  stepField,
} from '../../src/game/obstacles/obstacleField';
import { createRandom } from '../../src/game/obstacles/random';

const GROUND = 749;
const DT = 1 / 120;
const INTERVAL = OBSTACLES.spacing / OBSTACLES.speed;

function run(field: ObstacleField, seconds: number): ObstacleField {
  for (let i = 0; i < Math.round(seconds / DT); i++) field = stepField(field, DT);
  return field;
}

/** Every obstacle the field ever made in `seconds`, in order. */
function collect(seed: number, seconds: number) {
  let field = createField(seed, GROUND, FALCON.startY);
  const seen = new Map<number, ObstacleField['obstacles'][number]>();
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    field = stepField(field, DT);
    for (const o of field.obstacles) if (!seen.has(o.id)) seen.set(o.id, o);
  }
  return [...seen.values()];
}

describe('stepField', () => {
  it('adds the first obstacle just off the right edge on the first step', () => {
    const field = stepField(createField(1, GROUND, FALCON.startY), DT);
    expect(field.obstacles).toHaveLength(1);
    expect(field.obstacles[0].x).toBe(OBSTACLES.spawnX);
  });

  it('moves every obstacle left at a steady speed', () => {
    const before = run(createField(1, GROUND, FALCON.startY), 1);
    const after = stepField(before, 0.25);
    for (const o of before.obstacles) {
      const moved = after.obstacles.find((a) => a.id === o.id)!;
      expect(moved.x).toBeCloseTo(o.x - OBSTACLES.speed * 0.25, 6);
    }
  });

  it('keeps adding obstacles from the right at regular intervals, exactly `spacing` apart', () => {
    let field = createField(3, GROUND, FALCON.startY);
    const spawnTimes: number[] = [];
    let t = 0;
    for (let i = 0; i < Math.round(20 / DT); i++) {
      const before = field.nextId;
      field = stepField(field, DT);
      t += DT;
      if (field.nextId !== before) spawnTimes.push(t);
      const xs = field.obstacles.map((o) => o.x);
      for (let k = 1; k < xs.length; k++) expect(xs[k] - xs[k - 1]).toBeCloseTo(OBSTACLES.spacing, 6);
      for (const x of xs) expect(x).toBeLessThanOrEqual(OBSTACLES.spawnX + 1e-6);
    }
    expect(spawnTimes.length).toBeGreaterThanOrEqual(Math.floor(20 / INTERVAL));
    for (let k = 1; k < spawnTimes.length; k++) {
      expect(spawnTimes[k] - spawnTimes[k - 1]).toBeCloseTo(INTERVAL, 1);
    }
  });

  it('removes an obstacle once it is fully past the left edge, not before', () => {
    let field = createField(1, GROUND, FALCON.startY);
    let lastSeen = Infinity;
    for (let i = 0; i < Math.round(8 / DT); i++) {
      const prev = field.obstacles.find((o) => o.id === 1);
      field = stepField(field, DT);
      const now = field.obstacles.find((o) => o.id === 1);
      if (now) {
        expect(isOffScreen(now)).toBe(false);
        lastSeen = now.x;
      } else if (prev) {
        // Dropped on the step where it went fully past the edge.
        expect(prev.x - OBSTACLES.speed * DT + prev.width).toBeLessThan(0);
        break;
      }
    }
    expect(field.obstacles.some((o) => o.id === 1)).toBe(false);
    expect(lastSeen + OBSTACLES.width).toBeGreaterThanOrEqual(0);
  });

  it('never keeps an obstacle that is fully off screen', () => {
    let field = createField(9, GROUND, FALCON.startY);
    for (let i = 0; i < Math.round(30 / DT); i++) {
      field = stepField(field, DT);
      for (const o of field.obstacles) expect(o.x + o.width).toBeGreaterThanOrEqual(0);
    }
    expect(field.obstacles.length).toBeLessThanOrEqual(3);
  });

  it('mixes towers and palm trees, never more than two of a kind in a row', () => {
    const all = collect(11, 120);
    expect(all.some((o) => o.kind === 'tower')).toBe(true);
    expect(all.some((o) => o.kind === 'palm')).toBe(true);
    for (let k = 2; k < all.length; k++) {
      expect(all[k].kind === all[k - 1].kind && all[k].kind === all[k - 2].kind).toBe(false);
    }
  });

  it('gives the same obstacles for the same seed', () => {
    expect(collect(42, 10)).toEqual(collect(42, 10));
    expect(collect(42, 10).map((o) => o.gapTop)).not.toEqual(collect(43, 10).map((o) => o.gapTop));
  });
});

describe('gaps', () => {
  const range = gapRange(GROUND);

  it('every gap is fully inside the playing area and big enough for the falcon', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const all = collect(seed, 400);
      expect(all.length).toBeGreaterThan(200);
      for (const o of all) {
        expect(o.gapTop).toBeGreaterThanOrEqual(OBSTACLES.minPiece);
        expect(o.gapBottom).toBeLessThanOrEqual(GROUND - OBSTACLES.minPiece);
        expect(o.gapBottom - o.gapTop).toBe(OBSTACLES.gapSize);
        expect(o.gapBottom - o.gapTop).toBeGreaterThan(FALCON.radius * 2 * 4);
      }
    }
  });

  it('gaps are not all at the same height, and each moves a reachable amount from the one before', () => {
    const all = collect(7, 60);
    expect(new Set(all.slice(0, 10).map((o) => o.gapTop)).size).toBeGreaterThan(5);
    for (let k = 1; k < all.length; k++) {
      const shift = Math.abs(all[k].gapTop - all[k - 1].gapTop);
      expect(shift).toBeGreaterThanOrEqual(OBSTACLES.minShift - 1);
      expect(shift).toBeLessThanOrEqual(OBSTACLES.maxShift + 1);
    }
  });

  it('the first gap is around the falcon start height', () => {
    for (let seed = 0; seed < 50; seed++) {
      const top = nextGap(undefined, createRandom(seed), GROUND, FALCON.startY);
      expect(FALCON.startY - top).toBeGreaterThanOrEqual(OBSTACLES.firstGapMargin - 1);
      expect(top + OBSTACLES.gapSize - FALCON.startY).toBeGreaterThanOrEqual(OBSTACLES.firstGapMargin - 1);
    }
  });

  it('nextGap stays in range even from the very top or bottom', () => {
    const rnd = createRandom(5);
    for (let i = 0; i < 500; i++) {
      for (const prev of [range.min, range.max]) {
        const g = nextGap(prev, rnd, GROUND, FALCON.startY);
        expect(g).toBeGreaterThanOrEqual(range.min);
        expect(g).toBeLessThanOrEqual(range.max);
        expect(Math.abs(g - prev)).toBeGreaterThanOrEqual(OBSTACLES.minShift - 1);
      }
    }
  });
});

describe('stepField with a speed', () => {
  it('moves obstacles by speed * dt, and by the starting speed when none is given', () => {
    const field = stepField(createField(1, 749, 403), 0);
    const x = field.obstacles[0].x;
    expect(stepField(field, 0.5, 100).obstacles[0].x).toBeCloseTo(x - 50);
    expect(stepField(field, 0.5).obstacles[0].x).toBeCloseTo(x - OBSTACLES.speed * 0.5);
  });
});
