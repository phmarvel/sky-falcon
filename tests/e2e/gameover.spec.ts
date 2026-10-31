import { expect, test, type Page } from "@playwright/test";

interface GameOver {
  score: number;
  best: number;
  isNewBest: boolean;
  lang: "en" | "ar";
  dir: "ltr" | "rtl";
  ready: boolean;
  texts: { title: string; score: string; bestScore: string; playAgain: string };
  ui: { x: number; y: number; width: number; height: number };
}

/*
 * Like falcon.spec.ts: nothing here waits on the wall clock (slow CI draws few frames); waits are on the registry.
 */
test.describe.configure({ timeout: 180_000 });

test.beforeEach(async ({ page, browserName }) => {
  const rate = Number(process.env.E2E_CPU_THROTTLE ?? 0);
  if (rate > 1 && browserName === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  }
});

async function open(page: Page, query: string) {
  await page.goto(`./?scene=flight&${query}`);
  await expect(page.locator("#game canvas").first()).toBeVisible();
  await page.waitForFunction(
    () => window.__SKY_FALCON__?.registry.get("ready") === true,
    undefined,
    {
      timeout: 60_000,
    },
  );
}

const canvas = (page: Page) => page.locator("#game canvas").first();

async function clickAt(page: Page, x: number, y: number) {
  const box = (await canvas(page).boundingBox())!;
  await page.mouse.click(
    box.x + (x / 540) * box.width,
    box.y + (y / 960) * box.height,
  );
}

/** Starts a run with a click and waits for the game over screen to accept input. */
async function fallToGameOver(page: Page): Promise<GameOver> {
  await clickAt(page, 270, 100);
  return waitForGameOver(page);
}

async function waitForGameOver(page: Page): Promise<GameOver> {
  await page.waitForFunction(
    () =>
      (
        window.__SKY_FALCON__!.registry.get("gameOver") as {
          ready?: boolean;
        } | null
      )?.ready === true,
    undefined,
    { timeout: 120_000 },
  );
  return page.evaluate(
    () => window.__SKY_FALCON__!.registry.get("gameOver") as GameOver,
  );
}

/** Plays with the autopilot until `points` obstacles are passed, then stops it so the falcon falls to the sand. */
async function scoreThenFall(page: Page, points: number): Promise<GameOver> {
  await page.waitForFunction(
    (n) => (window.__SKY_FALCON__!.registry.get("passed") as number) >= n,
    points,
    { timeout: 150_000 },
  );
  await page.evaluate(() => {
    const scene = window.__SKY_FALCON__!.scene.getScene(
      "Flight",
    ) as unknown as { autopilot: boolean };
    scene.autopilot = false;
  });
  return waitForGameOver(page);
}

test("the first run on a new device: the best score equals the score", async ({
  page,
}) => {
  await open(page, "obstacles=off");
  const over = await fallToGameOver(page);
  expect(over.score).toBe(0);
  expect(over.best).toBe(0);
  expect(over.isNewBest).toBe(false);
  expect(over.texts.title).toBe("Game over");
  expect(over.texts.score).toBe("Score: 0");
  expect(over.texts.bestScore).toBe("Best score: 0");
  expect(over.texts.playAgain).toBe("Play again");
});

test("a higher score becomes the best score and is still known after a reload", async ({
  page,
}) => {
  await open(page, "seed=3&autopilot=1");
  const over = await scoreThenFall(page, 2);
  expect(over.score).toBeGreaterThanOrEqual(2);
  expect(over.best).toBe(over.score);
  expect(over.isNewBest).toBe(true);
  expect(
    await page.evaluate(() => localStorage.getItem("skyFalcon.best")),
  ).toBe(String(over.score));

  // A reload on the same device: the start screen knows the best score.
  await page.goto("./");
  await page.waitForFunction(
    () => window.__SKY_FALCON__?.registry.get("screen") === "start",
    undefined,
    {
      timeout: 60_000,
    },
  );
  expect(
    await page.evaluate(() => window.__SKY_FALCON__!.registry.get("bestScore")),
  ).toBe(over.score);
});

test("a score that does not beat the best leaves the best score unchanged", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("skyFalcon.best"))
      localStorage.setItem("skyFalcon.best", "999");
  });
  await open(page, "obstacles=off");
  const over = await fallToGameOver(page);
  expect(over.score).toBe(0);
  expect(over.best).toBe(999);
  expect(over.isNewBest).toBe(false);
  expect(over.texts.bestScore).toBe("Best score: 999");
  expect(
    await page.evaluate(() => localStorage.getItem("skyFalcon.best")),
  ).toBe("999");
});

