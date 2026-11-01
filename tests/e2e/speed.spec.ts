import { expect, test } from '@playwright/test';

/* The autopilot plays; we read score, speedLevel and scrollSpeed from the registry. Game time only, no wall clock. */
test.describe.configure({ timeout: 240_000 });

interface Sample {
  score: number;
  level: number;
  speed: number;
  over: boolean;
  obstacles: { x: number; width: number; gapTop: number; gapBottom: number; dateX: number; dateY: number }[];
}

test('the game speeds up at 10 points and not in between', async ({ page }) => {
  await page.goto('./?scene=flight&seed=3&autopilot=1&feather=off');
  await expect(page.locator('#game canvas').first()).toBeVisible();
  await page.waitForFunction(() => window.__SKY_FALCON__?.registry.get('ready') === true, undefined, {
    timeout: 60_000,
  });
  const samples = await page.evaluate(
    () =>
      new Promise<Sample[]>((resolve) => {
        const registry = window.__SKY_FALCON__!.registry;
        const out: Sample[] = [];
        const tick = () => {
          const s = {
            score: registry.get('score') as number,
            level: registry.get('speedLevel') as number,
            speed: registry.get('scrollSpeed') as number,
            over: registry.get('runOver') as boolean,
            obstacles: (registry.get('obstacles') as Sample['obstacles']).map((o) => ({ ...o })),
          };
          out.push(s);
          if (s.over || s.score >= 14) resolve(out);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  expect(samples.at(-1)!.score).toBeGreaterThanOrEqual(14);
  const base = samples[0].speed;
  for (const s of samples) {
    expect(s.level).toBe(s.score >= 10 ? 1 : 0);
    expect(s.speed).toBeCloseTo(s.score >= 10 ? base * (1 + 0.04) : base);
  }
  expect(samples.some((s) => s.score === 9 || s.score < 10)).toBe(true);
  expect(samples.some((s) => s.level === 1)).toBe(true);

  // Dates ride with their obstacle: also once the game is faster they sit in the middle of it and inside its gap.
  const fast = samples.filter((s) => s.level === 1);
  expect(fast.length).toBeGreaterThan(0);
  for (const s of fast) {
    for (const o of s.obstacles) {
      expect(o.dateX).toBeCloseTo(o.x + o.width / 2);
      expect(o.dateY).toBeGreaterThan(o.gapTop);
      expect(o.dateY).toBeLessThan(o.gapBottom);
    }
  }
});
