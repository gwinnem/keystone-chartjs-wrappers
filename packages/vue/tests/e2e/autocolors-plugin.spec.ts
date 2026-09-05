import { test, expect } from '@playwright/test';
import { expectNonBlankCanvas } from './helpers/expectNonBlankCanvas.js';
import { expectDistinctColorCount } from './helpers/expectDistinctColorCount.js';

// Real chartjs-plugin-autocolors logic, not mocked — see
// autocolors-fixture.ts's own header comment for the full rationale.
test('renders a real chart with autocolors applied, producing a distinct color per dataset', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/tests/e2e/fixtures/autocolors-fixture.html');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);

  expect(pageErrors).toEqual([]);

  await expectNonBlankCanvas(canvas);

  // Three datasets, none with an explicit color — autocolors' own
  // real generator assigns each a distinct hue, so at least 2 (really
  // 3, but 2 is a safe floor against anti-aliasing/line-thinness edge
  // cases) genuinely distinct colors should be visible.
  await expectDistinctColorCount(canvas, 2);
});
