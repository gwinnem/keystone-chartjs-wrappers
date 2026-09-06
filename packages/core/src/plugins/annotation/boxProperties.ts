/**
 * Real box-model / scale-coordinate resolution, faithfully ported from
 * `chartjs-plugin-annotation` (v3.1.0, MIT) \u2014 real source dissected
 * directly from the installed package's own real, unminified ESM
 * build. See `geometry.ts`'s own header comment for the full
 * dissection rationale.
 *
 * Shared by every element type's own real `resolveElementProperties()`
 * \u2014 resolves a real chart-space rectangle/point/circle from an
 * annotation's own `xMin`/`xMax`/`xValue`/`scaleID`/etc. options
 * against the chart's own real, current scales.
 */
import { toPadding } from 'chart.js/helpers';
import type { Chart, Scale } from 'chart.js';
import { isFinite as chartIsFinite, measureLabelSize } from './drawing.js';
import { getRelativePosition } from './geometry.js';
import { initAnimationProperties, isBoundToPoint, toPosition } from './labelGeometry.js';

export interface AnnotationBoxModel {
  x?: number;
  y?: number;
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  centerX?: number;
  centerY?: number;
  radius?: number;
  [key: string]: unknown;
}

export interface ScaleOptionsLike {
  scaleID?: string;
  xScaleID?: string;
  yScaleID?: string;
  xMin?: unknown;
  xMax?: unknown;
  xValue?: unknown;
  yMin?: unknown;
  yMax?: unknown;
  yValue?: unknown;
  radius?: number;
  xAdjust?: number;
  yAdjust?: number;
  init?: unknown;
  type?: string;
  label?: Record<string, unknown>;
}

const limitedLineScale = {
  xScaleID: { min: 'xMin', max: 'xMax', start: 'left', end: 'right', startProp: 'x', endProp: 'x2' },
  yScaleID: { min: 'yMin', max: 'yMax', start: 'bottom', end: 'top', startProp: 'y', endProp: 'y2' },
} as const;

function scaleValue(scale: Scale, value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : (scale.parse(value as never) as number);
  return chartIsFinite(parsed) ? scale.getPixelForValue(parsed) : fallback;
}

/**
 * Resolves which real scale ID an annotation's own option key refers
 * to \u2014 falls back to searching the chart's own real scales for one
 * whose own `axis` matches the key's own leading letter (`x`/`y`) when
 * no explicit scale ID is set, so `xMin`/`xMax` etc. work without a
 * consumer ever having to name their own `x`/`y` scale explicitly.
 */
export function retrieveScaleID(scales: Record<string, Scale>, options: ScaleOptionsLike, key: 'scaleID' | 'xScaleID' | 'yScaleID'): string {
  const scaleID = options[key];
  if (scaleID || key === 'scaleID') return scaleID as string;
  const axis = key.charAt(0);
  const axes = Object.values(scales).filter((scale) => (scale as unknown as { axis?: string }).axis === axis);
  if (axes.length) return axes[0].id;
  return axis;
}

function getDimensionByScale(scale: Scale | undefined, options: { min: unknown; max: unknown; start: number; end: number }): { start: number; end: number } | undefined {
  if (scale) {
    const reverse = (scale.options as unknown as { reverse?: boolean }).reverse;
    const start = scaleValue(scale, options.min, reverse ? options.end : options.start);
    const end = scaleValue(scale, options.max, reverse ? options.start : options.end);
    return { start, end };
  }
  return undefined;
}

/** The real chart-space point a point-bound annotation
 * (`xValue`/`yValue`) resolves to \u2014 falls back to the chart area's
 * own real center on whichever axis has no matching scale at all. */
export function getChartPoint(chart: Chart, options: ScaleOptionsLike): { x: number; y: number } {
  const { chartArea, scales } = chart;
  const xScale = scales[retrieveScaleID(scales, options, 'xScaleID')];
  const yScale = scales[retrieveScaleID(scales, options, 'yScaleID')];
  let x = chartArea.width / 2;
  let y = chartArea.height / 2;

  if (xScale) x = scaleValue(xScale, options.xValue, xScale.left + xScale.width / 2);
  if (yScale) y = scaleValue(yScale, options.yValue, yScale.top + yScale.height / 2);
  return { x, y };
}

function getChartDimensionByScale(scale: Scale | undefined, options: { min: unknown; max: unknown; start: number; end: number }): { start: number; end: number } {
  const result = getDimensionByScale(scale, options) ?? options;
  return { start: Math.min(result.start, result.end), end: Math.max(result.start, result.end) };
}

