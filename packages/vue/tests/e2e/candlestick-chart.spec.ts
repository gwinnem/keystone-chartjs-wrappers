import { test, expect } from '@playwright/test';
import { expectNonBlankCanvas } from './helpers/expectNonBlankCanvas.js';

// Real extension-package registration: chartjs-chart-financial, not
// mocked — the first place a version mismatch or renamed export (the
// exact risk registry.ts's own error message warns about) would surface
// as a real failure, matching sankey.spec.ts's own rationale.
//
// Previously test.fixme'd due to a real, now-fixed dev-server-specific
// limitation: registry.ts's own dynamic import used a variable
// specifier (`entry.packageName`), which no bundler's static crawler
// could ever discover, regardless of configuration — confirmed broken
// via an extensive investigation (see docs/IMPLEMENTATION_PLAN.md's own
// "Current status & open issues" item #2 for the full history). Fixed
// by rewriting that import to use static, literal `import()` calls per
// kind instead.
test('renders a real candlestick chart with actual non-blank pixels', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/tests/e2e/fixtures/candlestick-chart-fixture.html');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);

  expect(pageErrors).toEqual([]);

  await expectNonBlankCanvas(canvas);
});
