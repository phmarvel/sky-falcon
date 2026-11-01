import { expect, test, type Page } from '@playwright/test';

/* Pause: the run freezes (falcon, obstacles, score, sounds) and resumes after a 3-2-1 countdown. Waits use the
   registry and game time (falcon.time) or a number of frames, never the wall clock. The run plays itself
   (autopilot) so it stays alive while the tests look at it. */
test.describe.configure({ timeout: 180_000 });

interface Ui {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface Snap {
  y: number;
  time: number;
  flaps: number;
  score: number;
  scrollSpeed: number;
  xs: number[];
  sounds: number;
}

const PLAY = 'scene=flight&seed=3&autopilot=1&feather=off';

async function open(page: Page, query: string) {
  await page.goto(`./?${query}`);
  await expect(page.locator('#game canvas').first()).toBeVisible();
  await page.waitForFunction(() => window.__SKY_FALCON__?.registry.get('ready') === true, undefined, { timeout: 60_000 });
}

const reg = <T>(page: Page, key: string) => page.evaluate((k) => window.__SKY_FALCON__!.registry.get(k) as T, key);

/** Waits until the falcon has flown `seconds` of game time. */
async function flyUntil(page: Page, seconds: number) {
  await page.waitForFunction(
    (s) => ((window.__SKY_FALCON__!.registry.get('falcon') as { time: number } | undefined)?.time ?? 0) >= s,
    seconds,
    { timeout: 120_000 },
  );
}

/** Lets `n` animation frames pass (the game is frozen or not; the page still draws). */
function frames(page: Page, n = 12) {
  return page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let i = 0;
        const step = () => (++i >= count ? resolve() : requestAnimationFrame(step));
        requestAnimationFrame(step);
      }),
    n,
  );
}

function snap(page: Page): Promise<Snap> {
  return page.evaluate(() => {
    const r = window.__SKY_FALCON__!.registry;
    const f = r.get('falcon') as { y: number; time: number; flaps: number };
    const obstacles = r.get('obstacles') as { x: number }[];
    return {
      y: f.y,
      time: f.time,
      flaps: f.flaps,
      score: r.get('score') as number,
      scrollSpeed: r.get('scrollSpeed') as number,
      xs: obstacles.map((o) => o.x),
      sounds: r.get('soundCount') as number,
    };
  });
}

async function pointOf(page: Page, ui: Ui) {
  const box = (await page.locator('#game canvas').first().boundingBox())!;
  return { x: box.x + (ui.x / 540) * box.width, y: box.y + (ui.y / 960) * box.height, box };
}

async function waitPaused(page: Page, paused: boolean) {
  await page.waitForFunction((p) => window.__SKY_FALCON__!.registry.get('paused') === p, paused, { timeout: 120_000 });
}

/** Samples `countdown` and the shown number on every frame until the pause is over; returns the distinct values. */
function watchCountdown(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ numbers: number[]; shown: string[]; ys: number[]; times: number[] }>((resolve) => {
        const r = window.__SKY_FALCON__!.registry;
        const numbers: number[] = [];
        const shown: string[] = [];
        const ys: number[] = [];
        const times: number[] = [];
        const tick = () => {
          const c = r.get('countdown') as number | null;
          if (c !== null && numbers[numbers.length - 1] !== c) {
            numbers.push(c);
            shown.push((r.get('pauseTexts') as { number: string }).number);
          }
          if (c !== null) {
            const f = r.get('falcon') as { y: number; time: number };
            ys.push(f.y);
            times.push(f.time);
          }
          if (r.get('paused') === false) return resolve({ numbers, shown, ys, times });
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
}

async function startPaused(page: Page, query = PLAY) {
  await open(page, query);
  await flyUntil(page, 0.5);
  await page.keyboard.press('p');
  await waitPaused(page, true);
}

test('the pause button freezes the run: falcon, obstacles, score, speed and sounds stay put', async ({ page }) => {
  await open(page, PLAY);
  await flyUntil(page, 1);
  const { x, y } = await pointOf(page, (await reg<Ui>(page, 'pauseUi'))!);
  await page.mouse.click(x, y);
  await waitPaused(page, true);
  expect((await reg<{ title: string }>(page, 'pauseTexts')).title).toBe('Paused');
  const a = await snap(page);
  await frames(page, 20);
  const b = await snap(page);
  expect(b).toEqual(a);
});

test('P and Escape toggle the pause; a held key counts once', async ({ page }) => {
  await open(page, PLAY);
  await flyUntil(page, 0.5);
  await page.keyboard.press('Escape');
  await waitPaused(page, true);
  expect(await reg(page, 'pauseMode')).toBe('paused');
  // Pressing again starts the countdown (still frozen), and ignores more presses until it is over.
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__SKY_FALCON__!.registry.get('pauseMode') === 'counting');
  await waitPaused(page, false);

  await flyUntil(page, ((await snap(page)).time) + 0.3);
  await page.keyboard.down('p');
  await page.keyboard.down('p');
  await page.keyboard.down('p');
  await page.keyboard.up('p');
  await waitPaused(page, true);
  await frames(page, 5);
  expect(await reg(page, 'pauseMode')).toBe('paused');
});

test('a paused run ignores flaps, taps and clicks', async ({ page }) => {
  await startPaused(page);
  const a = await snap(page);
  await page.keyboard.press('Space');
  await page.mouse.click(5, 5);
  const box = (await page.locator('#game canvas').first().boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); // a tap on the overlay only starts the countdown
  await page.waitForFunction(() => window.__SKY_FALCON__!.registry.get('pauseMode') === 'counting');
  await page.keyboard.press('Space');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 3);
  const during = await snap(page);
  expect(during.flaps).toBe(a.flaps);
  expect(during.sounds).toBe(a.sounds);
  expect(during.y).toBe(a.y);
  expect(during.time).toBe(a.time);
});

