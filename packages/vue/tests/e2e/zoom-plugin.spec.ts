import { test, expect } from '@playwright/test';

// The zoom fixture exposes the live Chart.js instance on `window` (not
// reachable from the DOM canvas element directly — only via Chart.vue's
// own `defineExpose({ chart })`), so this test can call its real,
// programmatic `getZoomLevel()` API. A real, narrow type for that one
// custom global instead of `(window as any)`.
interface WindowWithZoomChart extends Window {
  __zoomChart?: { getZoomLevel?: () => number };
}

// This project's own local port of chartjs-plugin-zoom
// (packages/core/src/zoomPlugin.ts) is otherwise only ever exercised
// against jsdom mocks (packages/core/tests/unit/zoomPlugin.spec.ts) —
// this is the one place it runs through the real build pipeline, in a
// real browser, against a real Chart.js instance.
test('registers and renders a real chart with the local zoom plugin applied, and wheel-zoom actually works', async ({
  page,
}) => {
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

  // A real, genuine wheel-zoom check, not just "did it render" — the
  // programmatic API attached by zoomPlugin.ts's own `start()` hook
  // (`chart.getZoomLevel()`) confirms the real DOM wheel-event listener
  // this port wires up actually changed the chart's own zoom state,
  // not just that the plugin object was accepted without erroring.
  // `window.__zoomChart` is exposed by the fixture itself, since the
  // Chart.js instance carrying this API isn't reachable from the DOM
  // canvas element directly — only via Chart.vue's own
  // `defineExpose({ chart })`.
  const zoomLevelBefore = await page.evaluate(() =>
    (window as WindowWithZoomChart).__zoomChart?.getZoomLevel?.(),
  );
  expect(zoomLevelBefore).toBe(1);

  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(200);

  const zoomLevelAfter = await page.evaluate(() =>
    (window as WindowWithZoomChart).__zoomChart?.getZoomLevel?.(),
  );
  expect(zoomLevelAfter).not.toBe(1);

  expect(pageErrors).toEqual([]);
});
