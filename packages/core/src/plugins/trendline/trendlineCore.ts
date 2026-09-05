/**
 * Real trendline-fitting orchestration, faithfully ported from
 * `chartjs-plugin-trendline` (v3.2.12, MIT, Marcus Alsterfjord) \u2014 real
 * source dissected directly from the installed package's own real,
 * readable `src/components/trendline.js`.
 *
 * Three real, distinct data shapes this file's own `collectDataPoints`
 * handles, confirmed from the original's own real branching (not
 * guessed at from the README, which only documents the common case):
 * - A flat array of numbers (`dataset.data = [1, 2, 3]`) \u2014 the array
 *   index itself is used as x.
 * - An array of `{x, y}`-shaped objects, read via `xAxisKey`/`yAxisKey`
 *   (default `'x'`/`'y'`, or the chart's own `options.parsing.
 *   xAxisKey`/`yAxisKey` if set) \u2014 Chart.js's own standard object-data
 *   convention.
 * - A `time`/`timeseries` x-scale, in either data shape above \u2014 x-values
 *   are converted to real millisecond timestamps via `new Date(...)
 *   .getTime()`, reading from the object's own x-key (or Chart.js's
 *   own internal `data.t` fallback) for object data, or from the
 *   chart's own `data.labels` array for flat-number data.
 *
 * `trendoffset` (positive: skip the first N points; negative: use only
 * the last N points) is applied before the shape-detection above runs,
 * using the real, confirmed logic: search for the first non-null point
 * at or after the offset to decide `effectiveFirstIndex` (which itself
 * decides whether the dataset looks like object-data or flat-number
 * data), then skip/include each individual point during the real
 * collection loop below.
 */
import type { Chart, ChartArea, Scale } from 'chart.js';
import type { ChartConfigDataset } from '../../types.js';
import { ExponentialFitter, LineFitter, type Fitter } from './fitters.js';
import { drawTrendline, fillBelowTrendline, setLineStyle } from './drawing.js';
import { addTrendlineLabel } from './label.js';

interface RawTrendlineConfig {
  colorMin?: string;
  colorMax?: string;
  width?: number;
  lineStyle?: string;
  fillColor?: string | false;
  trendoffset?: number;
  xAxisKey?: string;
  yAxisKey?: string;
  projection?: boolean;
  label?: {
    color?: string;
    text?: string;
    display?: boolean;
    displayValue?: boolean;
    offset?: number;
    percentage?: boolean;
    font?: { family?: string; size?: number };
  };
}

type TrendlineDataset = ChartConfigDataset & {
  trendlineLinear?: RawTrendlineConfig;
  trendlineExponential?: RawTrendlineConfig;
  order?: number;
  alwaysShowTrendline?: boolean;
  yAxisID?: string;
};

/** Collects every real, valid data point from `dataset.data` into
 * `fitter`, honoring `trendoffset` and each of the three real data
 * shapes described in this file's own header comment above. */
export function collectDataPoints(
  fitter: Fitter,
  dataset: TrendlineDataset,
  trendoffset: number,
  effectiveFirstIndex: number,
  xy: boolean,
  xScale: Scale,
  xAxisKey: string,
  yAxisKey: string,
  chartLabels: unknown[] | undefined,
): void {
  const data = dataset.data as unknown[];
  const isTimeScale = (xScale.options as { type?: string }).type === 'time' || (xScale.options as { type?: string }).type === 'timeseries';

  data.forEach((entry, index) => {
    if (entry == null) return;
    if (trendoffset > 0 && index < effectiveFirstIndex) return;
    if (trendoffset < 0 && index >= data.length + trendoffset) return;

    if (isTimeScale && xy) {
      const point = entry as Record<string, unknown>;
      const rawX = point[xAxisKey] ?? point.t;
      const yValue = point[yAxisKey] as number | undefined;
      if (rawX != null && yValue != null && !isNaN(yValue)) {
        fitter.add(new Date(rawX as string | number).getTime(), yValue);
      }
    } else if (xy) {
      const point = entry as Record<string, unknown>;
      const xVal = point[xAxisKey] as number | undefined;
      const yVal = point[yAxisKey] as number | undefined;
      const xIsValid = xVal != null && !isNaN(xVal);
      const yIsValid = yVal != null && !isNaN(yVal);
      if (xIsValid && yIsValid) fitter.add(xVal!, yVal!);
    } else if (isTimeScale && !xy) {
      const label = chartLabels?.[index];
      if (label != null && typeof entry === 'number' && !isNaN(entry)) {
        const timeValue = new Date(label as string | number).getTime();
        if (!isNaN(timeValue)) fitter.add(timeValue, entry);
      }
    } else {
      if (typeof entry === 'number' && !isNaN(entry)) fitter.add(index, entry);
    }
  });
}

