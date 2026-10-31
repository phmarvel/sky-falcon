import { describe, expect, it } from 'vitest';
import { FALCON, STEP_SECONDS, createFalcon, crash, flap } from '../../src/game/falcon/falconPhysics';
import { OBSTACLES, type Obstacle } from '../../src/game/obstacles/obstacleField';
import { scoreOf } from '../../src/game/score/runScore';
import { SPEED_UP, scrollSpeedOf } from '../../src/game/score/speedUp';
import { autopilotWantsFlap } from '../../src/game/run/autopilot';
import { type RunState, advanceRun, createRun, parseRunOptions, stepRun } from '../../src/game/run/runState';

const bounds = { top: 0, groundY: 749 };

function started(seed = 1, obstacles = true): RunState {
  const run = createRun(createFalcon(), bounds, seed, obstacles);
  return { ...run, falcon: flap(run.falcon) };
}

/** A run with one obstacle placed by hand, with the falcon flying level at `y`. */
function withObstacle(o: Partial<Obstacle>, y: number): RunState {
  const run = started();
  const obstacle: Obstacle = {
    id: 1,
    kind: 'tower',
    x: 300,
    width: OBSTACLES.width,
    gapTop: 250,
    gapBottom: 250 + OBSTACLES.gapSize,
    passed: false,
    ...o,
  };
  return {
    ...run,
    falcon: { ...run.falcon, y, vy: 0 },
    field: { ...run.field!, obstacles: [obstacle], lastGapTop: obstacle.gapTop, nextId: 2 },
  };
}

/** Flies a level falcon: holds `y` by resetting its speed each step, as a perfect player would. */
function flyLevel(run: RunState, y: number, seconds: number): RunState {
  for (let i = 0; i < Math.round(seconds / STEP_SECONDS); i++) {
    run = stepRun({ ...run, falcon: { ...run.falcon, y, vy: 0 } }, STEP_SECONDS, bounds);
    if (run.over) break;
  }
  return run;
}

describe('stepRun', () => {
  it('does nothing before the first flap', () => {
    const run = createRun(createFalcon(), bounds, 1);
    expect(advanceRun(run, 100, bounds)).toBe(run);
  });

  it('a falcon flying through the middle of the gap passes, and the run goes on', () => {
    const run = flyLevel(withObstacle({}, 250 + OBSTACLES.gapSize / 2), 250 + OBSTACLES.gapSize / 2, 3);
    expect(run.over).toBeNull();
    expect(run.passed).toBe(1);
    expect(run.field!.obstacles.find((o) => o.id === 1)?.passed ?? true).toBe(true);
  });

  it.each(['tower', 'palm'] as const)('touching a %s ends the run at once', (kind) => {
    // Level with the full-width part at the gap edge (the tower's cap, the palm's crown).
    const run = flyLevel(withObstacle({ kind }, 240), 240, 3);
    expect(run.over).toBe('obstacle');
    expect(run.falcon.phase).toBe('down');
    // It ended when the falcon met the obstacle's side, not later.
    const o = run.field!.obstacles.find((x) => x.id === 1)!;
    expect(o.x).toBeLessThanOrEqual(FALCON.x + FALCON.radius);
    expect(o.x).toBeGreaterThan(FALCON.x + FALCON.radius - OBSTACLES.speed * STEP_SECONDS - 1e-6);
  });

  it('a falcon beside a palm trunk is not touched until the trunk itself reaches it', () => {
    const run = flyLevel(withObstacle({ kind: 'palm' }, 120), 120, 3);
    expect(run.over).toBe('obstacle');
    const o = run.field!.obstacles.find((x) => x.id === 1)!;
    // The trunk starts (84 - 26) / 2 = 29 px in from the obstacle's left edge.
    expect(o.x + 29).toBeLessThanOrEqual(FALCON.x + FALCON.radius);
    expect(o.x + 29).toBeGreaterThan(FALCON.x + FALCON.radius - OBSTACLES.speed * STEP_SECONDS - 1e-6);
  });

  it('a hit inside one long frame is still caught, and the run stops there', () => {
    // Placed so the falcon meets the tower's side 50 ms into a 100 ms frame.
    let run = withObstacle({ x: FALCON.x + FALCON.radius + 9 }, 150);
    run = advanceRun(run, 100, bounds);
    expect(run.over).toBe('obstacle');
    const after = advanceRun(run, 100, bounds);
    expect(after).toBe(run);
  });

  it('touching the ground still ends the run with reason ground', () => {
    let run = started(1, false);
    for (let i = 0; i < 100 && !run.over; i++) run = advanceRun(run, 50, bounds);
    expect(run.over).toBe('ground');
    expect(run.falcon.y).toBe(bounds.groundY - FALCON.radius);
  });

  it('without obstacles, the run has no field', () => {
    const run = advanceRun(started(1, false), 100, bounds);
    expect(run.field).toBeNull();
    expect(run.over).toBeNull();
  });

  it('crash stops the falcon where it is', () => {
    const f = crash({ ...createFalcon(300), phase: 'flying', vy: 200 });
    expect(f).toMatchObject({ y: 300, vy: 0, phase: 'down' });
    expect(flap(f)).toBe(f);
  });
});

