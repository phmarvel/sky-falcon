import type { RunState } from '../run/runState';

/** The score of a run: one point for each obstacle passed (dates will add more). */
export function scoreOf(run: Pick<RunState, 'passed'>): number {
  return run.passed;
}
