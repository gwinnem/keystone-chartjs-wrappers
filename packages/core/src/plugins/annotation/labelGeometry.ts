/**
 * Label geometry/measurement helpers, faithfully ported from
 * `chartjs-plugin-annotation` (v3.1.0, MIT) \u2014 real source dissected
 * directly from the installed package's own real, unminified ESM
 * build. See `geometry.ts`'s own header comment for the full
 * dissection rationale.
 */
import { isArray, isFunction, isObject, callback, defined, toFont, valueOrDefault } from 'chart.js/helpers';
import type { Chart, FontSpec } from 'chart.js';
import { getRelativePosition } from './geometry.js';

export interface LabelPositionObject {
  x?: number | string;
  y?: number | string;
}

/** Resolves a real `position` option \u2014 either a single value applied
 * to both axes, or a real `{x, y}` object giving each axis its own
 * independent position. */
export function toPosition(value: LabelPositionObject | number | string | undefined, defaultValue: number | string = 'center'): { x: number | string; y: number | string } {
  if (isObject(value)) {
    const obj = value as LabelPositionObject;
    return { x: valueOrDefault(obj.x, defaultValue), y: valueOrDefault(obj.y, defaultValue) };
  }
  const resolved = valueOrDefault(value, defaultValue);
  return { x: resolved, y: resolved };
}

export function calculateTextAlignment(size: { x: number; width: number }, options: { textAlign: string }): number {
  const { x, width } = size;
  const textAlign = options.textAlign;
  if (textAlign === 'center') return x + width / 2;
  if (textAlign === 'end' || textAlign === 'right') return x + width;
  return x;
}

interface MeasureLabelRectangleOptions {
  borderWidth: number;
  position: LabelPositionObject | number | string | undefined;
  xAdjust: number;
  yAdjust: number;
}

function calculateLabelPosition(start: number, size: number, adjust = 0, position: number | string | undefined): number {
  return start - getRelativePosition(size, position) + adjust;
}

/** Resolves a label's own real `{x, y, x2, y2, width, height, centerX,
 * centerY}` rectangle from an anchor `point`, its own measured
 * `labelSize`, and real position/adjust/border/padding config \u2014 shared
 * by every element type whose own label is anchored to a single point
 * (box/ellipse's `resolveBoxAndLabelProperties`, doughnutLabel). */
export function measureLabelRectangle(
  point: { x: number; y: number },
  labelSize: { width: number; height: number },
  { borderWidth, position, xAdjust, yAdjust }: MeasureLabelRectangleOptions,
  padding?: { width: number; height: number },
): { x: number; y: number; x2: number; y2: number; width: number; height: number; centerX: number; centerY: number } {
  const hasPadding = isObject(padding);
  const width = labelSize.width + (hasPadding ? padding!.width : 0) + borderWidth;
  const height = labelSize.height + (hasPadding ? padding!.height : 0) + borderWidth;
  const positionObj = toPosition(position);
  const x = calculateLabelPosition(point.x, width, xAdjust, positionObj.x);
  const y = calculateLabelPosition(point.y, height, yAdjust, positionObj.y);
  return { x, y, x2: x + width, y2: y + height, width, height, centerX: x + width / 2, centerY: y + height / 2 };
}

/** `true` once `autoFit` is on and the real content-to-box ratio is
 * genuinely below 1 (i.e. the label's own natural size doesn't fit) \u2014
 * gates the real font-shrinking path in `toFonts()` below and the
 * doughnut-label element's own real `_fitRatio`-aware draw. */
export const shouldFit = (options: { autoFit?: boolean } | undefined, fitRatio: number): boolean => !!(options && options.autoFit && fitRatio < 1);

/** Resolves a label's own real font(s) (a label can have one font per
 * real text line via an array) \u2014 shrinking every font's own real
 * `size` proportionally by `fitRatio` when `shouldFit()` is true,
 * keeping each font's own real `lineHeight` untouched (confirmed real
 * behavior: only `size` shrinks, not line spacing). */
