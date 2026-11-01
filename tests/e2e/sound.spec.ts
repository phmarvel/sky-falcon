import { expect, test, type Page } from '@playwright/test';

/* Sounds are counted in the registry (soundCount, soundCounts, lastSound), so headless browsers need no audio.
   Waits use the registry / game time, never the wall clock. */
test.describe.configure({ timeout: 180_000 });

interface Ui {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}
interface Counts {
  flap: number;
  point: number;
  date: number;
  hit: number;
}

async function open(page: Page, search: string, muted?: boolean) {
  if (muted !== undefined) await page.addInitScript((v) => localStorage.setItem('skyFalcon.muted', v), muted ? '1' : '0');
  await page.goto(`./${search}`);
  await expect(page.locator('#game canvas').first()).toBeVisible();
  await page.waitForFunction(() => window.__SKY_FALCON__?.registry.get('ready') === true, undefined, { timeout: 60_000 });
}

const reg = <T>(page: Page, key: string) => page.evaluate((k) => window.__SKY_FALCON__!.registry.get(k) as T, key);

async function point(page: Page, ui: Ui) {
  const box = (await page.locator('#game canvas').first().boundingBox())!;
  return { x: box.x + (ui.x / 540) * box.width, y: box.y + (ui.y / 960) * box.height, box };
}

async function clickMute(page: Page) {
  const { x, y } = await point(page, (await reg<Ui>(page, 'muteUi'))!);
  await page.mouse.click(x, y);
}

async function flapByClick(page: Page) {
  const { box } = await point(page, { x: 0, y: 0, width: 0, height: 0 });
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test('the mute button and the M key switch sound off and on, and the choice survives a reload', async ({ page }) => {
  await open(page, '?scene=start');
  expect(await reg(page, 'muted')).toBe(false);
  expect((await reg<Ui>(page, 'muteUi')).label).toBe('Sound off');
  await clickMute(page);
  expect(await reg(page, 'muted')).toBe(true);
  expect((await reg<Ui>(page, 'muteUi')).label).toBe('Sound on');
  expect(await reg(page, 'screen')).toBe('start');
  expect(await page.evaluate(() => localStorage.getItem('skyFalcon.muted'))).toBe('1');

  await page.reload();
  await page.waitForFunction(() => window.__SKY_FALCON__?.registry.get('ready') === true, undefined, { timeout: 60_000 });
  expect(await reg(page, 'muted')).toBe(true);

  await page.keyboard.press('m');
  await page.waitForFunction(() => window.__SKY_FALCON__?.registry.get('muted') === false);
  expect(await page.evaluate(() => localStorage.getItem('skyFalcon.muted'))).toBe('0');
  await page.keyboard.press('m');
  await page.waitForFunction(() => window.__SKY_FALCON__?.registry.get('muted') === true);
});

test('muted: nothing is counted on the flight screen; unmuted: a flap is', async ({ page }) => {
  await open(page, '?scene=flight&obstacles=off', true);
  expect(await reg(page, 'muted')).toBe(true);
  await flapByClick(page);
  await page.waitForFunction(() => (window.__SKY_FALCON__!.registry.get('falcon') as { flaps: number }).flaps >= 1);
  expect(await reg(page, 'soundCount')).toBe(0);

  await page.keyboard.press('m');
  await page.waitForFunction(() => window.__SKY_FALCON__?.registry.get('muted') === false);
  await flapByClick(page);
  await page.waitForFunction(() => (window.__SKY_FALCON__!.registry.get('soundCount') as number) >= 1);
  expect(await reg(page, 'lastSound')).toBe('flap');
});

test('tapping the mute button on the flight screen does not flap', async ({ page }) => {
  await open(page, '?scene=flight&obstacles=off');
  await clickMute(page);
  expect(await reg(page, 'muted')).toBe(true);
  const f = await reg<{ flaps: number; phase: string }>(page, 'falcon');
  expect(f.flaps).toBe(0);
  expect(f.phase).toBe('ready');
});

test('hitting the sand plays the hit sound once', async ({ page }) => {
  await open(page, '?scene=flight&obstacles=off');
  await flapByClick(page);
  await page.waitForFunction(() => window.__SKY_FALCON__?.registry.get('runOver') === true, undefined, { timeout: 120_000 });
  const c = await reg<Counts>(page, 'soundCounts');
  expect(c.hit).toBe(1);
  expect(await reg(page, 'lastSound')).toBe('hit');
});

test('passing obstacles and catching dates play their own sounds', async ({ page }) => {
  await open(page, '?scene=flight&seed=3&autopilot=1');
  await page.waitForFunction(
    () => {
      const r = window.__SKY_FALCON__!.registry;
      return r.get('runOver') === true || ((r.get('dates') as number) >= 1 && (r.get('passed') as number) >= 2);
    },
    undefined,
    { timeout: 150_000 },
  );
  const s = await page.evaluate(() => {
    const r = window.__SKY_FALCON__!.registry;
    return { c: r.get('soundCounts') as Counts, passed: r.get('passed') as number, dates: r.get('dates') as number };
  });
  expect(s.c.point).toBe(s.passed);
  expect(s.c.date).toBe(s.dates);
  expect(s.c.flap).toBeGreaterThan(0);
  expect(s.passed).toBeGreaterThanOrEqual(1);
});

test('the game works when the audio context cannot be made', async ({ page }) => {
  await page.addInitScript(() => {
    class Broken {
      constructor() {
        throw new Error('audio blocked');
      }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = Broken;
    (window as unknown as { webkitAudioContext: unknown }).webkitAudioContext = Broken;
  });
  await open(page, '?scene=flight&obstacles=off');
  await flapByClick(page);
  await page.waitForFunction(() => window.__SKY_FALCON__?.registry.get('runOver') === true, undefined, { timeout: 120_000 });
  expect((await reg<Counts>(page, 'soundCounts')).flap).toBeGreaterThanOrEqual(1);
});

test('in Arabic the button sits in the mirrored corner, with an Arabic label', async ({ page }) => {
  await open(page, '?scene=start&lang=en');
  const en = await reg<Ui>(page, 'muteUi');
  expect(en.x).toBeLessThan(270);
  await open(page, '?scene=start&lang=ar');
  const ar = await reg<Ui>(page, 'muteUi');
  expect(ar.x).toBeGreaterThan(270);
  expect(ar.label).toBe('كتم الصوت');
  // It does not overlap the language switch.
  const sw = await reg<Ui>(page, 'langUi');
  expect(Math.abs(ar.x - sw.x)).toBeGreaterThan((ar.width + sw.width) / 2);

  await open(page, '?scene=flight&obstacles=off&lang=ar');
  expect((await reg<Ui>(page, 'muteUi')).x).toBeLessThan(270);
  await open(page, '?scene=flight&obstacles=off&lang=en');
  expect((await reg<Ui>(page, 'muteUi')).x).toBeGreaterThan(270);
});
