import { test, expect } from '@playwright/test';
import { expectNonBlankCanvas } from './helpers/expectNonBlankCanvas.js';
import { expectDistinctColorCount } from './helpers/expectDistinctColorCount.js';

// Real chartjs-plugin-gradient registration, not mocked — see
// gradient-fixture.ts's own header comment for the full rationale.
test('renders a real chart with chartjs-plugin-gradient applied via the real package, producing more than one color', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/tests/e2e/fixtures/gradient-fixture.html');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);

  expect(pageErrors).toEqual([]);

  await expectNonBlankCanvas(canvas);

  // A real gradient, not a single flat color — the fixture's own 5 bars
  // span different heights along an `axis: 'y'` red-to-yellow-to-green
  // gradient, so at least 2 genuinely distinct color stops should be
  // visible across them.
  await expectDistinctColorCount(canvas, 2);
});
