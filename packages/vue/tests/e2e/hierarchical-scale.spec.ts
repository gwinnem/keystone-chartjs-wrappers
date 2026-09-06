import { test, expect } from '@playwright/test';
import { expectNonBlankCanvas } from './helpers/expectNonBlankCanvas.js';

// Real, local HierarchicalScale registration, not mocked — see
// hierarchical-fixture.ts's own header comment for the full rationale.
// Confirms the scale is genuinely registered (via Chart.register(
// HierarchicalScale)) and Chart.js can render with it — a missing/
// failed registration would surface as Chart.js throwing "hierarchical
// is not a registered scale" and the chart never painting at all.
test('renders a real chart with the local HierarchicalScale port applied', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/tests/e2e/fixtures/hierarchical-fixture.html');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);

  expect(pageErrors).toEqual([]);

  await expectNonBlankCanvas(canvas);
});

test('clicking an unexpanded top-level label genuinely expands it, visibly changing the rendered chart', async ({
  page,
}) => {
  // The real, core interaction this plugin exists for — confirms the
  // companion plugin's own beforeEvent-driven click handling actually
  // works end-to-end through a real browser click, not just that the
  // scale renders initially. Both '2024' and '2025' start collapsed
  // (the fixture's own real data has no `expand` set), so a real click
  // on either top-level box should splice its own children in and
  // repaint — confirmed here via the canvas's own pixel content
  // genuinely changing, since the axis now shows 4 quarters instead of
  // 1 year label.
  await page.goto('/tests/e2e/fixtures/hierarchical-fixture.html');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  const before = await canvas.screenshot();

  const box = await canvas.boundingBox();
  // The hierarchy expand/collapse boxes are drawn just below the chart
  // area's own bottom edge (default hierarchyLabelPosition/padding,
  // reserved via the fixture's own real layout.padding.bottom) —
  // clicking a few pixels above the very bottom edge, roughly under
  // where the '2024' category's own bar sits, targets its own real
  // expand box without landing exactly on the boundary pixel (the
  // plugin's own real hit-test is a strict `>` on the box's own top
  // edge, so the very last pixel row doesn't count).
  await page.mouse.click(box!.x + box!.width * 0.25, box!.y + box!.height - 15);
  // Chart.js's own real update() (triggered by the plugin's own
  // chart.update() call after a successful expand) redraws
  // asynchronously on the next animation frame — a short, bounded wait
  // rather than an arbitrary sleep, matching this project's own other
  // interaction-driven e2e tests (see zoom-fixture.spec.ts's own
  // identical pattern).
  await page.waitForTimeout(200);

  const after = await canvas.screenshot();
  expect(Buffer.compare(before, after)).not.toBe(0);
});
