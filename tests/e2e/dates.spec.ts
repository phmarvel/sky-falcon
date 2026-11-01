import { expect, test, type Page } from '@playwright/test';

/* Like score.spec.ts: everything is measured in game time (falcon.time), never the wall clock. */
test.describe.configure({ timeout: 180_000 });

const FALCON_X = Math.round(540 * 0.3);
const RADIUS = 22;

interface Obstacle {
  id: number;
  x: number;
  width: number;
  gapTop: number;
  gapBottom: number;
  dateX: number;
  dateY: number;
  dateCaught: boolean;
}
interface Frame {
  time: number;
  score: number;
  passed: number;
  dates: number;
  datesDrawn: number;
  obstacles: Obstacle[];
  runOver: boolean;
}

async function openGame(page: Page, query: string) {
  await page.goto(`./?scene=flight&${query}&feather=off`);
  await expect(page.locator('#game canvas').first()).toBeVisible();
  await page.waitForFunction(() => window.__SKY_FALCON__?.registry.get('ready') === true, undefined, {
    timeout: 60_000,
  });
}

/** Steers the falcon at the next date's height until `until` obstacles are passed (or the run ends). */
function play(page: Page, until: number, maxSeconds: number) {
  return page.evaluate(
    ({ until, maxSeconds, falconX, radius }) =>
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
        const tick = () => {
          const f = registry.get('falcon') as { y: number; vy: number; phase: string; time: number };
          const obstacles = (registry.get('obstacles') as Obstacle[]).map((o) => ({ ...o }));
          const frame: Frame = {
            time: f.time,
            score: registry.get('score') as number,
            passed: registry.get('passed') as number,
            dates: registry.get('dates') as number,
            datesDrawn: registry.get('datesDrawn') as number,
            obstacles,
            runOver: registry.get('runOver') as boolean,
          };
          frames.push(frame);
          if (frame.runOver || frame.passed >= until || f.time > maxSeconds) {
            resolve(frames);
            return;
          }
          const next = obstacles.find((o) => o.x + o.width > falconX - radius);
          const target = next ? next.dateY + 20 : 400;
          if (f.phase === 'ready' || (f.y > target && f.vy > -100)) click();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    { until, maxSeconds, falconX: FALCON_X, radius: RADIUS },
  );
}

test('a date floats inside the gap of every obstacle that appears', async ({ page }) => {
  await openGame(page, 'seed=3');
  // The first flap starts the run, and the obstacles come with it.
  await page.locator('#game canvas').first().click({ position: { x: 20, y: 20 } });
  const shown = await page.waitForFunction(
    () => {
      const r = window.__SKY_FALCON__!.registry;
      const obs = r.get('obstacles') as { gapTop: number; gapBottom: number; dateY: number }[];
      return obs.length > 0 && (r.get('datesDrawn') as number) > 0 ? obs : false;
    },
    undefined,
    { timeout: 120_000 },
  );
  const obs = (await shown.jsonValue()) as { gapTop: number; gapBottom: number; dateY: number }[];
  for (const o of obs) {
    expect(o.dateY).toBeGreaterThan(o.gapTop);
    expect(o.dateY).toBeLessThan(o.gapBottom);
  }
});

test('catching dates adds points, each date once, and the date disappears', async ({ page }) => {
  await openGame(page, 'seed=3');
  const frames = await play(page, 4, 120);
  const last = frames.at(-1)!;
  expect(last.runOver).toBe(false);
  expect(last.dates).toBeGreaterThanOrEqual(1);
  for (const f of frames) {
    expect(f.score).toBe(f.passed + f.dates);
    expect(f.dates).toBeLessThanOrEqual(f.obstacles.filter((o) => o.dateCaught).length + 4);
    expect(f.datesDrawn).toBe(f.obstacles.filter((o) => !o.dateCaught).length);
  }
  // The score never goes down, and a date's point is only counted once (dates never exceeds obstacles seen).
  for (let i = 1; i < frames.length; i++) expect(frames[i]!.score).toBeGreaterThanOrEqual(frames[i - 1]!.score);
  expect(last.dates).toBeLessThanOrEqual(last.passed + 1);
});
