import { expect, test, type Page } from "@playwright/test";

interface Falcon {
  y: number;
  vy: number;
  phase: "ready" | "flying" | "down";
  flaps: number;
  time: number;
  groundY: number;
}

interface Obstacle {
  id: number;
  kind: "tower" | "palm";
  x: number;
  width: number;
  gapTop: number;
  gapBottom: number;
}

interface Frame {
  time: number;
  y: number;
  obstacles: Obstacle[];
  drawn: number;
  passed: number;
  runOver: boolean;
  reason: string | null;
}

const GAME_WIDTH = 540;
const FALCON_X = Math.round(GAME_WIDTH * 0.3);
const RADIUS = 22;
const SPEED = 180;
const SPACING = 300;

/*
 * Like falcon.spec.ts: slow CI browsers run the game slower than real time, so nothing here waits on the wall clock.
 * The player is played from inside the page on every game frame (rAF), and limits are in game seconds.
 */
test.describe.configure({ timeout: 180_000 });

test.beforeEach(async ({ page, browserName }) => {
  const rate = Number(process.env.E2E_CPU_THROTTLE ?? 0);
  if (rate > 1 && browserName === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  }
});

/** Opens the flight directly (`?scene=flight`, skipping the start screen) with the obstacles of `seed`. */
async function openGame(page: Page, seed: number) {
  await page.goto(`./?scene=flight&seed=${seed}`);
  await expect(page.locator("#game canvas").first()).toBeVisible();
  await page.waitForFunction(
    () => window.__SKY_FALCON__?.registry.get("ready") === true,
    undefined,
    {
      timeout: 60_000,
    },
  );
}

/**
 * Plays from inside the page, one decision per game frame, with mouse clicks on the canvas:
 * - 'gap': steers into each next gap, until `passed` obstacles are behind the falcon;
 * - 'high': keeps flapping near the top of the screen, so it flies into the first obstacle's top piece.
 * Stops when the run ends or after `maxGameSeconds`. Returns one record per game frame.
 */
