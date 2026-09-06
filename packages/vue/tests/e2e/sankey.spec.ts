import { test, expect } from '@playwright/test';

// Every other test suite in this monorepo mocks chartjs-chart-sankey
// entirely — this is the first and only place the real package's own
// real export names/registration actually get exercised end-to-end,
// against a real Chart.js instance in a real browser. A version
// mismatch or renamed export (the exact risk registry.ts's own error
// message warns about) would surface here as a real, visible failure,
// not a passing mocked test.
test('registers and renders a real sankey chart via the real chartjs-chart-sankey package', async ({
  page,
}) => {
  // Only genuine uncaught JS exceptions, not the browser's own
  // `console` 'error' channel — confirmed via a real run that the
  // latter includes harmless resource-loading noise unrelated to this
  // app's own correctness (the browser's automatic, favicon-less
  // `/favicon.ico` request logs a 404 there on every page load, since
  // these minimal fixtures define no favicon at all). `pageerror` fires
  // only for real, uncaught runtime errors, which is what actually
  // matters here.
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/tests/e2e/fixtures/sankey-fixture.html');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(0);

  expect(pageErrors).toEqual([]);
});