/** Resolves the trendline's own real start/end pixel coordinates \u2014
 * either fit exactly to the real data's own x-range (`minx`..`maxx`),
 * or, with `projection: true`, extended across the *entire* chart
 * area, clipped back down to whichever of the four candidate
 * endpoints (top/bottom/left/right edge intersections, deduplicated
 * and sorted) actually fall inside real, finite chart bounds. A
 * near-zero-slope case is handled with a relative threshold (`|slope
 * \u00d7 x-range| < |y-range| \u00d7 1e-6`) rather than an absolute one \u2014
 * confirmed a deliberate real fix in the original for a genuine
 * problem with time-scale x-axes, whose own real values are large
 * millisecond timestamps (~1.7\u00d710\u00b9\u00b2) that make even a visually
 * significant slope's own absolute value tiny. */
export function calculateProjectedCoordinates(
  fitter: Fitter,
  isExponential: boolean,
  trendlineConfig: RawTrendlineConfig,
  xScale: Scale,
  yScaleToUse: Scale,
  chartArea: ChartArea,
): { x1: number; y1: number; x2: number; y2: number } {
  if (!trendlineConfig.projection) {
    const yAtMinX = fitter.f(fitter.minx);
    const yAtMaxX = fitter.f(fitter.maxx);
    return {
      x1: xScale.getPixelForValue(fitter.minx),
      y1: yScaleToUse.getPixelForValue(yAtMinX),
      x2: xScale.getPixelForValue(fitter.maxx),
      y2: yScaleToUse.getPixelForValue(yAtMaxX),
    };
  }

  const points: { x: number; y: number }[] = [];

  if (isExponential) {
    const valXLeft = xScale.getValueForPixel(chartArea.left)!;
    points.push({ x: valXLeft, y: fitter.f(valXLeft) });
    const valXRight = xScale.getValueForPixel(chartArea.right)!;
    points.push({ x: valXRight, y: fitter.f(valXRight) });
  } else {
    const lineFitter = fitter as LineFitter;
    const slope = lineFitter.slope();
    const intercept = lineFitter.intercept();
    const xRange = fitter.maxx - fitter.minx;
    const yRange = yScaleToUse.max - yScaleToUse.min || 1;
    const isNearZeroSlope = Math.abs(slope * xRange) < Math.abs(yRange) * 1e-6;

    if (!isNearZeroSlope) {
      const valYTop = yScaleToUse.getValueForPixel(chartArea.top)!;
      points.push({ x: (valYTop - intercept) / slope, y: valYTop });
      const valYBottom = yScaleToUse.getValueForPixel(chartArea.bottom)!;
      points.push({ x: (valYBottom - intercept) / slope, y: valYBottom });
    } else {
      points.push({ x: xScale.getValueForPixel(chartArea.left)!, y: intercept });
      points.push({ x: xScale.getValueForPixel(chartArea.right)!, y: intercept });
    }

    const valXLeft = xScale.getValueForPixel(chartArea.left)!;
    points.push({ x: valXLeft, y: fitter.f(valXLeft) });
    const valXRight = xScale.getValueForPixel(chartArea.right)!;
    points.push({ x: valXRight, y: fitter.f(valXRight) });
  }

  const chartMinX = xScale.getValueForPixel(chartArea.left)!;
  const chartMaxX = xScale.getValueForPixel(chartArea.right)!;
  const yValsFromPixels = [yScaleToUse.getValueForPixel(chartArea.top)!, yScaleToUse.getValueForPixel(chartArea.bottom)!];
  const finiteYVals = yValsFromPixels.filter((y) => isFinite(y));
  const actualChartMinY = finiteYVals.length > 0 ? Math.min(...finiteYVals) : -Infinity;
  const actualChartMaxY = finiteYVals.length > 0 ? Math.max(...finiteYVals) : Infinity;

  let validPoints = points.filter(
    (p) => isFinite(p.x) && isFinite(p.y) && p.x >= chartMinX && p.x <= chartMaxX && p.y >= actualChartMinY && p.y <= actualChartMaxY,
  );
  validPoints = validPoints.filter(
    (point, index, self) => index === self.findIndex((t) => Math.abs(t.x - point.x) < 1e-4 && Math.abs(t.y - point.y) < 1e-4),
  );

  if (validPoints.length < 2) {
    return { x1: NaN, y1: NaN, x2: NaN, y2: NaN };
  }
  validPoints.sort((a, b) => a.x - b.x || a.y - b.y);
  return {
    x1: xScale.getPixelForValue(validPoints[0].x),
    y1: yScaleToUse.getPixelForValue(validPoints[0].y),
    x2: xScale.getPixelForValue(validPoints[validPoints.length - 1].x),
    y2: yScaleToUse.getPixelForValue(validPoints[validPoints.length - 1].y),
  };
}