function play(
  page: Page,
  steer: "gap" | "high",
  passed: number,
  maxGameSeconds: number,
): Promise<Frame[]> {
  return page.evaluate(
    ({ steer, passed, maxGameSeconds, falconX, radius }) =>
      new Promise<Frame[]>((resolve) => {
        // The first canvas is the game's; Phaser may add text-measuring canvases after it.
        const canvas = document.querySelector("#game canvas")!;
        const box = canvas.getBoundingClientRect();
        const at = {
          clientX: box.left + 20,
          clientY: box.top + 20,
          button: 0,
          bubbles: true,
        };
        const registry = window.__SKY_FALCON__!.registry;
        const frames: Frame[] = [];
        const click = () => {
          canvas.dispatchEvent(new MouseEvent("mousedown", at));
          canvas.dispatchEvent(new MouseEvent("mouseup", at));
        };
        const tick = () => {
          const f = registry.get("falcon") as Falcon;
          const obstacles = (registry.get("obstacles") as Obstacle[]).map(
            (o) => ({ ...o }),
          );
          const frame: Frame = {
            time: f.time,
            y: f.y,
            obstacles,
            drawn: registry.get("obstaclesDrawn") as number,
            passed: registry.get("passed") as number,
            runOver: registry.get("runOver") as boolean,
            reason: registry.get("runOverReason") as string | null,
          };
          if (frames.at(-1)?.time !== frame.time || frame.runOver)
            frames.push(frame);
          if (
            frame.runOver ||
            frame.passed >= passed ||
            f.time > maxGameSeconds
          ) {
            resolve(frames);
            return;
          }
          let target: number;
          if (steer === "high") {
            target = 120;
          } else {
            const next = obstacles.find(
              (o) => o.x + o.width > falconX - radius,
            );
            target = next
              ? next.gapTop + (next.gapBottom - next.gapTop) * 0.62
              : 400;
          }
          if (f.phase === "ready" || (f.y > target && f.vy > -100)) click();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    { steer, passed, maxGameSeconds, falconX: FALCON_X, radius: RADIUS },
  );
}

/** Each obstacle id with the frames it was seen in. */
function byId(frames: Frame[]) {
  const seen = new Map<number, { o: Obstacle; time: number }[]>();
  for (const fr of frames) {
    for (const o of fr.obstacles) {
      if (!seen.has(o.id)) seen.set(o.id, []);
      seen.get(o.id)!.push({ o, time: fr.time });
    }
  }
  return seen;
}

test("towers and palm trees keep coming from the right at regular intervals, each with a gap inside the screen", async ({
  page,
}) => {
  await openGame(page, 7);
  expect(
    await page.evaluate(() => window.__SKY_FALCON__!.registry.get("obstacles")),
  ).toEqual([]);
  const frames = await play(page, "gap", 4, 30);
  expect(frames.at(-1)!.runOver).toBe(false);

  const seen = byId(frames);
  expect(seen.size).toBeGreaterThanOrEqual(5);
  const firsts: { o: Obstacle; time: number }[] = [];
  for (const [, track] of seen) {
    const first = track[0];
    firsts.push(first);
    // It appeared at the right edge (at most one long frame of movement after it was added).
    if (first.time > frames[0].time) {
      expect(first.o.x).toBeLessThanOrEqual(GAME_WIDTH);
      expect(first.o.x).toBeGreaterThan(GAME_WIDTH - SPEED * 0.1 - 1);
    }
    // It moves left at a steady speed.
    const last = track.at(-1)!;
    if (last.time - first.time > 0.5) {
      expect((first.o.x - last.o.x) / (last.time - first.time)).toBeCloseTo(
        SPEED,
        -1,
      );
    }
    // Its gap is fully inside the playing area and big enough for the falcon.
    const groundY = 749;
    expect(first.o.gapTop).toBeGreaterThan(0);
    expect(first.o.gapBottom).toBeLessThan(groundY);
    expect(first.o.gapBottom - first.o.gapTop).toBeGreaterThan(RADIUS * 2 * 3);
  }
  // Regular intervals: neighbours are always exactly `spacing` apart.
  for (const fr of frames) {
    for (let k = 1; k < fr.obstacles.length; k++) {
      expect(fr.obstacles[k].x - fr.obstacles[k - 1].x).toBeCloseTo(SPACING, 3);
    }
  }
  // Both kinds come, and the gaps are not all at the same height.
  const kinds = new Set(firsts.map((f) => f.o.kind));
  expect(kinds).toEqual(new Set(["tower", "palm"]));
  expect(new Set(firsts.map((f) => f.o.gapTop)).size).toBeGreaterThan(2);
});

test("flying through the gaps keeps the run going, and obstacles past the left edge are removed", async ({
  page,
}) => {
  await openGame(page, 3);
  const frames = await play(page, "gap", 4, 30);
  const last = frames.at(-1)!;
  expect(last.runOver).toBe(false);
  expect(last.passed).toBeGreaterThanOrEqual(4);

  // No obstacle fully off screen is ever kept, and only the listed ones are drawn.
  for (const fr of frames) {
    for (const o of fr.obstacles)
      expect(o.x + o.width).toBeGreaterThanOrEqual(0);
    expect(fr.drawn).toBe(fr.obstacles.length);
  }
  // The first obstacle was seen, then disappeared once fully past the left edge.
  const track = byId(frames).get(1)!;
  expect(track.length).toBeGreaterThan(5);
  const lastSeen = track.at(-1)!;
  expect(lastSeen.o.x + lastSeen.o.width).toBeLessThan(SPEED * 0.1 + 1);
  expect(last.obstacles.some((o) => o.id === 1)).toBe(false);
});

test("touching a tower or a palm tree ends the run at once", async ({
  page,
}, testInfo) => {
  await openGame(page, 7);
  const frames = await play(page, "high", 99, 30);
  const end = frames.at(-1)!;
  expect(end.runOver).toBe(true);
  expect(end.reason).toBe("obstacle");
  // It ended where the falcon met the first obstacle's top piece.
  const met = end.obstacles.find(
    (o) => o.x <= FALCON_X + RADIUS && o.x + o.width >= FALCON_X - RADIUS,
  );
  expect(met).toBeDefined();
  expect(end.y).toBeLessThan(met!.gapTop + RADIUS);
  const falcon = await page.evaluate(
    () => window.__SKY_FALCON__!.registry.get("falcon") as Falcon,
  );
  expect(falcon.phase).toBe("down");

  // Everything stops: the obstacles freeze and the falcon ignores input.
  const obstacles = await page.evaluate(() =>
    window.__SKY_FALCON__!.registry.get("obstacles"),
  );
  await page
    .locator("#game canvas")
    .first()
    .click({ position: { x: 40, y: 40 } });
  await page.keyboard.press("Space");
  if (testInfo.project.use.hasTouch)
    await page
      .locator("#game canvas")
      .first()
      .tap({ position: { x: 40, y: 40 } });
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(() => window.__SKY_FALCON__!.registry.get("obstacles")),
  ).toEqual(obstacles);
  expect(
    await page.evaluate(() => window.__SKY_FALCON__!.registry.get("falcon")),
  ).toEqual(falcon);
});

test("the start screen shows no obstacles, and Play starts a run that sends them", async ({
  page,
}) => {
  await page.goto("./?seed=7");
  await expect(page.locator("#game canvas").first()).toBeVisible();
  await page.waitForFunction(
    () => window.__SKY_FALCON__?.registry.get("ready") === true,
    undefined,
    { timeout: 60_000 },
  );
  const reg = <T>(key: string) =>
    page.evaluate((k) => window.__SKY_FALCON__!.registry.get(k) as T, key);
  expect(await reg("screen")).toBe("start");
  expect(await reg("obstacles")).toBeUndefined();
  expect(await reg("obstaclesDrawn")).toBeUndefined();

  // Press Play on the start screen.
  const ui = await reg<{ x: number; y: number }>("startUi");
  const box = (await page.locator("#game canvas").first().boundingBox())!;
  await page.mouse.click(
    box.x + (ui.x / GAME_WIDTH) * box.width,
    box.y + (ui.y / 960) * box.height,
  );
  await page.waitForFunction(
    () =>
      window.__SKY_FALCON__?.registry.get("screen") === "flight" &&
      window.__SKY_FALCON__?.registry.get("ready"),
    undefined,
    { timeout: 60_000 },
  );
  // The falcon waits for its first flap, with no obstacles yet; then they come.
  expect(await reg("obstacles")).toEqual([]);
  const frames = await play(page, "gap", 2, 20);
  const last = frames.at(-1)!;
  expect(last.runOver).toBe(false);
  expect(last.passed).toBeGreaterThanOrEqual(2);
  expect(byId(frames).size).toBeGreaterThanOrEqual(3);
});