describe('passed (the score)', () => {
  it('starts at 0, also without obstacles', () => {
    expect(createRun(createFalcon(), bounds, 1).passed).toBe(0);
    expect(flyLevel(started(1, false), 400, 3).passed).toBe(0);
  });

  it('adds one only once the obstacle is fully behind the falcon, and only once', () => {
    let run = withObstacle({ x: 300 }, 250 + OBSTACLES.gapSize / 2);
    const y = run.falcon.y;
    let top = 0;
    for (let i = 0; i < 120 * 3 && !run.over; i++) {
      run = stepRun({ ...run, falcon: { ...run.falcon, y, vy: 0 } }, STEP_SECONDS, bounds);
      const o = run.field!.obstacles.find((x) => x.id === 1);
      if (o && o.x + o.width >= FALCON.x - FALCON.radius) expect(run.passed).toBe(0);
      top = Math.max(top, run.passed);
    }
    expect(run.over).toBeNull();
    expect(top).toBe(1);
    expect(run.passed).toBe(1);
  });

  it('counts 1, 2 and 3 for an autopilot flying past obstacles one by one', () => {
    for (const target of [1, 2, 3]) {
      let run = started(3);
      for (let i = 0; i < 120 * 600 && !run.over && run.passed < target; i++) {
        if (autopilotWantsFlap(run)) run = { ...run, falcon: flap(run.falcon) };
        const before = run.passed;
        run = stepRun(run, STEP_SECONDS, bounds);
        expect(run.passed - before).toBeLessThanOrEqual(1);
      }
      expect(run.over).toBeNull();
      expect(run.passed).toBe(target);
    }
  });

  it('gives no point for the obstacle that is touched', () => {
    const run = flyLevel(withObstacle({ x: 150 }, 100), 100, 2);
    expect(run.over).toBe('obstacle');
    expect(run.passed).toBe(0);
  });

  it('a hit on the same step adds no point', () => {
    // One obstacle just behind the falcon's back edge, another being hit by the falcon.
    const run = withObstacle({ x: 300 }, 600);
    const edge = FALCON.x - FALCON.radius;
    const done: Obstacle = { ...run.field!.obstacles[0]!, id: 5, x: edge - OBSTACLES.width + 0.5, passed: false };
    const hit: Obstacle = { ...done, id: 6, x: FALCON.x - 10, gapTop: 100, gapBottom: 100 + OBSTACLES.gapSize };
    const next = stepRun({ ...run, field: { ...run.field!, obstacles: [done, hit] } }, STEP_SECONDS, bounds);
    expect(next.over).toBe('obstacle');
    expect(next.passed).toBe(0);
  });

  it('a finished run keeps its score', () => {
    const over = flyLevel(withObstacle({ x: 150 }, 100), 100, 2);
    expect(stepRun(over, STEP_SECONDS, bounds)).toBe(over);
    expect(advanceRun(over, 500, bounds).passed).toBe(over.passed);
  });

  it('touching the ground adds nothing', () => {
    let run = started(2);
    for (let i = 0; i < 120 * 5 && !run.over; i++) run = stepRun(run, STEP_SECONDS, bounds);
    expect(run.over).toBe('ground');
    expect(run.passed).toBe(0);
  });
});

