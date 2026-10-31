import type { RunState } from "../run/runState";

/**
 * The score of a run: one point for each obstacle the falcon has fully passed.
 * The one place to add other points to (e.g. dates), so the screen and the registry stay in step.
 */
export function scoreOf(run: Pick<RunState, "passed">): number {
  return run.passed;
}
