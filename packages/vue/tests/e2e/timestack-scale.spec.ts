import { test, expect } from '@playwright/test';
import { expectNonBlankCanvas } from './helpers/expectNonBlankCanvas.js';

// Real chartjs-scale-timestack registration, not mocked — see
// timestack-fixture.ts's own header comment for the full rationale.
// Confirms the scale is genuinely registered and Chart.js can render
// with it (a missing/failed registration would surface as Chart.js
// throwing "timestack is not a registered scale" and the chart never
// painting at all).
test('renders a real chart with the chartjs-scale-timestack axis applied via the real package', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/tests/e2e/fixtures/timestack-fixture.html');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);

  expect(pageErrors).toEqual([]);

  await expectNonBlankCanvas(canvas);
});
