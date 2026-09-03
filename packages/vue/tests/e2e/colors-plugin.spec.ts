import { test, expect } from '@playwright/test';
import { expectDistinctColorCount } from './helpers/expectDistinctColorCount.js';

// Real Chart.js Colors plugin, not mocked — see colors-plugin-fixture.ts's
// own header comment for the full rationale. Confirms both that the
// plugin auto-colors by default (no config needed) AND the specific
// forceOverride regression found via a live manual browser test: a
// dataset added after the chart's first render must still get colored.
test('auto-colors datasets with no explicit color, including one added after the chart already exists', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto('/tests/e2e/fixtures/colors-plugin-fixture.html');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();

  expect(pageErrors).toEqual([]);

  // 3 distinct dataset colors: the fixture's own initial 2 datasets,
  // plus the 3rd one added ~200ms after mount. Without
  // `forceOverride: true`, only 2 would ever appear — the real bug
  // this test guards against.
  await expectDistinctColorCount(canvas, 3);
});
