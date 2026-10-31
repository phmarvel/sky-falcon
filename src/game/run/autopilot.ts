import { FALCON } from '../falcon/falconPhysics';
import { OBSTACLES } from '../obstacles/obstacleField';
import type { RunState } from './runState';

/**
 * A simple player, for the demo mode (`?autopilot=1`, used for screenshots) and to check that every gap can be reached.
 * Pure: says whether to flap now. It aims a little below the middle of the next gap and flaps whenever the falcon is
 * below that height and not already climbing.
 */
export function autopilotWantsFlap(run: RunState): boolean {
  if (run.over) return false;
  if (run.falcon.phase === 'ready') return true;
  const next = run.field?.obstacles.find((o) => o.x + o.width > FALCON.x - FALCON.radius);
  const target = next ? next.gapTop + OBSTACLES.gapSize * 0.62 : FALCON.startY;
  return run.falcon.y > target && run.falcon.vy > -100;
}
