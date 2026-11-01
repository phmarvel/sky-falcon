import { describe, expect, it } from 'vitest';
import { FALCON } from '../../src/game/falcon/falconPhysics';
import { scrollSpeedOf } from '../../src/game/score/speedUp';
import {
  DATE,
  FEATHER,
  OBSTACLES,
  type ObstacleField,
  createField,
  gapRange,
  hasFeather,
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

describe('dates', () => {
  it('every obstacle has an uncaught date inside its gap, in the middle of the obstacle', () => {
    const all = collect(5, 30);
    expect(all.length).toBeGreaterThan(5);
    for (const o of all) {
      // A feather gap holds the feather instead (its date is marked caught so it is never shown).
      expect(o.date.caught).toBe(o.feather != null);
      expect(o.date.y - DATE.radius).toBeGreaterThanOrEqual(o.gapTop);
      expect(o.date.y + DATE.radius).toBeLessThanOrEqual(o.gapBottom);
      expect(DATE.offsetX).toBe(o.width / 2);
    }
  });

  it('adding dates did not change the layout for a seed', () => {
    const a = collect(9, 20).map((o) => [o.kind, o.gapTop]);
    const b = collect(9, 20).map((o) => [o.kind, o.gapTop]);
    expect(a).toEqual(b);
  });
});

describe('feathers', () => {
  const collectMode = (seed: number, seconds: number, mode: 'rare' | 'always' | 'off') => {
    let field = createField(seed, GROUND, FALCON.startY, mode);
    const seen = new Map<number, ObstacleField['obstacles'][number]>();
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      field = stepField(field, DT);
      for (const o of field.obstacles) if (!seen.has(o.id)) seen.set(o.id, o);
    }
    return [...seen.values()];
  };

  it('the same seed gives the same feathers', () => {
    const ids = (seed: number) => collectMode(seed, 60, 'rare').filter((o) => o.feather).map((o) => o.id);
    expect(ids(4)).toEqual(ids(4));
    expect(ids(4).length).toBeGreaterThan(0);
  });

  it('a feather gap has its feather inside the gap and no date; the first gap never has one', () => {
    const all = collectMode(2, 120, 'rare');
    const withFeather = all.filter((o) => o.feather);
    expect(withFeather.length).toBeGreaterThan(0);
    const range = gapRange(GROUND);
    for (const o of withFeather) {
      expect(o.id).toBeGreaterThanOrEqual(FEATHER.minId);
      expect(o.date.caught).toBe(true);
      expect(o.feather!.caught).toBe(false);
      expect(o.feather!.y - FEATHER.radius).toBeGreaterThanOrEqual(o.gapTop);
      expect(o.feather!.y + FEATHER.radius).toBeLessThanOrEqual(o.gapBottom);
      expect(o.gapTop).toBeGreaterThanOrEqual(range.min);
      expect(o.gapTop).toBeLessThanOrEqual(range.max);
      expect(FEATHER.offsetX).toBe(DATE.offsetX);
    }
    for (const o of all.filter((x) => !x.feather)) expect(o.date.caught).toBe(false);
    expect(all.find((o) => o.id === 1)!.feather).toBeFalsy();
  });

  it('feathers are rare and never in two gaps in a row', () => {
    let count = 0;
    let total = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const all = collectMode(seed, 60, 'rare');
      total += all.length;
      all.forEach((o, i) => {
        if (!o.feather) return;
        count++;
        expect(all[i - 1]?.feather).toBeFalsy();
      });
    }
    expect(count / total).toBeGreaterThan(0.05);
    expect(count / total).toBeLessThan(0.3);
  });

  it('feathers do not change the layout: same gaps, kinds and positions as with them off', () => {
    const layout = (mode: 'rare' | 'always' | 'off') =>
      collectMode(7, 40, mode).map((o) => [o.id, o.kind, o.x, o.gapTop, o.gapBottom]);
    expect(layout('rare')).toEqual(layout('off'));
    expect(layout('always')).toEqual(layout('off'));
  });

  it('off gives no feathers and uncaught dates everywhere; always gives one in every gap after the first', () => {
    for (const o of collectMode(3, 40, 'off')) {
      expect(o.feather).toBeFalsy();
      expect(o.date.caught).toBe(false);
    }
    for (const o of collectMode(3, 40, 'always')) expect(!!o.feather).toBe(o.id >= FEATHER.minId);
  });

  it('hasFeather follows the mode', () => {
    expect(hasFeather(1, 5, false, 'off')).toBe(false);
    expect(hasFeather(1, 1, false, 'always')).toBe(false);
    expect(hasFeather(1, 5, true, 'always')).toBe(true);
    expect(hasFeather(1, 5, true, 'rare')).toBe(false);
  });

  it('a feather keeps its place in its obstacle at the start speed and at a sped-up speed', () => {
    for (const speed of [OBSTACLES.speed, scrollSpeedOf(30)]) {
      let field = createField(3, GROUND, FALCON.startY, 'always');
      for (let i = 0; i < 400; i++) field = stepField(field, DT, speed);
      const o = field.obstacles.find((x) => x.feather)!;
      const before = o.x;
      const next = stepField(field, 0.5, speed).obstacles.find((x) => x.id === o.id)!;
      expect(before - next.x).toBeCloseTo(speed * 0.5);
      expect(next.feather!.y).toBe(o.feather!.y);
    }
    expect(scrollSpeedOf(30)).toBeGreaterThan(OBSTACLES.speed);
  });
});
