import type { RunState } from '../run/runState';

/**
 * The score of a run: one point for each obstacle the falcon has fully passed plus one for each date caught.
 * The one place to add other points to, so the screen and the registry stay in step.
 */
export function scoreOf(run: Pick<RunState, 'passed' | 'dates'>): number {
  return run.passed + run.dates;
}