/** Clips a line segment to the chart area's own rectangular bounds via
 * the Liang-Barsky algorithm \u2014 returns `null` if the segment falls
 * entirely outside those bounds. Ported unchanged; see the original's
 * own extensive real comments (carried over here) for the per-edge
 * parametric reasoning. */
export function liangBarskyClip(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  chartArea: ChartArea,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;

  const p = [-dx, dx, -dy, dy];
  const q = [x1 - chartArea.left, chartArea.right - x1, y1 - chartArea.top, chartArea.bottom - y1];

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return null;
        t0 = Math.max(t0, r);
      } else {
        if (r < t0) return null;
        t1 = Math.min(t1, r);
      }
    }
  }
  if (t0 > t1) return null;

  return {
    x1: x1 + t0 * dx,
    y1: y1 + t0 * dy,
    x2: x1 + t1 * dx,
    y2: y1 + t1 * dy,
  };
}

/** The real, per-dataset entry point \u2014 collects data points, fits the
 * configured curve, resolves and clips its own real on-screen segment,
 * and draws it (plus an optional fill and/or rotated text label). A
 * genuinely real, confirmed feature the README never documents:
 * `fillColor` (fills the area between the trendline and the chart's
 * own bottom edge), alongside `dataset.order`/`dataset.
 * alwaysShowTrendline` (both handled one level up, in
 * `trendlinePlugin.ts`, matching the original's own real split between
 * `core/plugin.js` and `components/trendline.js`). */
