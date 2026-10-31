# Sky Falcon

A small web game for phones and computers: guide a falcon over the desert. Built with [Phaser 3](https://phaser.io),
[Vite](https://vite.dev) and TypeScript, using simple drawn shapes, and published on GitHub Pages.

Play it here: `https://<owner>.github.io/sky-falcon/` (the address appears on the **Deploy to GitHub Pages** workflow run).

## Commands

Requires Node 20 or newer (CI uses 22).

```bash
npm install          # install dependencies
npm run dev          # local server with hot reload (http://localhost:5173)
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm test             # unit tests (Vitest)
npm run build        # production build in dist/
npm run preview      # serve dist/ locally
npx playwright install chromium   # once, for the browser tests
npm run test:e2e     # browser tests (Playwright) on the production build, desktop and phone sizes
```

## Layout

```
index.html                 page shell (#game holds the canvas)
src/main.ts                entry: page CSS + starts the game
src/style.css              full-screen, no-scroll page
src/game/constants.ts      game size (540x960, portrait 9:16) and colours
src/game/config.ts         Phaser config: FIT scaling, centred, scenes
src/game/scenes/           Phaser scenes
src/game/background/       desert background: pure layout + drawing
tests/unit/                Vitest tests (pure logic, no browser)
tests/e2e/                 Playwright tests (canvas, fit, resize)
```

The game draws in a fixed 540x960 coordinate system, and Phaser's `FIT` mode scales it to any screen while keeping its
proportions. It also re-fits when the window changes size.

## Publishing

`.github/workflows/deploy-pages.yml` runs on every push to `main`. It runs the unit tests, builds the game and deploys `dist/`
to GitHub Pages. `.github/workflows/ci.yml` checks pull requests: lint, types, unit tests, build and browser tests.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
