/**
 * Small, shared utility functions, faithfully ported from
 * `chartjs-plugin-datalabels` (v2.2.0, MIT, chartjs-plugin-datalabels
 * contributors) \u2014 real source dissected directly from the installed
 * package's own real, unminified ESM build
 * (`dist/chartjs-plugin-datalabels.esm.js` \u2014 the published package
 * ships no real `src/` of its own, only `dist/*`/`types/*`, but the ESM
 * build is genuinely unminified and complete, making a precise,
 * line-by-line dissection possible here the same way the installed
 * `dist` output already was for `gradient`/`autocolors`).
 */

/** `window.devicePixelRatio`, with the original's own real IE10
 * fallback (`screen.deviceXDPI / screen.logicalXDPI`, confirmed via the
 * original's own cited upstream issues) \u2014 `1` outside a browser
 * context (e.g. this project's own jsdom test environment, which has
 * no `devicePixelRatio` of its own). Computed once, at module load,
 * matching the original's own real IIFE \u2014 not recomputed per call, a
 * faithful carry-over of the original's own design rather than a
 * "more correct" behavior change this port didn't confirm was actually
 * needed. */
const devicePixelRatio: number = (function computeDevicePixelRatio(): number {
  if (typeof window !== 'undefined') {
    if (window.devicePixelRatio) return window.devicePixelRatio;
    const screen = window.screen as unknown as { deviceXDPI?: number; logicalXDPI?: number } | undefined;
    if (screen) return (screen.deviceXDPI ?? 1) / (screen.logicalXDPI ?? 1);
  }
  return 1;
})();

/** Flattens a real label value (a string, a nested array of strings, or
 * any other value the consumer's own `formatter` returned) into a real
 * array of text lines, splitting on `\n` \u2014 the original's own real,
 * recursive flattening logic, unchanged. */
export function toTextLines(input: unknown): string[] {
  const lines: string[] = [];
  const inputs: unknown[] = ([] as unknown[]).concat(input as never);
  while (inputs.length) {
    const item = inputs.pop();
    if (typeof item === 'string') {
      lines.unshift(...item.split('\n'));
    } else if (Array.isArray(item)) {
      inputs.push(...item);
    } else if (item != null) {
      lines.unshift(`${item}`);
    }
  }
  return lines;
}

/** Measures the real, widest line's own pixel width (via a real
 * `measureText` call, temporarily swapping in the label's own font)
 * and the real total block height (`lines.length * font.lineHeight`). */
export function textSize(ctx: CanvasRenderingContext2D, lines: string[], font: { string: string; lineHeight: number }): { width: number; height: number } {
  const previousFont = ctx.font;
  ctx.font = font.string;
  let width = 0;
  for (const line of lines) {
    width = Math.max(ctx.measureText(line).width, width);
  }
  ctx.font = previousFont;
  return { height: lines.length * font.lineHeight, width };
}

/** Clamps `value` to the real, closed `[min, max]` range. */
export function bound(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/** Diffs two real arrays of active-element references, returning
 * `[value, 1]` for every entry newly present in `next` and `[value,
 * -1]` for every entry that dropped out of `previous` \u2014 the original's
 * own real active-elements diffing logic (used to detect real hover
 * enter/exit), unchanged. */
export function arrayDiff<T>(previous: T[], next: T[]): [T, 1 | -1][] {
  const remaining = previous.slice();
  const updates: [T, 1 | -1][] = [];
  for (const value of next) {
    const index = remaining.indexOf(value);
    if (index === -1) {
      updates.push([value, 1]);
    } else {
      remaining.splice(index, 1);
    }
  }
  for (const value of remaining) {
    updates.push([value, -1]);
  }
  return updates;
}

/** Rounds `v` to the nearest real device pixel \u2014 a real, confirmed fix
 * for sub-pixel text/line blurring on high-DPI displays (see the
 * original's own cited issue #70), not something this port added. */
export function rasterize(v: number): number {
  return Math.round(v * devicePixelRatio) / devicePixelRatio;
}
