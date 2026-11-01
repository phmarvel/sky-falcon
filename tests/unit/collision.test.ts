import { describe, expect, it } from 'vitest';
import { circleHitsCircle, circleHitsRect, falconHitsField, falconTouchesDate, falconTouchesFeather } from '../../src/game/obstacles/collision';
import { DATE, FEATHER, type Obstacle, createField } from '../../src/game/obstacles/obstacleField';
import { SHAPES, obstacleParts } from '../../src/game/obstacles/obstacleShapes';

const rect = { x: 100, y: 100, width: 50, height: 80 };
const GROUND = 749;

describe('circleHitsRect', () => {
  it('touches at an edge', () => {
    expect(circleHitsRect(80, 140, 20, rect)).toBe(true);
    expect(circleHitsRect(170, 140, 20, rect)).toBe(true);
    expect(circleHitsRect(125, 80, 20, rect)).toBe(true);
    expect(circleHitsRect(125, 200, 20, rect)).toBe(true);
  });

  it('just misses next to an edge', () => {
    expect(circleHitsRect(79.5, 140, 20, rect)).toBe(false);
    expect(circleHitsRect(125, 200.5, 20, rect)).toBe(false);
  });

  it('uses the closest point at a corner', () => {
    // 14 px right and 14 px up of the top-right corner: about 19.8 px away.
    expect(circleHitsRect(164, 86, 20, rect)).toBe(true);
    // 15 px each way: about 21.2 px away.
    expect(circleHitsRect(165, 85, 20, rect)).toBe(false);
  });

  it('hits when the circle is fully inside', () => {
    expect(circleHitsRect(125, 140, 5, rect)).toBe(true);
  });

  it('ignores empty rectangles', () => {
    expect(circleHitsRect(125, 140, 20, { ...rect, height: 0 })).toBe(false);
  });
});

describe('obstacleParts', () => {
  it.each(['tower', 'palm'] as const)('a %s fills the column above and below the gap, never inside it', (kind) => {
    const parts = obstacleParts(kind, 84, 200, 430, GROUND);
    for (const p of parts) {
      expect(p.y + p.height <= 200 || p.y >= 430).toBe(true);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.width).toBeLessThanOrEqual(84);
    }
    const top = parts.filter((p) => p.side === 'top');
    const bottom = parts.filter((p) => p.side === 'bottom');
    // No hole: the top piece runs from y = 0 to the gap, the bottom piece from the gap to the ground.
    expect(Math.min(...top.map((p) => p.y))).toBe(0);
    expect(Math.max(...top.map((p) => p.y + p.height))).toBe(200);
    expect(Math.min(...bottom.map((p) => p.y))).toBe(430);
    expect(Math.max(...bottom.map((p) => p.y + p.height))).toBe(GROUND);
    // The gap edges span the full width.
    expect(parts.filter((p) => p.width === 84)).toHaveLength(2);
  });

  it('a palm has a narrow trunk and a wide crown', () => {
    const roles = obstacleParts('palm', 84, 200, 430, GROUND).map((p) => [p.role, p.width]);
    expect(roles).toContainEqual(['trunk', SHAPES.palmTrunkWidth]);
    expect(roles).toContainEqual(['crown', 84]);
  });
});

describe('falconHitsField', () => {
  const obstacle = (kind: Obstacle['kind'], x: number): Obstacle => ({
    id: 1,
    kind,
    x,
    width: 84,
    gapTop: 200,
    gapBottom: 430,
    passed: false,
    date: { y: 100 + 115, caught: false },
  });
  const field = (o: Obstacle) => ({ ...createField(1, GROUND, 400), obstacles: [o] });

  it.each(['tower', 'palm'] as const)('a falcon in the middle of a %s gap does not touch it', (kind) => {
    expect(falconHitsField(162, 315, 22, field(obstacle(kind, 140)))).toBe(false);
  });

  it.each(['tower', 'palm'] as const)('a falcon at the gap edge of a %s touches it', (kind) => {
    expect(falconHitsField(162, 200 + 21, 22, field(obstacle(kind, 140)))).toBe(true);
    expect(falconHitsField(162, 430 - 21, 22, field(obstacle(kind, 140)))).toBe(true);
  });

  it('a falcon flying into the side of a tower touches it', () => {
    expect(falconHitsField(162, 100, 22, field(obstacle('tower', 162 + 22 - 8 - 1)))).toBe(true);
  });

  it('a falcon beside a palm trunk, below the crown, does not touch it', () => {
    // The trunk is narrow: well left of it, under the crown, there is air.
    const o = obstacle('palm', 162 + 22 + 5);
    expect(falconHitsField(162, 600, 22, field(o))).toBe(false);
    expect(falconHitsField(162, 600, 22, field({ ...o, x: 162 + 22 - 36 }))).toBe(true);
  });

  it('nothing far away is touched', () => {
    expect(falconHitsField(162, 100, 22, field(obstacle('tower', 400)))).toBe(false);
  });
});

describe('dates', () => {
  const o = (caught: boolean) => ({
    id: 1,
    kind: 'tower' as const,
    x: 100,
    width: DATE.offsetX * 2,
    gapTop: 100,
    gapBottom: 330,
    passed: false,
    date: { y: 215, caught },
  });
  const dx = 100 + DATE.offsetX;

  it('circleHitsCircle: touching counts, a hair apart does not', () => {
    expect(circleHitsCircle(0, 0, 10, 20, 0, 10)).toBe(true);
    expect(circleHitsCircle(0, 0, 10, 20.01, 0, 10)).toBe(false);
  });

  it('the falcon touches a date it overlaps, not one just out of reach', () => {
    expect(falconTouchesDate(dx - 30, 215, 22, o(false))).toBe(true);
    expect(falconTouchesDate(dx - 38.5, 215, 22, o(false))).toBe(false);
  });

  it('a caught date can not be touched again', () => {
    expect(falconTouchesDate(dx, 215, 22, o(true))).toBe(false);
  });
});

describe('feathers and absorbed hits', () => {
  const o: Obstacle = {
    id: 1,
    kind: 'tower',
    x: 140,
    width: 84,
    gapTop: 200,
    gapBottom: 430,
    passed: false,
    date: { y: 315, caught: true },
    feather: { y: 315, caught: false },
  };

  it('touches a feather only while it is not caught', () => {
    expect(falconTouchesFeather(140 + FEATHER.offsetX, 315, 22, o)).toBe(true);
    expect(falconTouchesFeather(140 + FEATHER.offsetX, 315 + 22 + FEATHER.radius + 1, 22, o)).toBe(false);
    expect(falconTouchesFeather(140 + FEATHER.offsetX, 315, 22, { ...o, feather: { y: 315, caught: true } })).toBe(false);
    expect(falconTouchesFeather(140 + FEATHER.offsetX, 315, 22, { ...o, feather: null })).toBe(false);
  });

  it('an obstacle that took a shielded hit no longer hits', () => {
    const f = { ...createField(1, GROUND, 400), obstacles: [o] };
    expect(falconHitsField(162, 205, 22, f)).toBe(true);
    expect(falconHitsField(162, 205, 22, { ...f, obstacles: [{ ...o, hitAbsorbed: true }] })).toBe(false);
  });
});