test("without storage the game works and keeps the best for this visit", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await open(page, "seed=3&autopilot=1");
  const first = await scoreThenFall(page, 1);
  expect(first.best).toBe(first.score);
  expect(first.score).toBeGreaterThanOrEqual(1);

  // Play again (autopilot is off in the URL-less restart? it stays on: the address is the same) and fall.
  await clickAt(page, first.ui.x, first.ui.y);
  await page.waitForFunction(
    () => window.__SKY_FALCON__!.registry.get("gameOver") === null,
    undefined,
    {
      timeout: 60_000,
    },
  );
  const second = await scoreThenFall(page, 1);
  expect(second.best).toBeGreaterThanOrEqual(first.best);
});

test("Play again starts a new run from a score of 0 (click)", async ({
  page,
}) => {
  await open(page, "seed=3&autopilot=1");
  const over = await scoreThenFall(page, 1);
  expect(over.score).toBeGreaterThanOrEqual(1);
  await clickAt(page, over.ui.x, over.ui.y);
  await page.waitForFunction(
    () => {
      const r = window.__SKY_FALCON__!.registry;
      return (
        r.get("gameOver") === null &&
        r.get("runOver") === false &&
        r.get("ready") === true
      );
    },
    undefined,
    { timeout: 60_000 },
  );
  const state = await page.evaluate(() => {
    const r = window.__SKY_FALCON__!.registry;
    return {
      screen: r.get("screen"),
      passed: r.get("passed"),
      score: r.get("score"),
      phase: (r.get("falcon") as { phase: string }).phase,
    };
  });
  expect(state.screen).toBe("flight");
  expect(state.passed).toBe(0);
  expect(state.score).toBe(0);
});

test("Play again also works with the space bar, and the tap that ended the run does not restart", async ({
  page,
}) => {
  await open(page, "obstacles=off");
  await clickAt(page, 270, 100);
  // Wait for the screen to appear but not yet accept input, then press: nothing happens.
  await page.waitForFunction(
    () => window.__SKY_FALCON__!.registry.get("gameOver") != null,
    undefined,
    { timeout: 120_000 },
  );
  const over = await waitForGameOver(page);
  await page.keyboard.press("Space");
  await page.waitForFunction(
    () => window.__SKY_FALCON__!.registry.get("gameOver") === null,
    undefined,
    { timeout: 60_000 },
  );
  expect(
    await page.evaluate(
      () =>
        (window.__SKY_FALCON__!.registry.get("falcon") as { phase: string })
          .phase,
    ),
  ).toBe("ready");
  expect(over.ready).toBe(true);
  // One press starts the new run with a single flap.
  await page.keyboard.press("Space");
  await page.waitForFunction(
    () =>
      (window.__SKY_FALCON__!.registry.get("falcon") as { flaps: number })
        .flaps >= 1,
  );
  expect(
    await page.evaluate(
      () =>
        (window.__SKY_FALCON__!.registry.get("falcon") as { flaps: number })
          .flaps,
    ),
  ).toBe(1);
});

test("on a phone the screen is tapped; in Arabic it reads right to left with Arabic digits", async ({
  page,
}, testInfo) => {
  await open(page, "obstacles=off&lang=ar");
  const over = await fallToGameOver(page);
  expect(over.lang).toBe("ar");
  expect(over.dir).toBe("rtl");
  expect(over.texts.title).toBe("انتهت اللعبة");
  expect(over.texts.score).toBe("النتيجة: ٠");
  expect(over.texts.bestScore).toBe("أفضل نتيجة: ٠");
  expect(over.texts.playAgain).toBe("العب مرة أخرى");
  const box = (await canvas(page).boundingBox())!;
  // The button is big enough to hit with a thumb: at least 44 px on the screen.
  expect((over.ui.height / 960) * box.height).toBeGreaterThanOrEqual(44);
  if (testInfo.project.use.hasTouch) {
    await canvas(page).tap({
      position: {
        x: (over.ui.x / 540) * box.width,
        y: (over.ui.y / 960) * box.height,
      },
    });
  } else {
    await clickAt(page, over.ui.x, over.ui.y);
  }
  await page.waitForFunction(
    () => window.__SKY_FALCON__!.registry.get("gameOver") === null,
    undefined,
    { timeout: 60_000 },
  );
});
