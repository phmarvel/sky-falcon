import { expect, test, type Page } from '@playwright/test';

interface Falcon {
  y: number;
  vy: number;
  phase: 'ready' | 'flying' | 'down';
  flaps: number;
  groundY: number;
}

const RADIUS = 22;
const START_Y = Math.round(960 * 0.42);

async function openGame(page: Page) {
  await page.goto('./');
  await expect(page.locator('#game canvas')).toBeVisible();
  await page.waitForFunction(() => window.__SKY_FALCON__?.registry.get('ready') === true);
}

function falcon(page: Page): Promise<Falcon> {
  return page.evaluate(() => window.__SKY_FALCON__!.registry.get('falcon') as Falcon);
}

/** The falcon's state on every frame for `ms` milliseconds. */
function sampleFrames(page: Page, ms: number): Promise<Falcon[]> {
  return page.evaluate(
    (duration) =>
      new Promise<Falcon[]>((resolve) => {
        const out: Falcon[] = [];
        const end = performance.now() + duration;
        const tick = () => {
          out.push({ ...(window.__SKY_FALCON__!.registry.get('falcon') as Falcon) });
          if (performance.now() < end) requestAnimationFrame(tick);
          else resolve(out);
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
}

async function clickCanvas(page: Page) {
  await page.locator('#game canvas').click({ position: { x: 40, y: 40 } });
}

/** Starts the run with a click and waits until the falcon is falling. */
async function startAndWaitForFall(page: Page) {
  await clickCanvas(page);
  await expect.poll(async () => (await falcon(page)).vy, { timeout: 5_000 }).toBeGreaterThan(50);
  const f = await falcon(page);
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
  const frames = (await sampleFrames(page, 300)).filter((f) => f.phase === 'flying');
  expect(frames.length).toBeGreaterThan(5);
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
  await expect.poll(async () => (await falcon(page)).flaps).toBe(before.flaps + 1);
  expect((await falcon(page)).vy).toBeLessThan(before.vy);
  const frames = await sampleFrames(page, 120);
  expect(Math.min(...frames.map((f) => f.y))).toBeLessThan(before.y + 60);
});

test('a tap makes the falling falcon flap upwards, once per tap', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, 'Touch screens only');
  await openGame(page);
  await page.locator('#game canvas').tap({ position: { x: 40, y: 40 } });
  await expect.poll(async () => (await falcon(page)).vy, { timeout: 5_000 }).toBeGreaterThan(50);
  const before = await falcon(page);
  expect(before.flaps).toBe(1);
  await page.locator('#game canvas').tap({ position: { x: 40, y: 40 } });
  await expect.poll(async () => (await falcon(page)).flaps).toBe(2);
  expect((await falcon(page)).vy).toBeLessThan(before.vy);
  // No extra flap from the browser's copied mouse events.
  await page.waitForTimeout(300);
  expect((await falcon(page)).flaps).toBe(2);
});

test('the space bar makes the falling falcon flap upwards', async ({ page }) => {
  await openGame(page);
  const before = await startAndWaitForFall(page);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await falcon(page)).flaps).toBe(before.flaps + 1);
  expect((await falcon(page)).vy).toBeLessThan(before.vy);
});

test('holding the space bar flaps only once per press', async ({ page }) => {
  await openGame(page);
  await page.locator('#game canvas').focus();
  // Playwright marks the second and third keydown as auto-repeats.
  await page.keyboard.down('Space');
  await page.keyboard.down('Space');
  await page.keyboard.down('Space');
  await page.waitForTimeout(300);
  expect((await falcon(page)).flaps).toBe(1);
  await page.keyboard.up('Space');
  await page.keyboard.press('Space');
  expect((await falcon(page)).flaps).toBe(2);
});

test('the falcon stays inside the top of the screen when it keeps flapping', async ({ page }) => {
  // Each key press waits for a frame, and frames are slow in headless software rendering.
  test.setTimeout(90_000);
  await openGame(page);
  // Record the lowest y on every frame while the player flaps.
  await page.evaluate(() => {
    const w = window as unknown as { __minY: number; __sampling: boolean };
    w.__minY = Infinity;
    w.__sampling = true;
    const tick = () => {
      const f = window.__SKY_FALCON__!.registry.get('falcon') as { y: number };
      w.__minY = Math.min(w.__minY, f.y);
      if (w.__sampling) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  // Flap until the falcon reaches the top (the speed depends on the machine), then keep flapping there.
  let reachedAt = -1;
  for (let i = 0; i < 80 && (reachedAt < 0 || i < reachedAt + 8); i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(40);
    if (reachedAt < 0 && (await falcon(page)).y < RADIUS + 5) reachedAt = i;
  }
  const minY = await page.evaluate(() => {
    const w = window as unknown as { __minY: number; __sampling: boolean };
    w.__sampling = false;
    return w.__minY;
  });
  expect(reachedAt).toBeGreaterThanOrEqual(0);
  expect(minY).toBeGreaterThanOrEqual(RADIUS);
  // It did reach the top: the screen's edge stopped it.
  expect(minY).toBeLessThan(RADIUS + 5);
  expect((await falcon(page)).phase).toBe('flying');
});

test('touching the ground ends the run and the falcon stops responding', async ({ page }, testInfo) => {
  await openGame(page);
  await clickCanvas(page);
  await expect.poll(async () => (await falcon(page)).phase, { timeout: 5_000 }).toBe('down');
  expect(await page.evaluate(() => window.__SKY_FALCON__!.registry.get('runOver'))).toBe(true);
  const down = await falcon(page);
  expect(down.y).toBe(down.groundY - RADIUS);

  await clickCanvas(page);
  await page.keyboard.press('Space');
  if (testInfo.project.use.hasTouch) await page.locator('#game canvas').tap({ position: { x: 40, y: 40 } });
  await page.waitForTimeout(300);
  expect(await falcon(page)).toEqual(down);
});
