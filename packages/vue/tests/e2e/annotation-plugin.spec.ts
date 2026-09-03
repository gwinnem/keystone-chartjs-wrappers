import { test, expect } from '@playwright/test';
import { expectNonBlankCanvas } from './helpers/expectNonBlankCanvas.js';

// Real chartjs-plugin-annotation registration, not mocked — same
// rationale as zoom-plugin.spec.ts's own header comment (the first
// place a version mismatch or renamed export would surface as a real
// failure).
test('renders a real chart with chartjs-plugin-annotation applied via the real package', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/tests/e2e/fixtures/annotation-fixture.html');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);

  expect(pageErrors).toEqual([]);

  await expectNonBlankCanvas(canvas);
});
