import { expect, test, type Page } from '@playwright/test';

interface Falcon {
  y: number;
  vy: number;
  phase: 'ready' | 'flying' | 'down';
  flaps: number;
  /** Game seconds flown. */
  time: number;
  groundY: number;
}

const RADIUS = 22;
const START_Y = Math.round(960 * 0.42);

/*
 * Slow browsers (CI draws only a few frames a second) run the game slower than real time, because each frame counts
 * for at most 100 ms of game time. So these tests never limit a wait in wall-clock time: they wait on the falcon's state
 * and limit it in game time (`Falcon.time`), with a long test timeout as the only wall-clock guard.
 * E2E_CPU_THROTTLE=6 slows the browser's CPU (Chromium) to check this locally.
 */
test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page, browserName }) => {
  const rate = Number(process.env.E2E_CPU_THROTTLE ?? 0);
  if (rate > 1 && browserName === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  }
});

/**
 * Opens the flight directly (`?scene=flight`, skipping the start screen). These tests are about the falcon alone, so
 * they fly without obstacles (`obstacles=off`): none can end a run early.
 */
async function openGame(page: Page, query = 'obstacles=off') {
  await page.goto(`./?scene=flight&${query}`);
  await expect(page.locator('#game canvas')).toBeVisible();
  await page.waitForFunction(() => window.__SKY_FALCON__?.registry.get('ready') === true, undefined, {
    timeout: 60_000,
  });
}

function falcon(page: Page): Promise<Falcon> {
  return page.evaluate(() => ({ ...(window.__SKY_FALCON__!.registry.get('falcon') as Falcon) }));
}

type Goal = 'falling' | 'down' | 'nearTop';

/**
 * Waits, frame by frame, until the falcon reaches `goal`, or until it has flown `maxGameSeconds` more game time.
 * Returns whether the goal was reached and the falcon's state at that moment.
 */
async function waitForFalcon(page: Page, goal: Goal, maxGameSeconds: number) {
  const handle = await page.waitForFunction(
    ({ goal, maxGameSeconds, radius }) => {
      const w = window as unknown as { __waitStart?: number };
      const f = window.__SKY_FALCON__!.registry.get('falcon') as Falcon;
      w.__waitStart ??= f.time;
      const reached =
        (goal === 'falling' && f.phase === 'flying' && f.vy > 50) ||
        (goal === 'down' && f.phase === 'down') ||
        (goal === 'nearTop' && f.y < radius + 5);
      const outOfTime = f.time - w.__waitStart > maxGameSeconds;
      if (!reached && !outOfTime) return false;
      w.__waitStart = undefined;
      return { reached, falcon: { ...f } };
    },
    { goal, maxGameSeconds, radius: RADIUS },
    { polling: 'raf', timeout: 0 },
  );
  return (await handle.jsonValue()) as { reached: boolean; falcon: Falcon };
}

/** The falcon's state on each game frame for `gameSeconds` of game time (or until it stops flying). */
function sampleGameTime(page: Page, gameSeconds: number): Promise<Falcon[]> {
  return page.evaluate(
    (duration) =>
      new Promise<Falcon[]>((resolve) => {
        const out: Falcon[] = [];
        const read = () => ({ ...(window.__SKY_FALCON__!.registry.get('falcon') as Falcon) });
        const start = read().time;
        const tick = () => {
          const f = read();
          if (out.at(-1)?.time !== f.time) out.push(f);
          if (f.phase === 'flying' && f.time - start < duration) requestAnimationFrame(tick);
          else resolve(out);
        };
        requestAnimationFrame(tick);
      }),
    gameSeconds,
  );
}

async function clickCanvas(page: Page) {
  await page.locator('#game canvas').click({ position: { x: 40, y: 40 } });
}

/** Starts the run with a click and waits until the falcon is falling (it climbs for about 0.3 s of game time). */
async function startAndWaitForFall(page: Page) {
  await clickCanvas(page);
  const { reached, falcon: f } = await waitForFalcon(page, 'falling', 1);
  expect(reached).toBe(true);
  expect(f.phase).toBe('flying');
  return f;
}

test('the falcon is drawn and waits in the air until the first flap', async ({ page }) => {
  await openGame(page);
  const first = await falcon(page);
  expect(first.phase).toBe('ready');
  expect(first.flaps).toBe(0);
  await page.waitForTimeout(1000);
  const later = await falcon(page);
  expect(later.phase).toBe('ready');
  expect(later.y).toBe(first.y);
  expect(Math.abs(later.y - START_Y)).toBeLessThan(2);

  // The falcon's brown body covers the sky where it hovers.
  const box = (await page.locator('#game canvas').boundingBox())!;
  const shot = await page.screenshot({
    clip: { x: box.x + box.width * (162 / 540), y: box.y + box.height * (START_Y / 960), width: 1, height: 1 },
  });
  const color = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b };
  }, shot.toString('base64'));
  expect(color.r).toBeGreaterThan(color.b);
});

test('with no input the falcon falls faster and faster', async ({ page }) => {
  await openGame(page);
  await startAndWaitForFall(page);
  const frames = (await sampleGameTime(page, 0.4)).filter((f) => f.phase === 'flying');
  // Each frame is at most 0.1 s of game time, so even a slow browser gives several samples.
  expect(frames.length).toBeGreaterThanOrEqual(3);
  const first = frames[0]!;
  const last = frames.at(-1)!;
  expect(last.vy).toBeGreaterThan(first.vy);
  expect(last.y).toBeGreaterThan(first.y);
  for (let i = 1; i < frames.length; i++) expect(frames[i]!.vy).toBeGreaterThanOrEqual(frames[i - 1]!.vy);
});

