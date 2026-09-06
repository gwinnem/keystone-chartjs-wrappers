import { test, expect } from '@playwright/test';

// The real ResizeObserver-driven resize path createChartController wires
// up (packages/core/src/controller.ts) — jsdom has no real layout engine
// at all, so this is the only way to actually prove a canvas genuinely
// resizes when its container does, rather than trusting the wiring
// alone.
test('canvas resizes when its container does, via the real ResizeObserver path', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.goto('/tests/e2e/fixtures/resize-fixture.html');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const before = await canvas.boundingBox();

  await page.setViewportSize({ width: 400, height: 600 });
  // ResizeObserver callbacks fire asynchronously (a real browser task,
  // not a synchronous layout pass) — poll rather than assert immediately.
  await expect(async () => {
    const after = await canvas.boundingBox();
    expect(after!.width).toBeLessThan(before!.width);
  }).toPass({ timeout: 5000 });
});