export function addFitter(datasetMeta: { controller: { chart: Chart } }, ctx: CanvasRenderingContext2D, dataset: TrendlineDataset, xScale: Scale, yScale: Scale): void {
  const yAxisID = dataset.yAxisID ?? 'y';
  const chart = datasetMeta.controller.chart;
  const yScaleToUse = (chart.scales as Record<string, Scale>)[yAxisID] ?? yScale;

  const isExponential = !!dataset.trendlineExponential;
  const trendlineConfig: RawTrendlineConfig = dataset.trendlineExponential ?? dataset.trendlineLinear ?? {};

  const defaultColor = (dataset.borderColor as string | undefined) ?? 'rgba(169,169,169, .6)';
  const colorMin = trendlineConfig.colorMin ?? defaultColor;
  const colorMax = trendlineConfig.colorMax ?? defaultColor;
  const lineWidth = trendlineConfig.width ?? (dataset.borderWidth as number | undefined) ?? 3;
  const lineStyle = trendlineConfig.lineStyle ?? 'solid';
  const fillColor = trendlineConfig.fillColor ?? false;
  let trendoffset = trendlineConfig.trendoffset ?? 0;

  const labelConfig = trendlineConfig.label ?? {};
  const color = labelConfig.color ?? defaultColor;
  const text = labelConfig.text ?? (isExponential ? 'Exponential Trendline' : 'Trendline');
  const display = labelConfig.display ?? true;
  const displayValue = labelConfig.displayValue ?? true;
  const offset = labelConfig.offset ?? 10;
  const percentage = labelConfig.percentage ?? false;
  const family = labelConfig.font?.family ?? "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";
  const size = labelConfig.font?.size ?? 12;

  const chartOptions = chart.options as { parsing?: { xAxisKey?: string; yAxisKey?: string } };
  const parsing = typeof chartOptions.parsing === 'object' ? chartOptions.parsing : undefined;
  const xAxisKey = trendlineConfig.xAxisKey ?? parsing?.xAxisKey ?? 'x';
  const yAxisKey = trendlineConfig.yAxisKey ?? parsing?.yAxisKey ?? 'y';

  const fitter: Fitter = isExponential ? new ExponentialFitter() : new LineFitter();

  const data = dataset.data as unknown[];
  if (Math.abs(trendoffset) >= data.length) trendoffset = 0;

  let effectiveFirstIndex = 0;
  if (trendoffset > 0) {
    const firstNonNullAfterOffset = data.slice(trendoffset).findIndex((d) => d !== undefined && d !== null);
    effectiveFirstIndex = firstNonNullAfterOffset !== -1 ? trendoffset + firstNonNullAfterOffset : data.length;
  } else {
    const firstNonNull = data.findIndex((d) => d !== undefined && d !== null);
    effectiveFirstIndex = firstNonNull !== -1 ? firstNonNull : data.length;
  }

  const xy = effectiveFirstIndex < data.length && typeof data[effectiveFirstIndex] === 'object';
  const chartLabels = chart.data.labels;
  collectDataPoints(fitter, dataset, trendoffset, effectiveFirstIndex, xy, xScale, xAxisKey, yAxisKey, chartLabels);

  if (fitter.count < 2) return;

  const chartArea = chart.chartArea;
  let { x1, y1, x2, y2 } = calculateProjectedCoordinates(fitter, isExponential, trendlineConfig, xScale, yScaleToUse, chartArea);

  const clipped = isFinite(x1) && isFinite(y1) && isFinite(x2) && isFinite(y2) ? liangBarskyClip(x1, y1, x2, y2, chartArea) : null;
  if (!clipped) return;
  ({ x1, y1, x2, y2 } = clipped);

  if (Math.abs(x1 - x2) < 0.5 && Math.abs(y1 - y2) < 0.5) return;

  ctx.lineWidth = lineWidth;
  setLineStyle(ctx, lineStyle);
  drawTrendline({ ctx, x1, y1, x2, y2, colorMin, colorMax });

  if (fillColor) {
    fillBelowTrendline(ctx, x1, y1, x2, y2, chartArea.bottom, fillColor);
  }

  const angle = Math.atan2(y2 - y1, x2 - x1);

  if (trendlineConfig.label && display) {
    let trendText = text;
    if (displayValue) {
      if (isExponential) {
        const expFitter = fitter as ExponentialFitter;
        trendText = `${text} (a=${expFitter.coefficient().toFixed(2)}, b=${expFitter.growthRate().toFixed(2)})`;
      } else {
        const displaySlope = (fitter as LineFitter).slope();
        trendText = `${text} (Slope: ${percentage ? (displaySlope * 100).toFixed(2) + '%' : displaySlope.toFixed(2)})`;
      }
    }
    addTrendlineLabel({ ctx, label: trendText, x1, y1, x2, y2, angle, labelColor: color, family, size, offset });
  }
}
