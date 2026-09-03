import { expect, type Locator } from '@playwright/test';

// Counts distinct, non-transparent colors actually painted on a canvas,
// filtered to ones covering a real, substantial area — anti-aliased
// edge pixels blend with the background and produce dozens of
// near-identical, low-frequency color variants that would otherwise
// wildly overcount. Confirmed against a real canvas during manual
// verification of the Colors-plugin example (see
// docs/IMPLEMENTATION_PLAN.md's own Phase 6 entry): each of Chart.js's
// own real bar colors showed up tens of thousands of times, while
// anti-aliasing noise never exceeded a few hundred.
//
// Used specifically where `expectNonBlankCanvas` isn't precise enough —
// that helper confirms *some* pixel has color, but can't distinguish
// "1 of 3 datasets got colored" from "all 3 did," which is exactly the
// distinction the Colors-plugin `forceOverride` regression test needs.
export async function expectDistinctColorCount(canvas: Locator, minCount: number): Promise<void> {
  await expect(async () => {
    const colorCount = await canvas.evaluate((el: HTMLCanvasElement) => {
      const ctx = el.getContext('2d')!;
      const { data } = ctx.getImageData(0, 0, el.width, el.height);
      const counts = new Map<string, number>();
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha === 0) continue;
        const key = `${data[i]},${data[i + 1]},${data[i + 2]},${alpha}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      let significant = 0;
      for (const count of counts.values()) {
        if (count > 50) significant++;
      }
      return significant;
    });
    expect(colorCount).toBeGreaterThanOrEqual(minCount);
  }).toPass({ timeout: 5000 });
}