/** Resolves a real box-shaped annotation's own `{x, y, x2, y2, width,
 * height, centerX, centerY}` from its own `xMin`/`xMax`/`yMin`/`yMax`
 * against the chart's own real scales \u2014 falls back to the chart
 * area's own real edges on whichever axis has no matching scale.
 * Returns `{}` when *neither* axis has a real matching scale at all
 * (nothing meaningful to draw). */
export function resolveBoxProperties(chart: Chart, options: ScaleOptionsLike): AnnotationBoxModel {
  const scales = chart.scales;
  const xScale = scales[retrieveScaleID(scales, options, 'xScaleID')];
  const yScale = scales[retrieveScaleID(scales, options, 'yScaleID')];

  if (!xScale && !yScale) return {};

  let { left: x, right: x2 } = xScale ?? chart.chartArea;
  let { top: y, bottom: y2 } = yScale ?? chart.chartArea;
  const xDim = getChartDimensionByScale(xScale, { min: options.xMin, max: options.xMax, start: x, end: x2 });
  x = xDim.start;
  x2 = xDim.end;
  const yDim = getChartDimensionByScale(yScale, { min: options.yMin, max: options.yMax, start: y2, end: y });
  y = yDim.start;
  y2 = yDim.end;

  return { x, y, x2, y2, width: x2 - x, height: y2 - y, centerX: x + (x2 - x) / 2, centerY: y + (y2 - y) / 2 };
}

function getChartCircle(chart: Chart, options: ScaleOptionsLike): AnnotationBoxModel {
  const point = getChartPoint(chart, options);
  const radius = options.radius!;
  const size = radius * 2;
  const xAdjust = options.xAdjust ?? 0;
  const yAdjust = options.yAdjust ?? 0;
  return {
    x: point.x - radius + xAdjust,
    y: point.y - radius + yAdjust,
    x2: point.x + radius + xAdjust,
    y2: point.y + radius + yAdjust,
    centerX: point.x + xAdjust,
    centerY: point.y + yAdjust,
    radius,
    width: size,
    height: size,
  };
}

/** Resolves a real point/polygon-shaped annotation's own circle \u2014
 * either box-space (radius auto-derived from a resolved box's own
 * smaller dimension, when not point-bound) or a real, direct chart-
 * point circle (when `xValue`/`yValue`-bound). */
export function resolvePointProperties(chart: Chart, options: ScaleOptionsLike): AnnotationBoxModel {
  if (!isBoundToPoint(options)) {
    const box = resolveBoxProperties(chart, options);
    let radius = options.radius;
    if (!radius || isNaN(radius)) {
      radius = Math.min(box.width!, box.height!) / 2;
      options.radius = radius;
    }
    const size = radius * 2;
    const adjustCenterX = box.centerX! + (options.xAdjust ?? 0);
    const adjustCenterY = box.centerY! + (options.yAdjust ?? 0);
    return {
      x: adjustCenterX - radius,
      y: adjustCenterY - radius,
      x2: adjustCenterX + radius,
      y2: adjustCenterY + radius,
      centerX: adjustCenterX,
      centerY: adjustCenterY,
      width: size,
      height: size,
      radius,
    };
  }
  return getChartCircle(chart, options);
}

function resolveFullLineProperties(scale: Scale, area: { x: number; y: number; x2: number; y2: number }, options: { value: unknown; endValue: unknown }): void {
  const min = scaleValue(scale, options.value, NaN);
  const max = scaleValue(scale, options.endValue, min);
  if (scale.isHorizontal()) {
    area.x = min;
    area.x2 = max;
  } else {
    area.y = min;
    area.y2 = max;
  }
}

function resolveLimitedLineProperties(scales: Record<string, Scale>, area: Record<string, number>, options: ScaleOptionsLike): void {
  for (const scaleId of Object.keys(limitedLineScale) as (keyof typeof limitedLineScale)[]) {
    const scale = scales[retrieveScaleID(scales, options, scaleId)];
    if (scale) {
      const { min, max, start, end, startProp, endProp } = limitedLineScale[scaleId];
      const dim = getDimensionByScale(scale, {
        min: (options as unknown as Record<string, unknown>)[min],
        max: (options as unknown as Record<string, unknown>)[max],
        start: (scale as unknown as Record<string, number>)[start],
        end: (scale as unknown as Record<string, number>)[end],
      })!;
      area[startProp] = dim.start;
      area[endProp] = dim.end;
    }
  }
}

