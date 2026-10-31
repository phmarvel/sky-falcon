import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const RATIO = 540 / 960;

async function openGame(page: Page) {
  await page.goto("./?scene=flight");
  await expect(page.locator("#game canvas")).toBeVisible();
  await page.waitForFunction(
    () => window.__SKY_FALCON__?.registry.get("ready") === true,
  );
}

async function canvasBox(page: Page) {
  const box = await page.locator("#game canvas").boundingBox();
  if (!box) throw new Error("The canvas has no size");
  return box;
}

async function expectFitsViewport(page: Page) {
  const box = await canvasBox(page);
  const view = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(-0.5);
  expect(box.y).toBeGreaterThanOrEqual(-0.5);
  expect(box.x + box.width).toBeLessThanOrEqual(view.width + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(view.height + 0.5);
  expect(Math.abs(box.width / box.height - RATIO)).toBeLessThan(0.01);
  // FIT fills one side of the screen.
  expect(
    Math.max(box.width / view.width, box.height / view.height),
  ).toBeGreaterThan(0.98);
  const scroll = await page.evaluate(() => ({
    w: document.documentElement.scrollWidth,
    h: document.documentElement.scrollHeight,
    iw: window.innerWidth,
    ih: window.innerHeight,
  }));
  expect(scroll.w).toBeLessThanOrEqual(scroll.iw);
  expect(scroll.h).toBeLessThanOrEqual(scroll.ih);
  return box;
}

/** The colour of the screen at a share of the canvas (from a screenshot, so it works for WebGL and Canvas). */
async function colorAt(page: Page, fx: number, fy: number) {
  const box = await canvasBox(page);
  const shot = await page.screenshot({
    clip: {
      x: box.x + box.width * fx,
      y: box.y + box.height * fy,
      width: 1,
      height: 1,
    },
  });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b };
  }, shot.toString("base64"));
}

test("shows the game canvas with a drawn desert: sky above, sand below", async ({
  page,
}) => {
  await openGame(page);
  await expectFitsViewport(page);
  const sky = await colorAt(page, 0.1, 0.05);
  const sand = await colorAt(page, 0.5, 0.92);
  // Sky: blue is the strongest channel near the top.
  expect(sky.b).toBeGreaterThan(sky.r);
  // Sand: warm, red above blue.
  expect(sand.r).toBeGreaterThan(sand.b + 40);
});

test("the whole canvas fits the screen without scrolling and keeps 9:16", async ({
  page,
}) => {
  await openGame(page);
  await expectFitsViewport(page);
});

test("the canvas scales to fit a new window size", async ({ page }) => {
  await openGame(page);
  const before = await expectFitsViewport(page);
  const view = page.viewportSize()!;
  const next =
    view.width > view.height
      ? { width: 800, height: 1200 }
      : { width: 844, height: 390 };
  await page.setViewportSize(next);
  // Phaser re-fits on the window's resize event, checked on its next frames.
  await expect
    .poll(async () => Math.round((await canvasBox(page)).height), {
      timeout: 15_000,
    })
    .not.toBe(Math.round(before.height));
  await expectFitsViewport(page);
});

test("the canvas keeps fitting through several rotations and resizes in a row", async ({
  page,
}) => {
  await openGame(page);
  const sizes = [
    { width: 844, height: 390 },
    { width: 390, height: 844 },
    { width: 1024, height: 700 },
    { width: 360, height: 640 },
  ];
  for (const size of sizes) {
    await page.setViewportSize(size);
    const expected = Math.round(Math.min(size.height, size.width / RATIO));
    await expect
      .poll(async () => Math.round((await canvasBox(page)).height), {
        timeout: 5_000,
      })
      .toBe(expected);
    await expectFitsViewport(page);
  }
});

test("the build loads its files from relative paths, so it works under the Pages subpath", async () => {
  const html = readFileSync("dist/index.html", "utf8");
  expect(html).toMatch(/src="\.\/assets\//);
  expect(html).not.toMatch(/(src|href)="\/assets\//);
});
