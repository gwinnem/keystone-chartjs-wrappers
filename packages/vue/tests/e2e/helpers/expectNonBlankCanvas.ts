import { expect, type Locator } from '@playwright/test';

// Shared by every built-in-chart-kind e2e spec (except bar-chart.spec.ts,
// which predates this helper and is left untouched — already passing,
// no reason to risk it for a refactor-only change). Confirms a canvas
// locator has real, non-blank pixels drawn into it, not just a
// correctly-sized but empty backing buffer. Polled via `toPass()` since
// canvas sizing depends on the browser's own layout pass completing
// first, even though every fixture leaves Chart.js's own animation at
// its default (see bar-chart-fixture.ts's own header comment for why
// disabling it was tried and reverted).
export async function expectNonBlankCanvas(canvas: Locator): Promise<void> {
  await expect(async () => {
    const hasNonBlankPixel = await canvas.evaluate((el: HTMLCanvasElement) => {
      const ctx = el.getContext('2d')!;
      const { data } = ctx.getImageData(0, 0, el.width, el.height);
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0) return true; // any non-zero alpha channel
      }
      return false;
    });
    expect(hasNonBlankPixel).toBe(true);
  }).toPass({ timeout: 5000 });
}
