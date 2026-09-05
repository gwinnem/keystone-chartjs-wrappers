import { test, expect } from '@playwright/test';
import { expectNonBlankCanvas } from './helpers/expectNonBlankCanvas.js';

// Local port (deferredPlugin.ts), not a dependency — same rationale as
// gradient-plugin.spec.ts's own header comment. The canvas starts below
// the fold (a tall spacer div in the fixture) and only scrolls into
// view partway through this test, so the real plugin's own real
// scroll-event-driven defer (confirmed directly from the installed
// package's own real source during the port — NOT IntersectionObserver-
// based, a correction from an earlier draft of this comment) has
// something genuine to defer past, not just a chart that was always
// visible.
test('renders a real chart with the local deferred-plugin port applied, once scrolled into the viewport', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/tests/e2e/fixtures/deferred-fixture.html');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeAttached();

  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);

  expect(pageErrors).toEqual([]);

  // Scroll the canvas into view — the real plugin's own scroll-event
  // listener (on the document, since no explicit scrollable ancestor
  // is configured in this fixture) should now trigger the deferred
  // initial update, plus its own configured 100ms delay.
  await canvas.scrollIntoViewIfNeeded();

  await expectNonBlankCanvas(canvas);
});
