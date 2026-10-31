import { expect, test, type Page } from "@playwright/test";

/* Game time, not wall-clock time, is what the game measures; these waits poll the registry (see falcon.spec.ts). */
test.describe.configure({ timeout: 120_000 });

interface Ui {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function openStart(page: Page, best?: string) {
  if (best !== undefined)
    await page.addInitScript(
      (v) => localStorage.setItem("skyFalcon.best", v),
      best,
    );
  await page.goto("./");
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

/** The Play button's centre on the page. */
async function playPoint(page: Page) {
  const ui = await reg<Ui>(page, "startUi");
  const box = (await page.locator("#game canvas").first().boundingBox())!;
  return {
    x: box.x + (ui.x / 540) * box.width,
    y: box.y + (ui.y / 960) * box.height,
    box,
    ui,
  };
}

async function expectRunStarted(page: Page) {
  await page.waitForFunction(
    () => window.__SKY_FALCON__?.registry.get("screen") === "flight",
    undefined,
    {
      timeout: 60_000,
    },
  );
  await page.waitForFunction(
    () => window.__SKY_FALCON__?.registry.get("ready") === true,
    undefined,
    { timeout: 60_000 },
  );
  expect(await reg<number>(page, "score")).toBe(0);
  const f = await reg<{ phase: string; flaps: number }>(page, "falcon");
  expect(f.phase).toBe("ready");
  expect(f.flaps).toBe(0);
}

test("the start screen opens first with best score 0 on a new device", async ({
  page,
}) => {
  await openStart(page);
  expect(await reg(page, "screen")).toBe("start");
  expect(await reg(page, "bestScore")).toBe(0);
  const { x, y, box } = await playPoint(page);
  // Play is on the canvas.
  expect(x).toBeGreaterThan(box.x);
  expect(x).toBeLessThan(box.x + box.width);
  expect(y).toBeGreaterThan(box.y);
  expect(y).toBeLessThan(box.y + box.height);
});

test("shows the best score saved earlier", async ({ page }) => {
  await openStart(page, "42");
  expect(await reg(page, "bestScore")).toBe(42);
});

test("Play by click or tap starts a run with score 0", async ({
  page,
  hasTouch,
}) => {
  await openStart(page);
  const { x, y } = await playPoint(page);
  if (hasTouch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await expectRunStarted(page);
});

for (const key of ["Space", "Enter"]) {
  test(`Play by the ${key} key starts a run without a flap`, async ({
    page,
  }) => {
    await openStart(page);
    await page.keyboard.press(key);
    await expectRunStarted(page);
  });
}

test("a tap beside the button does not start the run", async ({ page }) => {
  await openStart(page);
  const { box } = await playPoint(page);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.9);
  await page.waitForTimeout(500);
  expect(await reg(page, "screen")).toBe("start");
});

test("waiting on the start screen: the falcon stays and nothing comes", async ({
  page,
}) => {
  await openStart(page);
  const before = await reg<{ y: number; time: number; phase: string }>(
    page,
    "falcon",
  );
  // Wait for a number of drawn frames, however slow the browser is.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let n = 0;
        const tick = () =>
          ++n >= 30 ? resolve() : requestAnimationFrame(tick);
        requestAnimationFrame(tick);
      }),
  );
  const after = await reg<{ y: number; time: number; phase: string }>(
    page,
    "falcon",
  );
  expect(after).toEqual(before);
  expect(after.phase).toBe("ready");
  expect(await reg(page, "screen")).toBe("start");
  expect(await reg(page, "runOver")).toBe(false);
  expect(await reg(page, "score")).toBe(0);
});

test("the start screen keeps Play on the canvas after a resize", async ({
  page,
}) => {
  await openStart(page);
  const view = page.viewportSize()!;
  await page.setViewportSize(
    view.width > view.height
      ? { width: 800, height: 1200 }
      : { width: 844, height: 390 },
  );
  await expect
    .poll(async () => {
      const { y, box } = await playPoint(page);
      return y > box.y && y < box.y + box.height && box.width > 0;
    })
    .toBe(true);
  const { x, y } = await playPoint(page);
  await page.mouse.click(x, y);
  await page.waitForFunction(
    () => window.__SKY_FALCON__?.registry.get("screen") === "flight",
    undefined,
    {
      timeout: 60_000,
    },
  );
});

interface Texts {
  title: string;
  bestScore: string;
  play: string;
  switchLanguage: string;
}

async function clickSwitch(page: Page) {
  const ui = await reg<Ui>(page, "langUi");
  const box = (await page.locator("#game canvas").first().boundingBox())!;
  const x = box.x + (ui.x / 540) * box.width;
  const y = box.y + (ui.y / 960) * box.height;
  await page.mouse.click(x, y);
}

const waitLang = (page: Page, lang: string) =>
  page.waitForFunction(
    (l) => window.__SKY_FALCON__?.registry.get("lang") === l,
    lang,
    { timeout: 60_000 },
  );