test('a mouse click makes the falling falcon flap upwards', async ({ page }) => {
  await openGame(page);
  const before = await startAndWaitForFall(page);
  await clickCanvas(page);
  await expect.poll(async () => (await falcon(page)).flaps, { timeout: 30_000 }).toBe(before.flaps + 1);
  expect((await falcon(page)).vy).toBeLessThan(before.vy);
  const frames = await sampleGameTime(page, 0.2);
  expect(Math.min(...frames.map((f) => f.y))).toBeLessThan(before.y + 60);
});

test('a tap makes the falling falcon flap upwards, once per tap', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, 'Touch screens only');
  await openGame(page);
  await page.locator('#game canvas').tap({ position: { x: 40, y: 40 } });
  const { reached, falcon: before } = await waitForFalcon(page, 'falling', 1);
  expect(reached).toBe(true);
  expect(before.flaps).toBe(1);
  await page.locator('#game canvas').tap({ position: { x: 40, y: 40 } });
  await expect.poll(async () => (await falcon(page)).flaps, { timeout: 30_000 }).toBe(2);
  expect((await falcon(page)).vy).toBeLessThan(before.vy);
  // No extra flap from the browser's copied mouse events.
  await page.waitForTimeout(300);
  expect((await falcon(page)).flaps).toBe(2);
});

test('the space bar makes the falling falcon flap upwards', async ({ page }) => {
  await openGame(page);
  const before = await startAndWaitForFall(page);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await falcon(page)).flaps, { timeout: 30_000 }).toBe(before.flaps + 1);
  expect((await falcon(page)).vy).toBeLessThan(before.vy);
});

test('holding the space bar flaps only once per press', async ({ page }) => {
  await openGame(page);
  await page.locator('#game canvas').focus();
  // Playwright marks the second and third keydown as auto-repeats.
  await page.keyboard.down('Space');
  await page.keyboard.down('Space');
  await page.keyboard.down('Space');
  await expect.poll(async () => (await falcon(page)).flaps, { timeout: 30_000 }).toBe(1);
  await page.waitForTimeout(300);
  expect((await falcon(page)).flaps).toBe(1);
  await page.keyboard.up('Space');
  await page.keyboard.press('Space');
  await expect.poll(async () => (await falcon(page)).flaps, { timeout: 30_000 }).toBe(2);
});

test('the falcon stays inside the top of the screen when it keeps flapping', async ({ page }) => {
  await openGame(page);
  // The player keeps flapping: a mouse click on the canvas on every game frame where the falcon is not climbing,
  // until it has spent 1 s of game time at the top. Clicking from inside the page keys the flaps to the game's own
  // frames, so a slow browser can't let it fall to the ground between flaps. (Real clicks, taps and keys are
  // tested above.)
  const result = await page.evaluate(
    ({ radius }) =>
      new Promise<{ minY: number; reachedTop: boolean; alwaysFlying: boolean; flaps: number }>((resolve) => {
        const canvas = document.querySelector('#game canvas')!;
        const box = canvas.getBoundingClientRect();
        const at = { clientX: box.left + 20, clientY: box.top + 20, button: 0, bubbles: true };
        const read = () => window.__SKY_FALCON__!.registry.get('falcon') as Falcon;
        let minY = Infinity;
        let topSince: number | undefined;
        let alwaysFlying = true;
        let frames = 0;
        const tick = () => {
          const f = read();
          frames++;
          if (f.flaps > 0) {
            minY = Math.min(minY, f.y);
            if (f.phase !== 'flying') alwaysFlying = false;
            if (topSince === undefined && f.y < radius + 5) topSince = f.time;
          }
          const done = !alwaysFlying || (topSince !== undefined && f.time - topSince > 1) || frames > 3000;
          if (done) {
            resolve({ minY, reachedTop: topSince !== undefined, alwaysFlying, flaps: read().flaps });
            return;
          }
          if (f.phase === 'ready' || f.vy >= 0) {
            canvas.dispatchEvent(new MouseEvent('mousedown', at));
            canvas.dispatchEvent(new MouseEvent('mouseup', at));
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    { radius: RADIUS },
  );
  expect(result.flaps).toBeGreaterThan(3);
  expect(result.alwaysFlying).toBe(true);
  expect(result.reachedTop).toBe(true);
  const minY = result.minY;
  expect(minY).toBeGreaterThanOrEqual(RADIUS);
  // It did reach the top: the screen's edge stopped it.
  expect(minY).toBeLessThan(RADIUS + 5);
});

test('touching the ground ends the run and the falcon stops responding', async ({ page }, testInfo) => {
  await openGame(page);
  await clickCanvas(page);
  // A fall from the start takes about 1 s of game time.
  const { reached } = await waitForFalcon(page, 'down', 3);
  expect(reached).toBe(true);
  expect(await page.evaluate(() => window.__SKY_FALCON__!.registry.get('runOver'))).toBe(true);
  const down = await falcon(page);
  expect(down.y).toBe(down.groundY - RADIUS);

  await clickCanvas(page);
  await page.keyboard.press('Space');
  if (testInfo.project.use.hasTouch) await page.locator('#game canvas').tap({ position: { x: 40, y: 40 } });
  await page.waitForTimeout(300);
  expect(await falcon(page)).toEqual(down);
});
