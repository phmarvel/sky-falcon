import { expect, test, type Page } from '@playwright/test';

/* Like dates.spec.ts: everything is measured in game time (falcon.time), never the wall clock. */
test.describe.configure({ timeout: 180_000 });

const FALCON_X = Math.round(540 * 0.3);
const RADIUS = 22;
const OBSTACLE_SPEED = 180;

interface Obstacle {
  id: number;
  x: number;
  gapTop: number;
  gapBottom: number;
  dateCaught: boolean;
  featherX: number | null;
  featherY: number | null;
  featherCaught: boolean;
}
interface Frame {
  time: number;
  score: number;
  passed: number;
  dates: number;
  shield: boolean;
  shieldDrawn: boolean;
  feathers: number;
  feathersDrawn: number;
  scrollSpeed: number;
  obstacles: Obstacle[];
  runOver: boolean;
}

async function openGame(page: Page, query: string) {
  await page.goto(`./?scene=flight&${query}`);
  await expect(page.locator('#game canvas').first()).toBeVisible();
  await page.waitForFunction(() => window.__SKY_FALCON__?.registry.get('ready') === true, undefined, {
    timeout: 60_000,
  });
}

/**
 * Steers the falcon at the next gap with real clicks, sampling every frame. `stopAt` says when to stop clicking
 * (the falcon then falls); the loop ends when `done` says so, the run is over or `maxSeconds` of game time passed.
 */
function play(page: Page, mode: 'fly' | 'drop', maxSeconds: number) {
  return page.evaluate(
    ({ mode, maxSeconds, falconX, radius }) =>
      new Promise<Frame[]>((resolve) => {
        const canvas = document.querySelector('#game canvas')!;
        const box = canvas.getBoundingClientRect();
        const at = { clientX: box.left + 20, clientY: box.top + 20, button: 0, bubbles: true };
        const registry = window.__SKY_FALCON__!.registry;
        const frames: Frame[] = [];
        const click = () => {
          canvas.dispatchEvent(new MouseEvent('mousedown', at));
          canvas.dispatchEvent(new MouseEvent('mouseup', at));
        };
        let dropping = false;
        let brokeAt = -1;
        const tick = () => {
          const f = registry.get('falcon') as { y: number; vy: number; phase: string; time: number };
          const frame: Frame = {
            time: f.time,
            score: registry.get('score') as number,
            passed: registry.get('passed') as number,
            dates: registry.get('dates') as number,
            shield: registry.get('shield') as boolean,
            shieldDrawn: registry.get('shieldDrawn') as boolean,
            feathers: registry.get('feathers') as number,
            feathersDrawn: registry.get('feathersDrawn') as number,
            scrollSpeed: registry.get('scrollSpeed') as number,
            obstacles: (registry.get('obstacles') as Obstacle[]).map((o) => ({ ...o })),
            runOver: registry.get('runOver') as boolean,
          };
          frames.push(frame);
          if (frame.shield && mode === 'drop') dropping = true;
          if (dropping && !frame.shield && brokeAt < 0) brokeAt = f.time;
          // In 'fly' mode: stop after a speed-up; in 'drop' mode: stop once the run is over.
          const enough = mode === 'fly' ? frame.score >= 12 : frame.runOver;
          if (frame.runOver || enough || f.time > maxSeconds) {
            resolve(frames);
            return;
          }
          const next = frame.obstacles.find((o) => o.x + 84 > falconX - radius);
          const target = next ? next.gapTop + 230 * 0.62 : 400;
          // Once the shield is up in 'drop' mode the player stops flapping, so the falcon falls into the sand.
          if (!dropping && (f.phase === 'ready' || (f.y > target && f.vy > -100))) click();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    { mode, maxSeconds, falconX: FALCON_X, radius: RADIUS },
  );
}

test('a golden feather floats in a gap instead of the date, is caught, and glows on the falcon', async ({ page }) => {
  await openGame(page, 'seed=3&feather=always');
  const frames = await play(page, 'fly', 120);
  const withFeather = frames.flatMap((f) => f.obstacles.filter((o) => o.featherY !== null));
  expect(withFeather.length).toBeGreaterThan(0);
  for (const o of withFeather) {
    expect(o.featherY!).toBeGreaterThan(o.gapTop);
    expect(o.featherY!).toBeLessThan(o.gapBottom);
    // Never on top of a date: the date of a feather gap is gone.
    expect(o.dateCaught).toBe(true);
  }
  expect(frames.some((f) => f.feathersDrawn > 0)).toBe(true);
  const caught = frames.find((f) => f.shield);
  expect(caught).toBeDefined();
  expect(caught!.feathers).toBeGreaterThanOrEqual(1);
  for (const f of frames) {
    // The glow is shown exactly while the shield is up, and feathers never add points.
    expect(f.shieldDrawn).toBe(f.shield);
    expect(f.score).toBe(f.passed + f.dates);
  }
  // The feather moves with its obstacle: the same offset in every frame.
  for (const f of frames) {
    for (const o of f.obstacles) if (o.featherX !== null) expect(o.featherX - o.x).toBeCloseTo(42, 3);
  }
  // After the speed-ups the world (and so the feather) moves faster than at the start.
  const last = frames.at(-1)!;
  expect(last.runOver).toBe(false);
  expect(last.scrollSpeed).toBeGreaterThan(OBSTACLE_SPEED);
});

test('the shield takes one hit; the hit after that ends the run', async ({ page }) => {
  await openGame(page, 'seed=3&feather=always');
  const frames = await play(page, 'drop', 120);
  const shieldAt = frames.findIndex((f) => f.shield);
  expect(shieldAt).toBeGreaterThanOrEqual(0);
  const brokeAt = frames.findIndex((f, i) => i > shieldAt && !f.shield);
  expect(brokeAt).toBeGreaterThan(shieldAt);
  // The shield broke, the glow went, and the run was still going.
  expect(frames[brokeAt]!.shieldDrawn).toBe(false);
  expect(frames[brokeAt]!.runOver).toBe(false);
  // Not flapping, the next hit ends the run.
  expect(frames.at(-1)!.runOver).toBe(true);
});