test("a new device opens in English, left to right", async ({ page }) => {
  await openStart(page);
  expect(await reg(page, "lang")).toBe("en");
  expect(await reg(page, "dir")).toBe("ltr");
  const texts = await reg<Texts>(page, "startTexts");
  expect(texts.play).toBe("Play");
  expect(texts.title).toBe("Sky Falcon");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("switching to Arabic and back, and it is remembered after a reload", async ({
  page,
}) => {
  await openStart(page, "42");
  await clickSwitch(page);
  await waitLang(page, "ar");
  expect(await reg(page, "dir")).toBe("rtl");
  const ar = await reg<Texts>(page, "startTexts");
  expect(ar.play).toBe("العب");
  expect(ar.title).toBe("صقر السماء");
  expect(ar.bestScore).toContain("٤٢");
  expect(ar.switchLanguage).toBe("English");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  expect(await reg(page, "screen")).toBe("start");
  expect(
    await page.evaluate(() => localStorage.getItem("skyFalcon.lang")),
  ).toBe("ar");

  await page.reload();
  await page.waitForFunction(
    () => window.__SKY_FALCON__?.registry.get("ready") === true,
    undefined,
    { timeout: 60_000 },
  );
  expect(await reg(page, "lang")).toBe("ar");

  await clickSwitch(page);
  await waitLang(page, "en");
  expect(await reg(page, "dir")).toBe("ltr");
  expect((await reg<Texts>(page, "startTexts")).play).toBe("Play");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("the switch works when saving data is not allowed", async ({ page }) => {
  await page.addInitScript(() => {
    const fail = () => {
      throw new Error("blocked");
    };
    Storage.prototype.setItem = fail;
    Storage.prototype.getItem = fail;
  });
  await page.goto("./");
  await page.waitForFunction(
    () => window.__SKY_FALCON__?.registry.get("ready") === true,
    undefined,
    { timeout: 60_000 },
  );
  await clickSwitch(page);
  await waitLang(page, "ar");
  expect((await reg<Texts>(page, "startTexts")).play).toBe("العب");
});

test("Play still starts the run in Arabic", async ({ page }) => {
  await openStart(page);
  await clickSwitch(page);
  await waitLang(page, "ar");
  const { x, y } = await playPoint(page);
  await page.mouse.click(x, y);
  await expectRunStarted(page);
  expect(await reg(page, "lang")).toBe("ar");
});

test("?lang=ar opens in Arabic", async ({ page }) => {
  await page.goto("./?lang=ar");
  await page.waitForFunction(
    () => window.__SKY_FALCON__?.registry.get("ready") === true,
    undefined,
    { timeout: 60_000 },
  );
  expect(await reg(page, "lang")).toBe("ar");
});

const WESTERN = /[0-9]/;
const ARABIC_INDIC = /[٠-٩]/;

test("the best score uses the digits of the chosen language, also after switching", async ({
  page,
}) => {
  await openStart(page, "42");
  let texts = await reg<Texts>(page, "startTexts");
  expect(texts.bestScore).toContain("42");
  expect(texts.bestScore).not.toMatch(ARABIC_INDIC);

  await clickSwitch(page);
  await waitLang(page, "ar");
  texts = await reg<Texts>(page, "startTexts");
  expect(texts.bestScore).toContain("٤٢");
  expect(texts.bestScore).not.toMatch(WESTERN);

  await clickSwitch(page);
  await waitLang(page, "en");
  texts = await reg<Texts>(page, "startTexts");
  expect(texts.bestScore).toContain("42");
  expect(texts.bestScore).not.toMatch(ARABIC_INDIC);
});

test("with no saved score the best score is 0 in English and ٠ in Arabic", async ({
  page,
}) => {
  await openStart(page);
  expect((await reg<Texts>(page, "startTexts")).bestScore).toBe(
    "Best score: 0",
  );
  await clickSwitch(page);
  await waitLang(page, "ar");
  const ar = (await reg<Texts>(page, "startTexts")).bestScore;
  expect(ar).toContain("٠");
  expect(ar).not.toMatch(WESTERN);
});

test("the language switch is at least 44 px tall on screen and clear of the title", async ({
  page,
}) => {
  await openStart(page);
  const box = (await page.locator("#game canvas").first().boundingBox())!;
  for (const lang of ["en", "ar"]) {
    if (lang === "ar") {
      await clickSwitch(page);
      await waitLang(page, "ar");
    }
    const ui = await reg<Ui>(page, "langUi");
    expect(ui.height * (box.height / 960)).toBeGreaterThanOrEqual(44);
    expect(ui.x - ui.width / 2).toBeGreaterThanOrEqual(0);
    expect(ui.x + ui.width / 2).toBeLessThanOrEqual(540);
    // The title is centred at y=190 with a 72 px font: its top is about y=150.
    expect(ui.y + ui.height / 2).toBeLessThan(150);
  }
});