/** Resolves a real, scale-bound line's own `{x, y, x2, y2}` \u2014 a full
 * cross-chart line along a single named `scaleID` (extending the full
 * width/height of the chart area on the *other* axis), or, with no
 * `scaleID` at all, a line limited to whichever of `xMin`/`xMax`/
 * `yMin`/`yMax` are actually set against each axis independently. */
export function resolveLineProperties(chart: Chart, options: ScaleOptionsLike & { scaleID?: string }): { x: number; y: number; x2: number; y2: number } {
  const { scales, chartArea } = chart;
  const scale = scales[options.scaleID as string];
  const area = { x: chartArea.left, y: chartArea.top, x2: chartArea.right, y2: chartArea.bottom };

  if (scale) {
    resolveFullLineProperties(scale, area, options as never);
  } else {
    resolveLimitedLineProperties(scales, area as never, options);
  }
  return area;
}

function calculateX({ properties, options }: { properties: AnnotationBoxModel; options: { borderWidth: number; label: { xAdjust: number } } }, labelSize: { width: number }, position: { x: number | string }, padding: { left: number; right: number }): number {
  const { x: start, x2: end, width: size } = properties;
  return calculatePosition({ start: start!, end: end!, size: size!, borderWidth: options.borderWidth }, { position: position.x, padding: { start: padding.left, end: padding.right }, adjust: options.label.xAdjust, size: labelSize.width });
}

function calculateY({ properties, options }: { properties: AnnotationBoxModel; options: { borderWidth: number; label: { yAdjust: number } } }, labelSize: { height: number }, position: { y: number | string }, padding: { top: number; bottom: number }): number {
  const { y: start, y2: end, height: size } = properties;
  return calculatePosition({ start: start!, end: end!, size: size!, borderWidth: options.borderWidth }, { position: position.y, padding: { start: padding.top, end: padding.bottom }, adjust: options.label.yAdjust, size: labelSize.height });
}

function calculatePosition(
  boxOpts: { start: number; end: number; size: number; borderWidth: number },
  labelOpts: { position: number | string | undefined; padding: { start: number; end: number }; adjust: number; size: number },
): number {
  const { start, end, borderWidth } = boxOpts;
  const {
    position,
    padding: { start: padStart, end: padEnd },
    adjust,
  } = labelOpts;
  const availableSize = end - borderWidth - start - padStart - padEnd - labelOpts.size;
  return start + borderWidth / 2 + adjust + getRelativePosition(availableSize, position);
}

/** Resolves a box/ellipse annotation's own single, centered label \u2014
 * the label's own `backgroundColor`/`callout.display` are force-reset
 * (a box/ellipse label is drawn as plain text over the parent shape's
 * own real background, not its own separate box). */
export function resolveBoxLabelElementProperties(chart: Chart, properties: AnnotationBoxModel, options: { label: Record<string, unknown> & { position?: unknown; padding?: unknown; xAdjust?: number; yAdjust?: number; rotation?: number }; borderWidth: number }): AnnotationBoxModel {
  const label = options.label as Record<string, unknown> & { backgroundColor?: string; callout?: { display?: boolean }; position?: unknown; padding?: unknown; xAdjust?: number; yAdjust?: number; rotation?: number };
  label.backgroundColor = 'transparent';
  label.callout!.display = false;
  const position = toPosition(label.position as never);
  const padding = toPadding(label.padding as never);
  const labelSize = measureLabelSize(chart.ctx as never, label as never);
  const x = calculateX({ properties, options: options as never }, labelSize, position as never, padding as never);
  const y = calculateY({ properties, options: options as never }, labelSize, position as never, padding as never);
  const width = labelSize.width + padding.width;
  const height = labelSize.height + padding.height;
  return { x, y, x2: x + width, y2: y + height, width, height, centerX: x + width / 2, centerY: y + height / 2, rotation: label.rotation };
}

/** Resolves a box/ellipse annotation's own real box plus its own
 * single sub-element label \u2014 shared by `BoxAnnotation`/
 * `EllipseAnnotation`, both of which support exactly one, centered
 * label. */
export function resolveBoxAndLabelProperties(chart: Chart, options: ScaleOptionsLike & { borderWidth: number; label: Record<string, unknown> }): AnnotationBoxModel {
  const properties = resolveBoxProperties(chart, options);
  properties.initProperties = initAnimationProperties(chart, properties as never, options as never);
  properties.elements = [
    {
      type: 'label',
      optionScope: 'label',
      properties: resolveBoxLabelElementProperties(chart, properties, options as never),
      initProperties: properties.initProperties,
    },
  ];
  return properties;
}
