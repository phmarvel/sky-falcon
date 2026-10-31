import { expect, test } from '@playwright/test';

/* The autopilot plays; we read score, speedLevel and scrollSpeed from the registry. Game time only, no wall clock. */
test.describe.configure({ timeout: 240_000 });

test('the game speeds up at 10 points and not in between', async ({ page }) => {
  await page.goto('./?scene=flight&seed=3&autopilot=1');
  await expect(page.locator('#game canvas').first()).toBeVisible();
  await page.waitForFunction(() => window.__SKY_FALCON__?.registry.get('ready') === true, undefined, {
    timeout: 60_000,
  });
  const samples = await page.evaluate(
    () =>
      new Promise<{ score: number; level: number; speed: number; over: boolean }[]>((resolve) => {
        const registry = window.__SKY_FALCON__!.registry;
        const out: { score: number; level: number; speed: number; over: boolean }[] = [];
        const tick = () => {
          const s = {
            score: registry.get('score') as number,
            level: registry.get('speedLevel') as number,
            speed: registry.get('scrollSpeed') as number,
            over: registry.get('runOver') as boolean,
          };
          out.push(s);
          if (s.over || s.score >= 12) resolve(out);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  expect(samples.at(-1)!.score).toBeGreaterThanOrEqual(12);
  const base = samples[0].speed;
  for (const s of samples) {
    expect(s.level).toBe(s.score >= 10 ? 1 : 0);
    expect(s.speed).toBeCloseTo(s.score >= 10 ? base * (1 + 0.04) : base);
  }
  expect(samples.some((s) => s.score === 9 || s.score < 10)).toBe(true);
  expect(samples.some((s) => s.level === 1)).toBe(true);
});