test('resuming counts 3, 2, 1 with the falcon and obstacles still, then the run goes on from the same state', async ({ page }) => {
  await startPaused(page);
  const a = await snap(page);
  const box = (await page.locator('#game canvas').first().boundingBox())!;
  const done = watchCountdown(page);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const { numbers, shown, ys, times } = await done;
  expect(numbers).toEqual([3, 2, 1]);
  expect(shown).toEqual(['3', '2', '1']);
  for (const y of ys) expect(y).toBe(a.y);
  for (const time of times) expect(time).toBe(a.time);
  expect(await reg(page, 'countdown')).toBeNull();
  await flyUntil(page, a.time + 0.5);
  const c = await snap(page);
  expect(c.time).toBeGreaterThan(a.time + 0.4);
  expect(c.xs.length).toBeGreaterThan(0);
});

test('hiding the tab pauses by itself and coming back does not resume', async ({ page }) => {
  await open(page, PLAY);
  await flyUntil(page, 0.5);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await waitPaused(page, true);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const a = await snap(page);
  await frames(page, 10);
  expect(await reg(page, 'paused')).toBe(true);
  expect(await reg(page, 'pauseMode')).toBe('paused');
  expect((await reg<{ hint: string }>(page, 'pauseTexts')).hint).toBe('Tap to resume');
  expect(await snap(page)).toEqual(a);
});

test('losing focus (blur) pauses the run', async ({ page }) => {
  await open(page, PLAY);
  await flyUntil(page, 0.5);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await waitPaused(page, true);
});

test('pause does nothing before the first flap, after game over, or on the start screen', async ({ page }) => {
  await open(page, 'scene=flight&seed=3&obstacles=off');
  await page.keyboard.press('p');
  await page.keyboard.press('Escape');
  const { x, y } = await pointOf(page, (await reg<Ui>(page, 'pauseUi'))!);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await frames(page, 5);
  expect(await reg(page, 'paused')).toBe(false);
  // The press on the button is not a flap either: the falcon still hovers.
  await page.mouse.click(x, y);
  await frames(page, 3);
  expect(await reg(page, 'paused')).toBe(false);
  expect((await reg<{ phase: string }>(page, 'falcon')).phase).toBe('ready');

  // One flap and nothing else: the falcon falls to the sand and the run is over.
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__SKY_FALCON__!.registry.get('runOver') === true, undefined, { timeout: 120_000 });
  await page.keyboard.press('p');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await frames(page, 5);
  expect(await reg(page, 'paused')).toBe(false);

  await open(page, 'scene=start');
  await page.keyboard.press('p');
  await page.keyboard.press('Escape');
  await frames(page, 3);
  expect(await reg(page, 'screen')).toBe('start');
  expect(await reg(page, 'paused')).toBeUndefined();
});

test('?pause=1 opens the flight paused', async ({ page }) => {
  await open(page, 'scene=flight&seed=3&obstacles=off&pause=1');
  await waitPaused(page, true);
  expect((await reg<{ phase: string }>(page, 'falcon')).phase).toBe('flying');
  expect(await reg(page, 'runOver')).toBe(false);
});

test('in Arabic the texts are Arabic, the countdown uses Arabic-Indic digits, and the buttons sit side by side', async ({ page }) => {
  await open(page, `${PLAY}&lang=ar`);
  await flyUntil(page, 0.5);
  const pauseUi = (await reg<Ui>(page, 'pauseUi'))!;
  const muteUi = (await reg<Ui>(page, 'muteUi'))!;
  // Right to left: the mute button is in the left corner, the pause button inward (to its right).
  expect(pauseUi.x).toBeGreaterThan(muteUi.x);
  expect(pauseUi.x - muteUi.x).toBeGreaterThanOrEqual(pauseUi.width);
  expect(pauseUi.x - pauseUi.width / 2).toBeGreaterThanOrEqual(0);
  expect(pauseUi.x + pauseUi.width / 2).toBeLessThanOrEqual(540);
  expect(pauseUi.x + pauseUi.width / 2).toBeLessThan(270 - 40); // clear of the score at the top centre

  const { x, y } = await pointOf(page, pauseUi);
  await page.mouse.click(x, y);
  await waitPaused(page, true);
  const texts = await reg<{ title: string; hint: string }>(page, 'pauseTexts');
  expect(texts.title).toBe('متوقف مؤقتًا');
  expect(texts.hint).toBe('المس للمتابعة');

  const done = watchCountdown(page);
  await page.keyboard.press('p');
  const { shown } = await done;
  expect(shown).toEqual(['٣', '٢', '١']);
});

test('in English the pause button sits left of the mute button, inside the screen', async ({ page }) => {
  await open(page, `${PLAY}&lang=en`);
  const pauseUi = (await reg<Ui>(page, 'pauseUi'))!;
  const muteUi = (await reg<Ui>(page, 'muteUi'))!;
  expect(pauseUi.x).toBeLessThan(muteUi.x);
  expect(muteUi.x - pauseUi.x).toBeGreaterThanOrEqual(pauseUi.width);
  expect(pauseUi.y).toBe(muteUi.y);
  expect(pauseUi.x + pauseUi.width / 2).toBeGreaterThan(270 + 40);
  expect(muteUi.x + muteUi.width / 2).toBeLessThanOrEqual(540);
});
