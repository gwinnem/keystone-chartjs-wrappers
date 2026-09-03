import { test, expect } from '@playwright/test';
import { expectNonBlankCanvas } from './helpers/expectNonBlankCanvas.js';

// Real canvas 2D rendering for a built-in kind — see bar-chart.spec.ts's
// own header comment for why this tier exists (jsdom has no real canvas
// at all, so Vitest's own component tests structurally can't prove
// this).
test('renders a real line chart with actual non-blank pixels', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/tests/e2e/fixtures/line-chart-fixture.html');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);

  expect(pageErrors).toEqual([]);

  await expectNonBlankCanvas(canvas);
});
