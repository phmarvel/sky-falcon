import type { ObstacleField } from './obstacleField';
import { type Rect, obstacleParts } from './obstacleShapes';

/** Whether a circle touches (or overlaps) a rectangle: the closest point of the rectangle is within the radius. */
export function circleHitsRect(cx: number, cy: number, r: number, rect: Rect): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false;
  const nx = Math.min(Math.max(cx, rect.x), rect.x + rect.width);
  const ny = Math.min(Math.max(cy, rect.y), rect.y + rect.height);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

/** Whether the falcon (a circle at `cx`, `cy`) touches any part of any obstacle in the field. */
export function falconHitsField(cx: number, cy: number, r: number, field: ObstacleField): boolean {
  for (const o of field.obstacles) {
    // Quick reject: the falcon is nowhere near this obstacle horizontally.
    if (cx + r < o.x || cx - r > o.x + o.width) continue;
    for (const part of obstacleParts(o.kind, o.width, o.gapTop, o.gapBottom, field.groundY)) {
      if (circleHitsRect(cx, cy, r, { ...part, x: part.x + o.x })) return true;
    }
  }
  return false;
}
