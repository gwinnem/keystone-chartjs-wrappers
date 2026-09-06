import { test, expect } from '@playwright/test';
import { expectNonBlankCanvas } from './helpers/expectNonBlankCanvas.js';

// Real chartjs-plugin-image-label registration, not mocked — see
// image-label-fixture.ts's own header comment for the full rationale.
// Confirms a real, unmocked doughnut chart with this plugin supplied
// via the inline `plugins` array (not Chart.register) renders
// genuinely non-blank pixels — a missing/failed registration would
// surface as the plugin's own drawing hooks never running, or Chart.js
// throwing on an unrecognized inline plugin object.
test('renders a real doughnut chart with chartjs-plugin-image-label applied via the real package', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/tests/e2e/fixtures/image-label-fixture.html');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);

  expect(pageErrors).toEqual([]);

  await expectNonBlankCanvas(canvas);
});
