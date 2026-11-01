import { expect, test, type Page } from '@playwright/test';

interface GameOver {
  medal: 'bronze' | 'silver' | 'gold' | null;
  bestMedal: 'bronze' | 'silver' | 'gold' | null;
  isNewMedal: boolean;
  ready: boolean;
  texts: { medal: string; bestMedal: string; score: string };
}

/* Like gameover.spec.ts: waits are on the registry, never on the wall clock (slow CI draws few frames). */
test.describe.configure({ timeout: 180_000 });

test.beforeEach(async ({ page, browserName }) => {
  const rate = Number(process.env.E2E_CPU_THROTTLE ?? 0);
  if (rate > 1 && browserName === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  }
});

const canvas = (page: Page) => page.locator('#game canvas').first();

async function open(page: Page, query: string) {
  await page.goto(`./?scene=flight&obstacles=off&${query}`);
  await expect(canvas(page)).toBeVisible();
  await page.waitForFunction(() => window.__SKY_FALCON__?.registry.get('ready') === true, undefined, {
    timeout: 60_000,
  });
}

/** Plays one run that ends with `points` points: the count is set before the first flap, then the falcon falls. */
async function runWith(page: Page, points: number): Promise<GameOver> {
  await page.evaluate((n) => {
    const scene = window.__SKY_FALCON__!.scene.getScene('Flight') as unknown as { run: { passed: number } };
    scene.run.passed = n;
  }, points);
  const box = (await canvas(page).boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.1);
  await page.waitForFunction(
    () => (window.__SKY_FALCON__!.registry.get('gameOver') as { ready?: boolean } | null)?.ready === true,
    undefined,
    { timeout: 120_000 },
  );
  return page.evaluate(() => window.__SKY_FALCON__!.registry.get('gameOver') as GameOver);
}

async function startScreen(page: Page, query = '') {
  await page.goto(`./${query}`);
  await page.waitForFunction(() => window.__SKY_FALCON__?.registry.get('screen') === 'start', undefined, {
    timeout: 60_000,
  });
}

test('fewer than 10 points: no medal', async ({ page }) => {
  await open(page, 'lang=en');
  const over = await runWith(page, 9);
  expect(over.medal).toBeNull();
  expect(over.texts.medal).toBe('');
  expect(over.bestMedal).toBeNull();
  expect(over.texts.bestMedal).toBe('Best medal: None');
  expect(await page.evaluate(() => window.__SKY_FALCON__!.registry.get('medal'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('skyFalcon.medal'))).toBeNull();
});

for (const [points, medal, word] of [
  [10, 'bronze', 'Bronze'],
  [24, 'bronze', 'Bronze'],
  [25, 'silver', 'Silver'],
  [49, 'silver', 'Silver'],
  [50, 'gold', 'Gold'],
] as const) {
  test(`${points} points: ${medal}`, async ({ page }) => {
    await open(page, 'lang=en');
    const over = await runWith(page, points);
    expect(over.medal).toBe(medal);
    expect(over.bestMedal).toBe(medal);
    expect(over.isNewMedal).toBe(true);
    expect(over.texts.medal).toBe(`Medal: ${word}`);
    expect(over.texts.bestMedal).toBe(`Best medal: ${word}`);
    expect(await page.evaluate(() => window.__SKY_FALCON__!.registry.get('medal'))).toBe(medal);
  });
}

test('the best medal survives a reload, shows on the start screen and a worse run never lowers it', async ({
  page,
}) => {
  await open(page, 'lang=en');
  await runWith(page, 30);
  await startScreen(page, '?lang=en');
  expect(await page.evaluate(() => window.__SKY_FALCON__!.registry.get('bestMedal'))).toBe('silver');
  expect(
    await page.evaluate(() => (window.__SKY_FALCON__!.registry.get('startTexts') as { bestMedal: string }).bestMedal),
  ).toBe('Best medal: Silver');

  await open(page, 'lang=en');
  const worse = await runWith(page, 12);
  expect(worse.medal).toBe('bronze');
  expect(worse.bestMedal).toBe('silver');
  expect(worse.isNewMedal).toBe(false);
  expect(worse.texts.bestMedal).toBe('Best medal: Silver');
  expect(await page.evaluate(() => localStorage.getItem('skyFalcon.medal'))).toBe('silver');
});

test('Arabic: right to left with Arabic-Indic digits', async ({ page }) => {
  await open(page, 'lang=ar');
  const over = await runWith(page, 25);
  expect(over.texts.medal).toBe('الميدالية: فضية');
  expect(over.texts.bestMedal).toBe('أفضل ميدالية: فضية');
  expect(over.texts.score).toContain('٢٥');
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
  await startScreen(page, '?lang=ar');
  expect(
    await page.evaluate(() => (window.__SKY_FALCON__!.registry.get('startTexts') as { bestMedal: string }).bestMedal),
  ).toBe('أفضل ميدالية: فضية');
});

test('without storage the best medal is kept for the visit', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('blocked');
    };
    Storage.prototype.setItem = () => {
      throw new Error('blocked');
    };
  });
  await open(page, 'lang=en');
  const over = await runWith(page, 50);
  expect(over.bestMedal).toBe('gold');
});
