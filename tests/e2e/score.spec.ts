import { expect, test, type Page } from "@playwright/test";

/* Like obstacles.spec.ts: everything is measured in game time (falcon.time), never the wall clock. */
test.describe.configure({ timeout: 180_000 });

const FALCON_X = Math.round(540 * 0.3);
const RADIUS = 22;
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

interface Obstacle {
  id: number;
  x: number;
  width: number;
  gapTop: number;
  gapBottom: number;
}
interface Frame {
  time: number;
  score: number;
  scoreText: string;
  passed: number;
  obstacles: Obstacle[];
  runOver: boolean;
  reason: string | null;
}

test.beforeEach(async ({ page, browserName }) => {
  const rate = Number(process.env.E2E_CPU_THROTTLE ?? 0);
  if (rate > 1 && browserName === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  }
});

async function openGame(page: Page, query: string) {
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

const reg = <T>(page: Page, key: string) =>
  page.evaluate((k) => window.__SKY_FALCON__!.registry.get(k) as T, key);

/**
 * Plays from inside the page. 'gap' steers through the gaps until `until` obstacles are passed; 'high' flies into the
 * first obstacle's top piece; 'idle' flaps once and falls to the sand. After the run ends it keeps sampling for
 * `extraSeconds` of game time (the falcon's clock stops with the run, so it counts frames instead).
 */
function play(
  page: Page,
  steer: "gap" | "high" | "idle",
  until: number,
  maxSeconds: number,
  extraFrames = 0,
) {
  return page.evaluate(
    ({ steer, until, maxSeconds, extraFrames, falconX, radius }) =>
      new Promise<Frame[]>((resolve) => {
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
        let after = 0;
        let flapped = false;
        const click = () => {
          canvas.dispatchEvent(new MouseEvent("mousedown", at));
          canvas.dispatchEvent(new MouseEvent("mouseup", at));
        };
        const tick = () => {
          const f = registry.get("falcon") as {
            y: number;
            vy: number;
            phase: string;
            time: number;
          };
          const obstacles = (registry.get("obstacles") as Obstacle[]).map(
            (o) => ({ ...o }),
          );
          const frame: Frame = {
            time: f.time,
            score: registry.get("score") as number,
            scoreText: registry.get("scoreText") as string,
            passed: registry.get("passed") as number,
            obstacles,
            runOver: registry.get("runOver") as boolean,
            reason: registry.get("runOverReason") as string | null,
          };
          frames.push(frame);
          if (frame.runOver) after++;
          if (
            (frame.runOver && after > extraFrames) ||
            (!frame.runOver && (frame.passed >= until || f.time > maxSeconds))
          ) {
            resolve(frames);
            return;
          }
          if (steer === "idle") {
            if (!flapped) {
              click();
              flapped = true;
            }
          } else {
            let target = 120;
            if (steer === "gap") {
              const next = obstacles.find(
                (o) => o.x + o.width > falconX - radius,
              );
              target = next
                ? next.gapTop + (next.gapBottom - next.gapTop) * 0.62
                : 400;
            }
            if (f.phase === "ready" || (f.y > target && f.vy > -100)) click();
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    {
      steer,
      until,
      maxSeconds,
      extraFrames,
      falconX: FALCON_X,
      radius: RADIUS,
    },
  );
}

test("the score is 0 when the run starts, and shown on screen", async ({
  page,
}) => {
  await openGame(page, "seed=3");
  expect(await reg(page, "score")).toBe(0);
  expect(await reg(page, "scoreText")).toBe("0");
  expect(await reg(page, "runOver")).toBe(false);
});

test("the score goes up by 1 for each obstacle fully passed, not before", async ({
  page,
}) => {
  await openGame(page, "seed=3");
  const frames = await play(page, "gap", 3, 40);
  const last = frames.at(-1)!;
  expect(last.runOver).toBe(false);
  expect(last.score).toBeGreaterThanOrEqual(3);

  let prev = 0;
  const seen = new Map<number, Obstacle>();
  for (const fr of frames) {
    for (const o of fr.obstacles) seen.set(o.id, o);
    expect(fr.score).toBe(fr.passed);
    expect(fr.scoreText).toBe(String(fr.score));
    expect(fr.score - prev).toBeLessThanOrEqual(1);
    expect(fr.score).toBeGreaterThanOrEqual(prev);
    if (fr.score > prev) {
      // Obstacles still on screen at the falcon's back edge have not been passed: at most `score` are fully behind it.
      const behind = fr.obstacles.filter(
        (o) => o.x + o.width < FALCON_X - RADIUS,
      ).length;
      const gone = [...seen.keys()].filter(
        (id) => !fr.obstacles.some((o) => o.id === id),
      ).length;
      expect(behind + gone).toBeGreaterThanOrEqual(fr.score);
    }
    prev = fr.score;
  }
});

test("a touched obstacle gives no point, and the score stays after the run ends", async ({
  page,
}) => {
  await openGame(page, "seed=7");
  const frames = await play(page, "high", 99, 40, 30);
  const over = frames.find((f) => f.runOver)!;
  expect(over.reason).toBe("obstacle");
  expect(over.score).toBe(0);
  for (const fr of frames) expect(fr.score).toBe(over.score);
  expect(await reg(page, "scoreText")).toBe("0");
});

test("after passing some obstacles, a crash keeps exactly the points earned", async ({
  page,
}) => {
  await openGame(page, "seed=3");
  const earned = (await play(page, "gap", 2, 40)).at(-1)!.score;
  expect(earned).toBeGreaterThanOrEqual(2);
  // Stop steering: the falcon falls and ends the run; the score may only grow by obstacles passed on the way down.
  const frames = await play(page, "idle", 99, 60, 30);
  const over = frames.find((f) => f.runOver)!;
  const final = frames.at(-1)!;
  expect(final.score).toBe(over.score);
  expect(final.score).toBe(final.passed);
});

test("a ground crash adds no point", async ({ page }) => {
  await openGame(page, "seed=3&obstacles=off");
  const frames = await play(page, "idle", 99, 60, 10);
  const over = frames.find((f) => f.runOver)!;
  expect(over.reason).toBe("ground");
  for (const fr of frames) expect(fr.score).toBe(0);
});

test("the score is readable: light fill, dark outline, on top, centred", async ({
  page,
}) => {
  await openGame(page, "seed=3");
  const info = await page.evaluate(() => {
    const scene = window.__SKY_FALCON__!.scene.getScene("Flight");
    const text = scene.children.list.find(
      (o) =>
        o.type === "Text" && (o as unknown as { depth: number }).depth === 50,
    ) as unknown as {
      x: number;
      y: number;
      depth: number;
      style: {
        color: string;
        stroke: string;
        strokeThickness: number;
        fontSize: string;
      };
    };
    return { x: text.x, y: text.y, depth: text.depth, ...text.style };
  });
  expect(info.x).toBe(270);
  expect(info.y).toBeLessThan(120);
  expect(info.color.toLowerCase()).toBe("#fff4d6");
  expect(info.stroke.toLowerCase()).toBe("#3a2414");
  expect(info.strokeThickness).toBeGreaterThanOrEqual(6);
  expect(parseInt(info.fontSize, 10)).toBeGreaterThanOrEqual(48);
});

test("in Arabic the score uses Arabic-Indic digits", async ({ page }) => {
  await openGame(page, "seed=3&lang=ar");
  expect(await reg(page, "scoreText")).toBe("٠");
  const frames = await play(page, "gap", 1, 40);
  const last = frames.at(-1)!;
  expect(last.score).toBeGreaterThanOrEqual(1);
  expect(last.scoreText).toBe(
    [...String(last.score)].map((d) => ARABIC_DIGITS[Number(d)]).join(""),
  );
});
