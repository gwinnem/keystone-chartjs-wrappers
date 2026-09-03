import { test, expect } from '@playwright/test';

// The core thing Vitest's own component tests structurally can't prove
// (keystone-chartjs-core is entirely mocked there, specifically because
// jsdom has no real canvas 2D context) — that a real Chart.js instance
// actually renders real pixels against a real canvas, in a real browser.
//
// This test caught a genuine, real bug on its first honest run: Chart.js
// v4's plain 'chart.js' entry point (the tree-shakeable build) registers
// nothing automatically, so a real (unmocked) chart of a built-in kind
// like 'bar' threw "bar is not a registered controller" — invisible to
// every earlier test tier, since all of them mock Chart.js entirely.
// Fixed in packages/core/src/registry.ts (Chart.register(...registerables)
// at module load); see that file's own comment for the full story.
test('renders a real bar chart with actual non-blank pixels', async ({ page }) => {
  // Only genuine uncaught JS exceptions, not the browser's own `console`
  // 'error' channel — see sankey.spec.ts's own comment for why (harmless
  // favicon-404 noise unrelated to this app's own correctness).
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/tests/e2e/fixtures/bar-chart-fixture.html');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  // Chart.js sizes the canvas to its container — confirms it actually
  // initialized (a canvas that never got a real Chart.js instance
  // attached stays at its default 300x150 fallback size, or 0x0 if the
  // container itself never rendered at all).
  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);

  expect(pageErrors).toEqual([]);

  // Confirms real pixels were actually drawn, not just a correctly-sized
  // but entirely blank/transparent canvas. Polled via `toPass()`, same
  // pattern as resize.spec.ts's own real, passing check, since canvas
  // sizing still depends on the browser's own layout pass completing
  // first.
  await expect(async () => {
    const hasNonBlankPixel = await canvas.evaluate((el: HTMLCanvasElement) => {
      const ctx = el.getContext('2d')!;
      const { data } = ctx.getImageData(0, 0, el.width, el.height);
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0) return true; // any non-zero alpha channel
      }
      return false;
    });
    expect(hasNonBlankPixel).toBe(true);
  }).toPass({ timeout: 5000 });
});