describe('every gap is reachable', () => {
  /** The simple player of the demo mode, deciding once per frame of `frameMs`. */
  function autopilot(seed: number, obstaclesToPass: number, frameMs = 1000 / 60) {
    let run = started(seed);
    let frames = 0;
    while (!run.over && run.passed < obstaclesToPass && frames < 120 * 600) {
      if (autopilotWantsFlap(run)) run = { ...run, falcon: flap(run.falcon) };
      run = advanceRun(run, frameMs, bounds);
      frames++;
    }
    return run;
  }

  it.each([1, 2, 3, 7, 42, 99, 1234, 98765])('a simple player passes 50 obstacles in a row (seed %i)', (seed) => {
    const run = autopilot(seed, 50);
    expect(run.over).toBeNull();
    expect(run.passed).toBeGreaterThanOrEqual(50);
  });

  it.each([1, 7, 42])('it still passes them on a slow device, deciding only every 50 ms (seed %i)', (seed) => {
    const run = autopilot(seed, 30, 50);
    expect(run.over).toBeNull();
    expect(run.passed).toBeGreaterThanOrEqual(30);
  });
});

describe('speeding up', () => {
  /** How far a lone obstacle moves in one step when the run has `passed` points. */
  function moved(passed: number): number {
    const run = { ...withObstacle({ x: 400 }, 300), passed };
    const next = stepRun(run, STEP_SECONDS, bounds);
    return 400 - next.field!.obstacles[0].x;
  }

  it('moves at the starting speed below 10 points and a little faster from 10', () => {
    expect(moved(0)).toBeCloseTo(OBSTACLES.speed * STEP_SECONDS);
    expect(moved(9)).toBeCloseTo(moved(0));
    expect(moved(10)).toBeCloseTo(moved(0) * (1 + SPEED_UP.step));
    expect(moved(19)).toBeCloseTo(moved(10));
    expect(moved(20)).toBeCloseTo(moved(0) * (1 + 2 * SPEED_UP.step));
  });

  it('a score of 11 is as fast as 10 (one step)', () => {
    expect(moved(11)).toBeCloseTo(moved(10));
  });

  it('a new run is back at the starting speed', () => {
    const fresh = createRun(createFalcon(), bounds, 1);
    expect(fresh.passed).toBe(0);
    expect(scrollSpeedOf(scoreOf(fresh))).toBe(OBSTACLES.speed);
  });

  it('a simple player still passes 40 obstacles at the fastest speed (seeds 1, 7, 42, 99)', () => {
    for (const seed of [1, 7, 42, 99]) {
      let run = started(seed);
      run = { ...run, passed: SPEED_UP.every * SPEED_UP.maxLevel };
      const goal = run.passed + 40;
      for (let i = 0; !run.over && run.passed < goal && i < 120 * 600; i++) {
        if (autopilotWantsFlap(run)) run = { ...run, falcon: flap(run.falcon) };
        run = advanceRun(run, 1000 / 60, bounds);
      }
      expect(run.over).toBeNull();
      expect(run.passed).toBeGreaterThanOrEqual(goal);
    }
  });
});

describe('parseRunOptions', () => {
  it('reads the seed and the obstacles switch from the address', () => {
    expect(parseRunOptions('')).toEqual({ obstacles: true, seed: undefined, autopilot: false });
    expect(parseRunOptions('?seed=7&autopilot=1')).toEqual({ obstacles: true, seed: 7, autopilot: true });
    expect(parseRunOptions('?obstacles=off&seed=abc')).toEqual({ obstacles: false, seed: undefined, autopilot: false });
  });
});
