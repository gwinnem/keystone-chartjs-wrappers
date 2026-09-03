import { test, expect } from '@playwright/test';

// Every other test suite in this monorepo mocks chartjs-plugin-zoom
// entirely — this is the first and only place the real plugin's own
// registration actually gets exercised against a real Chart.js instance
// in a real browser.
test('registers and renders a real chart with chartjs-plugin-zoom applied via the real package', async ({ page }) => {
  // Only genuine uncaught JS exceptions, not the browser's own
  // `console` 'error' channel — see sankey.spec.ts's own comment for
  // why (harmless favicon-404 noise unrelated to this app's own
  // correctness).
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/tests/e2e/fixtures/zoom-fixture.html');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(0);

  expect(pageErrors).toEqual([]);
});
