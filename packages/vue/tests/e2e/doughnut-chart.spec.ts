import { test, expect } from '@playwright/test';
import { expectNonBlankCanvas } from './helpers/expectNonBlankCanvas.js';

test('renders a real doughnut chart with actual non-blank pixels', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/tests/e2e/fixtures/doughnut-chart-fixture.html');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);

  expect(pageErrors).toEqual([]);

  await expectNonBlankCanvas(canvas);
});
