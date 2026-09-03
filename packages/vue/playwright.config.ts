import { defineConfig, devices } from '@playwright/test';

// Serves tests/e2e/fixtures/*.html via this package's own Vite dev
// server (the same one `pnpm dev` uses) — e2e tests exercise the real
// compiled <Chart> component against real Chart.js, in a real browser,
// specifically to catch what Vitest's own component tests (which mock
// keystone-chartjs-core entirely) structurally can't: real canvas 2D
// rendering (jsdom has none at all), real ResizeObserver-driven resize
// behavior, and real dynamic-import registration of the 5 ecosystem
// extension packages and 3 official plugins (all mocked away everywhere
// else in this monorepo).
//
// Adapted from keystone-grid's own real packages/vue/playwright.config.ts
// (read directly, not guessed) — that config's own `launchOptions.
// executablePath` pins a Linux-specific browser path from its own CI
// sandbox, which doesn't apply here and is deliberately omitted so
// Playwright resolves its own installed browser normally (run
// `npx playwright install chromium` first if it isn't already).
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5183',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Without this, Playwright's default `chromium` project uses
        // the stripped-down `chrome-headless-shell` binary, which has
        // real, documented canvas/GPU rendering differences from the
        // full browser — confirmed via a real run to be the actual root
        // cause here: the fixture's canvas got correct real dimensions
        // (DOM/CSS layout, unaffected) and zero console errors, yet
        // Chart.js's own draw calls never produced a single non-blank
        // pixel, for the entire chart's lifetime. `channel: 'chromium'`
        // uses the full Chrome-for-Testing/Chromium browser instead —
        // documented as the recommended fix specifically for tests
        // that depend on GPU, fonts, or canvas, which this whole test
        // suite fundamentally does (every one of these fixtures mounts
        // a real Chart.js canvas).
        channel: 'chromium',
      },
    },
    // Firefox/WebKit have no `chrome-headless-shell`-style lightweight
    // build to worry about — that distinction is Chromium-specific —
    // so no `channel` override is needed for either. Run `npx playwright
    // install firefox webkit` first if these browsers aren't already
    // installed locally (chromium's own install doesn't cover them).
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    // `pnpm exec`, not `npx` — confirmed via a real run: `npx vite`
    // shells out through npm specifically, and this project's own pnpm
    // env vars (visible in the warnings a real run produced: "Unknown
    // env config npm-globalconfig/recursive/verify-deps-before-run/
    // _jsr-registry") leak into that npm subprocess, a documented
    // pnpm+npx friction point. `pnpm exec` resolves the local
    // node_modules/.bin/vite directly, bypassing npm entirely.
    command: 'pnpm exec vite dev --port 5183 --strictPort',
    // `port`, not `url` — confirmed via a real run: even after fixing
    // the npx/pnpm issue above, running the exact same command directly
    // (outside Playwright) started Vite correctly in ~1.4s, yet
    // Playwright's own readiness check against `url` still timed out at
    // 60s. This is a known, documented Playwright quirk (microsoft/
    // playwright#18467: "Using a url instead of port will cause
    // Playwright to always timeout... switching to just port... works
    // instantly") — `port` uses a more reliable raw-connection readiness
    // check than `url`'s does in some environments.
    port: 5183,
    reuseExistingServer: !process.env.CI,
    // Bumped from KDL's own 30_000 — that project's own config runs in
    // an environment with browsers/deps already warm; a real run here
    // timed out at 30s, and a cold Vite start (first-time esbuild
    // dependency pre-bundling in particular) can genuinely take longer
    // than that on a real local machine.
    timeout: 60_000,
  },
});