export function toFonts(options: { font: Partial<FontSpec> | Partial<FontSpec>[]; autoFit?: boolean }, fitRatio = 1): FontSpec[] {
  const optFont = options.font;
  const fonts = isArray(optFont) ? optFont : [optFont];
  if (shouldFit(options, fitRatio)) {
    return fonts.map((f) => {
      const font = toFont(f);
      font.size = Math.floor((f.size as number) * fitRatio);
      font.lineHeight = f.lineHeight as never;
      return toFont(font);
    });
  }
  return fonts.map((f) => toFont(f));
}

/** `true` when the element is bound to a single chart-space point
 * (`xValue`/`yValue` set) rather than a box/line range \u2014 point and
 * polygon annotations support both real binding modes. */
export function isBoundToPoint(options: { xValue?: unknown; yValue?: unknown } | undefined): boolean {
  return !!(options && (defined(options.xValue) || defined(options.yValue)));
}

// ---- init-animation resolution ----

type InitAnimationProperties = Record<string, unknown>;

function boxAppering(x: number, y: number): Record<string, number> {
  return { x, y, x2: x, y2: y, width: 0, height: 0 };
}

/** The real, per-type "appear from nothing" shape used when `init:
 * true` \u2014 a box/label/line/doughnutLabel/polygon starts as a
 * zero-size box at its own real center; a point/ellipse starts as a
 * zero-radius circle at its own real center. Confirmed real, distinct
 * per-type shapes, not a single generic default. */
export const defaultInitAnimation: Record<string, (properties: Record<string, number>) => Record<string, number>> = {
  box: (properties) => boxAppering(properties.centerX, properties.centerY),
  doughnutLabel: (properties) => boxAppering(properties.centerX, properties.centerY),
  ellipse: (properties) => ({ centerX: properties.centerX, centerY: properties.centerX, radius: 0, width: 0, height: 0 }),
  label: (properties) => boxAppering(properties.centerX, properties.centerY),
  line: (properties) => boxAppering(properties.x, properties.y),
  point: (properties) => ({ centerX: properties.centerX, centerY: properties.centerY, radius: 0, width: 0, height: 0 }),
  polygon: (properties) => boxAppering(properties.centerX, properties.centerY),
};

function applyDefault(properties: Record<string, number>, options: { type?: string }): Record<string, number> {
  const type = options.type || 'line';
  return defaultInitAnimation[type](properties);
}

function execCallback(chart: Chart, properties: Record<string, number>, options: { init?: unknown; type?: string }): InitAnimationProperties | undefined {
  const result = callback(options.init as never, [{ chart, properties, options }]);
  if (result === true) return applyDefault(properties, options);
  if (isObject(result)) return result as InitAnimationProperties;
  return undefined;
}

/** Resolves the real initial-appearance properties for a *newly
 * created* annotation element \u2014 `init: true` uses the real per-type
 * default above; `init` as a function can return `true` (same
 * default) or a real custom properties object of its own; `init`
 * falsy/absent skips animation entirely (the element appears at its
 * own real final position immediately). */
export function initAnimationProperties(chart: Chart, properties: Record<string, number>, options: { init?: unknown; type?: string }): InitAnimationProperties | undefined {
  const initAnim = options.init;
  if (!initAnim) return undefined;
  if (initAnim === true) return applyDefault(properties, options);
  return execCallback(chart, properties, options);
}

/** Real per-hook "does this options object define a real function for
 * this hook name" loader, shared by both event-listener wiring
 * (`click`/`enter`/`leave`) and draw-hook wiring (`beforeDraw`/
 * `afterDraw`) \u2014 mutates `hooksContainer` in place, removing a
 * previously-set hook that's no longer defined (confirmed real
 * cleanup, not just additive registration). */
export function loadHooks(options: Record<string, unknown>, hooks: string[], hooksContainer: Record<string, unknown>): boolean {
  let activated = false;
  hooks.forEach((hook) => {
    if (isFunction(options[hook])) {
      activated = true;
      hooksContainer[hook] = options[hook];
    } else if (defined(hooksContainer[hook])) {
      delete hooksContainer[hook];
    }
  });
  return activated;
}
