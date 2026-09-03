/**
 * Local port of `chartjs-plugin-zoom` (v2.2.0, MIT, chartjs-plugin-zoom
 * Contributors), supplied via Chart.js's inline `plugins` array instead
 * of a dependency, so it avoids the docs-site dynamic-import hydration
 * gap the other still-dependency-based plugins in this project hit —
 * see docs/ZOOM_PLUGIN_PORT_PLAN.md for the full scope analysis behind
 * this port, written before implementation started.
 *
 * **Scope decision, made explicitly rather than silently**: this port
 * drops every Hammer.js-dependent code path — pinch-zoom, and the
 * gesture-driven pan interaction — while keeping everything that is
 * plain DOM event handling: mouse-wheel zoom, mouse-drag-to-zoom-
 * rectangle (with Escape-to-cancel), and the full programmatic API
 * (`chart.zoom()`, `chart.zoomRect()`, `chart.zoomScale()`,
 * `chart.resetZoom()`, `chart.pan()`, `chart.getZoomLevel()`,
 * `chart.getInitialScaleBounds()`, `chart.getZoomedScaleBounds()`,
 * `chart.isZoomedOrPanned()`, `chart.isZoomingOrPanning()`). This avoids
 * the real, confirmed unmaintained-dependency concern already flagged
 * for Hammer.js in `docs/CHARTJS_ANALYSIS.md` §6 (no release in years,
 * non-ESM warnings under modern bundlers, a real open upstream issue).
 *
 * **A real, honest finding from dissecting the original source, not
 * assumed from the port plan's own earlier (slightly imprecise)
 * summary**: the original plugin has no mouse-only drag-to-pan
 * mechanism at all — `pan()` is only ever invoked from Hammer's own
 * `handlePan()` (driven by `Hammer.Pan()`, which recognizes both touch
 * *and* mouse-pointer drags). Dropping Hammer.js therefore means
 * dropping *all* interactive pan support, not just touch-pan — there is
 * no separate "mouse-drag-to-pan" code path in the original to fall
 * back to. `chart.pan()` is kept here as a callable, programmatic
 * method (useful for a consumer's own custom pan buttons/controls), but
 * nothing in this port wires up a drag gesture to call it. The `pan`
 * option's own `enabled`/`mode`/`threshold` fields are kept for shape
 * compatibility and because `mouseDown`'s own modifier-key check still
 * reads `pan`'s modifier key (to *suppress* drag-to-zoom while a pan
 * modifier is held, matching the original's own real behavior exactly),
 * but no gesture in this port actually triggers a pan as a result.
 *
 * Every other real function below (the zoom/pan math per scale type,
 * scale-limit bookkeeping, drag-rectangle geometry, wheel/mousedown/
 * mouseup event handling) is a faithful port of the original's own real
 * logic, dissected directly from the installed package's own dist file
 * (`node_modules/chartjs-plugin-zoom/dist/chartjs-plugin-zoom.esm.js`).
 *
 * Fully typed against real Chart.js types throughout. One genuine
 * runtime-vs-public-type gap, handled via {@link LiveScale}: Chart.js's
 * own public `Scale` type (from `types/index.d.ts`) omits several real
 * runtime properties this plugin genuinely needs (`chart`, the current
 * computed `min`/`max`, `getLabels()`) — confirmed real via Chart.js's
 * own JSDoc-derived implementation class (`dist/core/core.scale.d.ts`),
 * which is a different, internal declaration from the public `Scale`
 * type and isn't what `import { Scale } from 'chart.js'` resolves to.
 */
import { type Chart, type ChartArea, type ChartType, type Plugin, type Point, type Scale } from 'chart.js';
import { _isPointInArea, almostEquals, callback, each, getRelativePosition, sign, valueOrDefault } from 'chart.js/helpers';

/** See this file's own header comment for why this extends the public `Scale` type. */
interface LiveScale extends Scale {
  chart: Chart;
  min: number;
  max: number;
  getLabels(): string[];
}

type ZoomDirection = 'x' | 'y';
type ZoomMode = ZoomDirection | 'xy' | ((ctx: { chart: Chart }) => string);

interface ScaleLimits {
  min?: number | 'original';
  max?: number | 'original';
  minRange?: number;
}

export interface ZoomPluginOptions {
  limits?: Record<string, ScaleLimits>;
  pan?: {
    enabled?: boolean;
    mode?: ZoomMode;
    modifierKey?: string | null;
    threshold?: number;
    onPan?: (ctx: { chart: Chart }) => void;
    onPanStart?: (ctx: { chart: Chart; event: Event; point: Point }) => void | false;
    onPanComplete?: (ctx: { chart: Chart }) => void;
    onPanRejected?: (ctx: { chart: Chart; event: Event }) => void;
  };
  zoom?: {
    wheel?: { enabled?: boolean; speed?: number; modifierKey?: string | null };
    drag?: {
      enabled?: boolean;
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
      threshold?: number;
      maintainAspectRatio?: boolean;
      drawTime?: 'beforeDatasetsDraw' | 'afterDatasetsDraw' | 'beforeDraw' | 'afterDraw';
      modifierKey?: string | null;
    };
    mode?: ZoomMode;
    scaleMode?: ZoomMode;
    overScaleMode?: ZoomMode;
    onZoom?: (ctx: { chart: Chart; trigger: string }) => void;
    onZoomStart?: (ctx: { chart: Chart; event: Event; point: Point }) => void | false;
    onZoomComplete?: (ctx: { chart: Chart }) => void;
    onZoomRejected?: (ctx: { chart: Chart; event: Event }) => void;
  };
}

interface ScaleLimitSnapshot {
  scale: number;
  options: number | undefined;
}

interface ZoomPluginState {
  originalScaleLimits: Record<string, { min: ScaleLimitSnapshot; max: ScaleLimitSnapshot }>;
  updatedScaleLimits: Record<string, { min: number; max: number }>;
  handlers: Record<string, EventListener & { target?: EventTarget }>;
  panDelta: Record<string, number>;
  dragging: boolean;
  panning: boolean;
  dragStart?: MouseEvent | null;
  dragEnd?: MouseEvent | null;
  filterNextClick?: boolean;
  options: ZoomPluginOptions;
}

const chartStates = new WeakMap<Chart, ZoomPluginState>();

function getState(chart: Chart): ZoomPluginState {
  let state = chartStates.get(chart);
  if (!state) {
    state = {
      originalScaleLimits: {},
      updatedScaleLimits: {},
      handlers: {},
      panDelta: {},
      dragging: false,
      panning: false,
      options: {},
    };
    chartStates.set(chart, state);
  }
  return state;
}

function removeState(chart: Chart): void {
  chartStates.delete(chart);
}

// ---- direction/mode helpers ----

function getModifierKey(opts: { enabled?: boolean; modifierKey?: string | null } | undefined): string | null | undefined {
  return opts && opts.enabled ? opts.modifierKey : undefined;
}
function keyPressed(key: string | null | undefined, event: MouseEvent): boolean {
  return !!key && !!(event as unknown as Record<string, boolean>)[`${key}Key`];
}
function keyNotPressed(key: string | null | undefined, event: MouseEvent): boolean {
  return !!key && !(event as unknown as Record<string, boolean>)[`${key}Key`];
}
function directionEnabled(mode: ZoomMode | undefined, dir: ZoomDirection, chart: Chart): boolean {
  if (mode === undefined) return true;
  if (typeof mode === 'string') return mode.indexOf(dir) !== -1;
  if (typeof mode === 'function') return mode({ chart }).indexOf(dir) !== -1;
  return false;
}
function directionsEnabled(mode: ZoomMode | undefined, chart: Chart): { x: boolean; y: boolean } {
  const resolved = typeof mode === 'function' ? mode({ chart }) : mode;
  if (typeof resolved === 'string') {
    return { x: resolved.indexOf('x') !== -1, y: resolved.indexOf('y') !== -1 };
  }
  return { x: false, y: false };
}

function debounce(fn: () => void, delay: number): () => number {
  let timeout: ReturnType<typeof setTimeout>;
  return function debounced(): number {
    clearTimeout(timeout);
    timeout = setTimeout(fn, delay);
    return delay;
  };
}

function getScaleUnderPoint(point: Point, chart: Chart): LiveScale | null {
  const scales = chart.scales as unknown as Record<string, LiveScale>;
  for (const id of Object.keys(scales)) {
    const scale = scales[id];
    if (point.y >= scale.top && point.y <= scale.bottom && point.x >= scale.left && point.x <= scale.right) {
      return scale;
    }
  }
  return null;
}

function getEnabledScalesByPoint(
  options: { mode?: ZoomMode; scaleMode?: ZoomMode; overScaleMode?: ZoomMode } | undefined,
  point: Point,
  chart: Chart,
): LiveScale[] {
  const { mode = 'xy', scaleMode, overScaleMode } = options ?? {};
  const scale = getScaleUnderPoint(point, chart);
  const enabled = directionsEnabled(mode, chart);
  const scaleEnabled = directionsEnabled(scaleMode, chart);
  if (overScaleMode) {
    const overScaleEnabled = directionsEnabled(overScaleMode, chart);
    for (const axis of ['x', 'y'] as const) {
      if (overScaleEnabled[axis]) {
        scaleEnabled[axis] = enabled[axis];
        enabled[axis] = false;
      }
    }
  }
  if (scale && scaleEnabled[scale.axis as 'x' | 'y']) {
    return [scale];
  }
  const enabledScales: LiveScale[] = [];
  each(chart.scales as unknown as Record<string, LiveScale>, (scaleItem) => {
    if (enabled[scaleItem.axis as 'x' | 'y']) enabledScales.push(scaleItem);
  });
  return enabledScales;
}

// ---- zoom/pan math, per scale type ----

function zoomDelta(val: number, min: number, range: number, newRange: number): { min: number; max: number } {
  const minPercent = Math.max(0, Math.min(1, (val - min) / range || 0));
  const maxPercent = 1 - minPercent;
  return { min: newRange * minPercent, max: newRange * maxPercent };
}
function getValueAtPoint(scale: LiveScale, point: Point): number {
  const pixel = scale.isHorizontal() ? point.x : point.y;
  return scale.getValueForPixel(pixel);
}
function linearZoomDelta(scale: LiveScale, zoomAmount: number, center: Point): { min: number; max: number } {
  const range = scale.max - scale.min;
  const newRange = range * (zoomAmount - 1);
  const centerValue = getValueAtPoint(scale, center);
  return zoomDelta(centerValue, scale.min, range, newRange);
}
function logarithmicZoomRange(scale: LiveScale, zoomAmount: number, center: Point): { min: number; max: number } {
  const centerValue = getValueAtPoint(scale, center);
  if (centerValue === undefined) return { min: scale.min, max: scale.max };
  const logMin = Math.log10(scale.min);
  const logMax = Math.log10(scale.max);
  const logCenter = Math.log10(centerValue);
  const logRange = logMax - logMin;
  const newLogRange = logRange * (zoomAmount - 1);
  const delta = zoomDelta(logCenter, logMin, logRange, newLogRange);
  return { min: Math.pow(10, logMin + delta.min), max: Math.pow(10, logMax - delta.max) };
}
function getScaleLimits(scale: LiveScale, limits: Record<string, ScaleLimits> | undefined): ScaleLimits {
  return (limits && (limits[scale.id] ?? limits[scale.axis as string])) || {};
}
function getLimit(
  state: ZoomPluginState,
  scale: LiveScale,
  scaleLimits: ScaleLimits,
  prop: 'min' | 'max',
  fallback: number,
): number {
  let limit: number | 'original' | undefined = scaleLimits[prop];
  if (limit === 'original') {
    const original = state.originalScaleLimits[scale.id][prop];
    return valueOrDefault(original.options, original.scale);
  }
  return valueOrDefault(limit, fallback);
}
function linearRange(scale: LiveScale, pixel0: number, pixel1: number): { min: number; max: number } {
  const v0 = scale.getValueForPixel(pixel0);
  const v1 = scale.getValueForPixel(pixel1);
  return { min: Math.min(v0, v1), max: Math.max(v0, v1) };
}
function fixRange(
  range: number,
  bounds: { min: number; max: number; minLimit: number; maxLimit: number },
  originalLimits: { min: ScaleLimitSnapshot; max: ScaleLimitSnapshot },
): { min: number; max: number } {
  let { min, max } = bounds;
  const { minLimit, maxLimit } = bounds;
  const offset = (range - max + min) / 2;
  min -= offset;
  max += offset;
  const origMin = originalLimits.min.options ?? originalLimits.min.scale;
  const origMax = originalLimits.max.options ?? originalLimits.max.scale;
  const epsilon = range / 1e6;
  if (almostEquals(min, origMin, epsilon)) min = origMin;
  if (almostEquals(max, origMax, epsilon)) max = origMax;
  if (min < minLimit) {
    min = minLimit;
    max = Math.min(minLimit + range, maxLimit);
  } else if (max > maxLimit) {
    max = maxLimit;
    min = Math.max(maxLimit - range, minLimit);
  }
  return { min, max };
}
/** `zoom: true` for a real zoom, `'pan'` for a pan-triggered update (different limit-violation
 * behavior — see the real `zoom === 'pan'` check below), `false` for neither. */
function updateRange(
  scale: LiveScale,
  range: { min: number; max: number },
  limits: Record<string, ScaleLimits> | undefined,
  zoomKind: boolean | 'pan' = false,
): boolean {
  const state = getState(scale.chart);
  const scaleOpts = scale.options as { min?: number; max?: number };
  const scaleLimits = getScaleLimits(scale, limits);
  const { minRange = 0 } = scaleLimits;
  const minLimit = getLimit(state, scale, scaleLimits, 'min', -Infinity);
  const maxLimit = getLimit(state, scale, scaleLimits, 'max', Infinity);
  if (zoomKind === 'pan' && (range.min < minLimit || range.max > maxLimit)) return true;
  const scaleRange = scale.max - scale.min;
  const newSpan = zoomKind ? Math.max(range.max - range.min, minRange) : scaleRange;
  if (zoomKind && newSpan === minRange && scaleRange <= minRange) return true;
  const fixed = fixRange(newSpan, { min: range.min, max: range.max, minLimit, maxLimit }, state.originalScaleLimits[scale.id]);
  scaleOpts.min = fixed.min;
  scaleOpts.max = fixed.max;
  state.updatedScaleLimits[scale.id] = fixed;
  return scale.parse(fixed.min) !== scale.min || scale.parse(fixed.max) !== scale.max;
}
function zoomNumericalScale(scale: LiveScale, zoomAmount: number, center: Point, limits: Record<string, ScaleLimits> | undefined): boolean {
  const delta = linearZoomDelta(scale, zoomAmount, center);
  return updateRange(scale, { min: scale.min + delta.min, max: scale.max - delta.max }, limits, true);
}
function zoomLogarithmicScale(scale: LiveScale, zoomAmount: number, center: Point, limits: Record<string, ScaleLimits> | undefined): boolean {
  return updateRange(scale, logarithmicZoomRange(scale, zoomAmount, center), limits, true);
}
function zoomRectNumericalScale(scale: LiveScale, from: number, to: number, limits: Record<string, ScaleLimits> | undefined): void {
  updateRange(scale, linearRange(scale, from, to), limits, true);
}
const integerChange = (v: number): number => (v === 0 || isNaN(v) ? 0 : v < 0 ? Math.min(Math.round(v), -1) : Math.max(Math.round(v), 1));
function existCategoryFromMaxZoom(scale: LiveScale): void {
  const maxIndex = scale.getLabels().length - 1;
  if (scale.min > 0) scale.min -= 1;
  if (scale.max < maxIndex) scale.max += 1;
}
function zoomCategoryScale(scale: LiveScale, zoomAmount: number, center: Point, limits: Record<string, ScaleLimits> | undefined): boolean {
  const delta = linearZoomDelta(scale, zoomAmount, center);
  if (scale.min === scale.max && zoomAmount < 1) existCategoryFromMaxZoom(scale);
  return updateRange(scale, { min: scale.min + integerChange(delta.min), max: scale.max - integerChange(delta.max) }, limits, true);
}
function scaleLength(scale: LiveScale): number {
  return scale.isHorizontal() ? scale.width : scale.height;
}
function panCategoryScale(scale: LiveScale, delta: number, limits: Record<string, ScaleLimits> | undefined): boolean {
  const lastLabelIndex = scale.getLabels().length - 1;
  let { min, max } = scale;
  const range = Math.max(max - min, 1);
  const stepDelta = Math.round(scaleLength(scale) / Math.max(range, 10));
  const stepSize = Math.round(Math.abs(delta / stepDelta));
  let applied: boolean | undefined;
  if (delta < -stepDelta) {
    max = Math.min(max + stepSize, lastLabelIndex);
    min = range === 1 ? max : max - range;
    applied = max === lastLabelIndex;
  } else if (delta > stepDelta) {
    min = Math.max(0, min - stepSize);
    max = range === 1 ? min : min + range;
    applied = min === 0;
  }
  return updateRange(scale, { min, max }, limits) || !!applied;
}
const OFFSETS: Record<string, number> = {
  second: 500,
  minute: 30 * 1000,
  hour: 30 * 60 * 1000,
  day: 12 * 60 * 60 * 1000,
  week: 3.5 * 24 * 60 * 60 * 1000,
  month: 15 * 24 * 60 * 60 * 1000,
  quarter: 60 * 24 * 60 * 60 * 1000,
  year: 182 * 24 * 60 * 60 * 1000,
};
function panNumericalScale(scale: LiveScale, delta: number, limits: Record<string, ScaleLimits> | undefined, pan = false): boolean {
  const prevStart = scale.min;
  const prevEnd = scale.max;
  const round = (scale.options as { time?: { round?: string } }).time?.round;
  const offset = (round && OFFSETS[round]) || 0;
  const newMin = scale.getValueForPixel(scale.getPixelForValue(prevStart + offset) - delta);
  const newMax = scale.getValueForPixel(scale.getPixelForValue(prevEnd + offset) - delta);
  if (isNaN(newMin) || isNaN(newMax)) return true;
  return updateRange(scale, { min: newMin, max: newMax }, limits, pan ? 'pan' : false);
}
function panNonLinearScale(scale: LiveScale, delta: number, limits: Record<string, ScaleLimits> | undefined): boolean {
  return panNumericalScale(scale, delta, limits, true);
}
type ScaleTypeFn<R> = (scale: LiveScale, ...rest: never[]) => R;
const zoomFunctions: Record<string, ScaleTypeFn<boolean>> = {
  category: zoomCategoryScale as ScaleTypeFn<boolean>,
  default: zoomNumericalScale as ScaleTypeFn<boolean>,
  logarithmic: zoomLogarithmicScale as ScaleTypeFn<boolean>,
};
const zoomRectFunctions: Record<string, ScaleTypeFn<void>> = {
  default: zoomRectNumericalScale as ScaleTypeFn<void>,
};
const panFunctions: Record<string, ScaleTypeFn<boolean>> = {
  category: panCategoryScale as ScaleTypeFn<boolean>,
  default: panNumericalScale as ScaleTypeFn<boolean>,
  logarithmic: panNonLinearScale as ScaleTypeFn<boolean>,
  timeseries: panNonLinearScale as ScaleTypeFn<boolean>,
};

// ---- scale-limit bookkeeping ----

function shouldUpdateScaleLimits(
  scale: LiveScale,
  originalScaleLimits: ZoomPluginState['originalScaleLimits'],
  updatedScaleLimits: ZoomPluginState['updatedScaleLimits'],
): boolean {
  const { id } = scale;
  const opts = scale.options as { min?: number; max?: number };
  if (!originalScaleLimits[id] || !updatedScaleLimits[id]) return true;
  const previous = updatedScaleLimits[id];
  return previous.min !== opts.min || previous.max !== opts.max;
}
function removeMissingScales(limits: Record<string, unknown>, scales: Record<string, unknown>): void {
  each(limits, (_opt, key: string) => {
    if (!scales[key]) delete limits[key];
  });
}
function storeOriginalScaleLimits(chart: Chart, state: ZoomPluginState): ZoomPluginState['originalScaleLimits'] {
  const scales = chart.scales as unknown as Record<string, LiveScale>;
  const { originalScaleLimits, updatedScaleLimits } = state;
  each(scales, (scale) => {
    if (shouldUpdateScaleLimits(scale, originalScaleLimits, updatedScaleLimits)) {
      const opts = scale.options as { min?: number; max?: number };
      originalScaleLimits[scale.id] = {
        min: { scale: scale.min, options: opts.min },
        max: { scale: scale.max, options: opts.max },
      };
    }
  });
  removeMissingScales(originalScaleLimits, scales);
  removeMissingScales(updatedScaleLimits, scales);
  return originalScaleLimits;
}
function doZoom(scale: LiveScale, amount: number, center: Point, limits: Record<string, ScaleLimits> | undefined): void {
  const fn = zoomFunctions[scale.type] ?? zoomFunctions.default;
  callback(fn, [scale, amount, center, limits]);
}
function doZoomRect(scale: LiveScale, from: number, to: number, limits: Record<string, ScaleLimits> | undefined): void {
  const fn = zoomRectFunctions[scale.type] ?? zoomRectFunctions.default;
  callback(fn, [scale, from, to, limits]);
}
function getCenter(chart: Chart): Point {
  const ca = chart.chartArea;
  return { x: (ca.left + ca.right) / 2, y: (ca.top + ca.bottom) / 2 };
}

// ---- public zoom/pan API (both driven by DOM events below, and callable directly) ----

export type ZoomAmount = number | { x?: number; y?: number; focalPoint?: Point };

export function zoom(chart: Chart, amount: ZoomAmount, transition = 'none', trigger = 'api'): void {
  const { x = 1, y = 1, focalPoint = getCenter(chart) } = typeof amount === 'number' ? { x: amount, y: amount } : amount;
  const state = getState(chart);
  const { limits, zoom: zoomOptions } = state.options;
  storeOriginalScaleLimits(chart, state);
  const xEnabled = x !== 1;
  const yEnabled = y !== 1;
  const enabledScales = getEnabledScalesByPoint(zoomOptions, focalPoint, chart);
  each(enabledScales.length ? enabledScales : (chart.scales as unknown as Record<string, LiveScale>), (scale) => {
    if (scale.isHorizontal() && xEnabled) doZoom(scale, x, focalPoint, limits);
    else if (!scale.isHorizontal() && yEnabled) doZoom(scale, y, focalPoint, limits);
  });
  chart.update(transition);
  callback(zoomOptions?.onZoom, [{ chart, trigger }]);
}

export function zoomRect(chart: Chart, p0: Point, p1: Point, transition = 'none', trigger = 'api'): void {
  const state = getState(chart);
  const { limits, zoom: zoomOptions } = state.options;
  const mode = zoomOptions?.mode ?? 'xy';
  storeOriginalScaleLimits(chart, state);
  const xEnabled = directionEnabled(mode, 'x', chart);
  const yEnabled = directionEnabled(mode, 'y', chart);
  each(chart.scales as unknown as Record<string, LiveScale>, (scale) => {
    if (scale.isHorizontal() && xEnabled) doZoomRect(scale, p0.x, p1.x, limits);
    else if (!scale.isHorizontal() && yEnabled) doZoomRect(scale, p0.y, p1.y, limits);
  });
  chart.update(transition);
  callback(zoomOptions?.onZoom, [{ chart, trigger }]);
}

export function zoomScale(chart: Chart, scaleId: string, range: { min: number; max: number }, transition = 'none', trigger = 'api'): void {
  const state = getState(chart);
  storeOriginalScaleLimits(chart, state);
  const scale = (chart.scales as unknown as Record<string, LiveScale>)[scaleId];
  updateRange(scale, range, undefined, true);
  chart.update(transition);
  callback(state.options.zoom?.onZoom, [{ chart, trigger }]);
}

export function resetZoom(chart: Chart, transition = 'default'): void {
  const state = getState(chart);
  const originalScaleLimits = storeOriginalScaleLimits(chart, state);
  each(chart.scales as unknown as Record<string, LiveScale>, (scale) => {
    const scaleOptions = scale.options as { min?: number; max?: number };
    if (originalScaleLimits[scale.id]) {
      scaleOptions.min = originalScaleLimits[scale.id].min.options;
      scaleOptions.max = originalScaleLimits[scale.id].max.options;
    } else {
      delete scaleOptions.min;
      delete scaleOptions.max;
    }
    delete state.updatedScaleLimits[scale.id];
  });
  chart.update(transition);
  callback(state.options.zoom?.onZoomComplete, [{ chart }]);
}

function getOriginalRange(state: ZoomPluginState, scaleId: string): number | undefined {
  const original = state.originalScaleLimits[scaleId];
  if (!original) return undefined;
  return valueOrDefault(original.max.options, original.max.scale) - valueOrDefault(original.min.options, original.min.scale);
}

export function getZoomLevel(chart: Chart): number {
  const state = getState(chart);
  let min = 1;
  let max = 1;
  each(chart.scales as unknown as Record<string, LiveScale>, (scale) => {
    const origRange = getOriginalRange(state, scale.id);
    if (origRange) {
      const level = Math.round((origRange / (scale.max - scale.min)) * 100) / 100;
      min = Math.min(min, level);
      max = Math.max(max, level);
    }
  });
  return min < 1 ? min : max;
}

function panScale(scale: LiveScale, delta: number, limits: Record<string, ScaleLimits> | undefined, state: ZoomPluginState): void {
  const { panDelta } = state;
  const storedDelta = panDelta[scale.id] || 0;
  const effectiveDelta = sign(storedDelta) === sign(delta) ? delta + storedDelta : delta;
  const fn = panFunctions[scale.type] ?? panFunctions.default;
  if (callback(fn, [scale, effectiveDelta, limits])) {
    panDelta[scale.id] = 0;
  } else {
    panDelta[scale.id] = effectiveDelta;
  }
}

export function pan(chart: Chart, delta: number | { x?: number; y?: number }, enabledScales?: LiveScale[], transition = 'none'): void {
  const { x = 0, y = 0 } = typeof delta === 'number' ? { x: delta, y: delta } : delta;
  const state = getState(chart);
  const { pan: panOptions, limits } = state.options;
  storeOriginalScaleLimits(chart, state);
  const xEnabled = x !== 0;
  const yEnabled = y !== 0;
  each(enabledScales?.length ? enabledScales : (chart.scales as unknown as Record<string, LiveScale>), (scale) => {
    if (scale.isHorizontal() && xEnabled) panScale(scale, x, limits, state);
    else if (!scale.isHorizontal() && yEnabled) panScale(scale, y, limits, state);
  });
  chart.update(transition);
  callback(panOptions?.onPan, [{ chart }]);
}

export function getInitialScaleBounds(chart: Chart): Record<string, { min?: number; max?: number }> {
  const state = getState(chart);
  storeOriginalScaleLimits(chart, state);
  const bounds: Record<string, { min?: number; max?: number }> = {};
  for (const scaleId of Object.keys(chart.scales)) {
    const entry = state.originalScaleLimits[scaleId];
    bounds[scaleId] = { min: entry?.min.scale, max: entry?.max.scale };
  }
  return bounds;
}

export function getZoomedScaleBounds(chart: Chart): Record<string, { min: number; max: number } | undefined> {
  const state = getState(chart);
  const bounds: Record<string, { min: number; max: number } | undefined> = {};
  for (const scaleId of Object.keys(chart.scales)) {
    bounds[scaleId] = state.updatedScaleLimits[scaleId];
  }
  return bounds;
}

export function isZoomedOrPanned(chart: Chart): boolean {
  const bounds = getInitialScaleBounds(chart);
  const scales = chart.scales as unknown as Record<string, LiveScale>;
  for (const scaleId of Object.keys(chart.scales)) {
    const { min: originalMin, max: originalMax } = bounds[scaleId];
    if (originalMin !== undefined && scales[scaleId].min !== originalMin) return true;
    if (originalMax !== undefined && scales[scaleId].max !== originalMax) return true;
  }
  return false;
}

export function isZoomingOrPanning(chart: Chart): boolean {
  const state = getState(chart);
  return state.panning || state.dragging;
}

// ---- DOM event handling (wheel zoom, drag-to-zoom-rectangle) ----

const clamp = (x: number, from: number, to: number): number => Math.min(to, Math.max(from, x));

function removeHandler(chart: Chart, type: string): void {
  const { handlers } = getState(chart);
  const handler = handlers[type];
  if (handler?.target) {
    handler.target.removeEventListener(type, handler);
    delete handlers[type];
  }
}
function addHandler(chart: Chart, target: EventTarget, type: string, handler: (chart: Chart, event: Event, options: ZoomPluginOptions) => void): void {
  const { handlers, options } = getState(chart);
  const oldHandler = handlers[type];
  if (oldHandler?.target === target) return;
  removeHandler(chart, type);
  const wrapped = ((event: Event) => handler(chart, event, options)) as EventListener & { target?: EventTarget };
  wrapped.target = target;
  handlers[type] = wrapped;
  const passive = type === 'wheel' ? false : undefined;
  target.addEventListener(type, wrapped, { passive });
}
function mouseMove(chart: Chart, event: Event): void {
  const state = getState(chart);
  if (state.dragStart) {
    state.dragging = true;
    state.dragEnd = event as MouseEvent;
    chart.update('none');
  }
}
function keyDown(chart: Chart, event: Event): void {
  const state = getState(chart);
  const keyEvent = event as KeyboardEvent;
  if (!state.dragStart || keyEvent.key !== 'Escape') return;
  removeHandler(chart, 'keydown');
  state.dragging = false;
  state.dragStart = state.dragEnd = null;
  chart.update('none');
}
function getPointPosition(event: MouseEvent, chart: Chart): Point {
  if (event.target !== chart.canvas) {
    const canvasArea = chart.canvas.getBoundingClientRect();
    return { x: event.clientX - canvasArea.left, y: event.clientY - canvasArea.top };
  }
  return getRelativePosition(event, chart);
}
function zoomStart(chart: Chart, event: MouseEvent, zoomOptions: NonNullable<ZoomPluginOptions['zoom']>): boolean {
  const { onZoomStart, onZoomRejected } = zoomOptions;
  if (onZoomStart) {
    const point = getPointPosition(event, chart);
    if (callback(onZoomStart, [{ chart, event, point }]) === false) {
      callback(onZoomRejected, [{ chart, event }]);
      return false;
    }
  }
  return true;
}
function mouseDown(chart: Chart, event: Event): void {
  const mouseEvent = event as MouseEvent;
  if (chart.legend) {
    const point = getRelativePosition(mouseEvent, chart);
    if (_isPointInArea(point, chart.legend as unknown as ChartArea)) return;
  }
  const state = getState(chart);
  const { pan: panOptions, zoom: zoomOptions = {} } = state.options;
  if (
    mouseEvent.button !== 0 ||
    keyPressed(getModifierKey(panOptions), mouseEvent) ||
    keyNotPressed(getModifierKey(zoomOptions.drag), mouseEvent)
  ) {
    callback(zoomOptions.onZoomRejected, [{ chart, event }]);
    return;
  }
  if (!zoomStart(chart, mouseEvent, zoomOptions)) return;
  state.dragStart = mouseEvent;
  addHandler(chart, chart.canvas.ownerDocument, 'mousemove', mouseMove);
  addHandler(chart, window.document, 'keydown', keyDown);
}
function applyAspectRatio(points: { begin: Point; end: Point }, aspectRatio: number): void {
  let width = points.end.x - points.begin.x;
  let height = points.end.y - points.begin.y;
  const ratio = Math.abs(width / height);
  if (ratio > aspectRatio) {
    width = Math.sign(width) * Math.abs(height * aspectRatio);
  } else if (ratio < aspectRatio) {
    height = Math.sign(height) * Math.abs(width / aspectRatio);
  }
  points.end.x = points.begin.x + width;
  points.end.y = points.begin.y + height;
}
function applyMinMaxProps(
  rect: Record<string, number>,
  chartArea: ChartArea,
  points: { begin: Point; end: Point },
  spec: { min: 'left' | 'top'; max: 'right' | 'bottom'; prop: 'x' | 'y' },
): void {
  const areaRecord = chartArea as unknown as Record<string, number>;
  rect[spec.min] = clamp(Math.min(points.begin[spec.prop], points.end[spec.prop]), areaRecord[spec.min], areaRecord[spec.max]);
  rect[spec.max] = clamp(Math.max(points.begin[spec.prop], points.end[spec.prop]), areaRecord[spec.min], areaRecord[spec.max]);
}
function getRelativePoints(chart: Chart, pointEvents: { dragStart: MouseEvent; dragEnd: MouseEvent }, maintainAspectRatio: boolean): { begin: Point; end: Point } {
  const points = {
    begin: getPointPosition(pointEvents.dragStart, chart),
    end: getPointPosition(pointEvents.dragEnd, chart),
  };
  if (maintainAspectRatio) {
    const aspectRatio = chart.chartArea.width / chart.chartArea.height;
    applyAspectRatio(points, aspectRatio);
  }
  return points;
}
interface DragRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  zoomX: number;
  zoomY: number;
}
function computeDragRect(
  chart: Chart,
  mode: ZoomMode | undefined,
  pointEvents: { dragStart: MouseEvent; dragEnd: MouseEvent },
  maintainAspectRatio: boolean | undefined,
): DragRect {
  const xEnabled = directionEnabled(mode, 'x', chart);
  const yEnabled = directionEnabled(mode, 'y', chart);
  const { top, left, right, bottom, width: chartWidth, height: chartHeight } = chart.chartArea;
  const rect: Record<string, number> = { top, left, right, bottom };
  const points = getRelativePoints(chart, pointEvents, !!(maintainAspectRatio && xEnabled && yEnabled));
  if (xEnabled) applyMinMaxProps(rect, chart.chartArea, points, { min: 'left', max: 'right', prop: 'x' });
  if (yEnabled) applyMinMaxProps(rect, chart.chartArea, points, { min: 'top', max: 'bottom', prop: 'y' });
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width,
    height,
    zoomX: xEnabled && width ? 1 + (chartWidth - width) / chartWidth : 1,
    zoomY: yEnabled && height ? 1 + (chartHeight - height) / chartHeight : 1,
  };
}
function mouseUp(chart: Chart, event: Event): void {
  const state = getState(chart);
  if (!state.dragStart) return;
  removeHandler(chart, 'mousemove');
  const zoomOptions = state.options.zoom!;
  const mode = zoomOptions.mode;
  const { threshold = 0, maintainAspectRatio } = zoomOptions.drag!;
  const rect = computeDragRect(chart, mode, { dragStart: state.dragStart, dragEnd: event as MouseEvent }, maintainAspectRatio);
  const distanceX = directionEnabled(mode, 'x', chart) ? rect.width : 0;
  const distanceY = directionEnabled(mode, 'y', chart) ? rect.height : 0;
  const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
  state.dragStart = state.dragEnd = null;
  if (distance <= threshold) {
    state.dragging = false;
    chart.update('none');
    return;
  }
  zoomRect(chart, { x: rect.left, y: rect.top }, { x: rect.right, y: rect.bottom }, 'zoom', 'drag');
  state.dragging = false;
  state.filterNextClick = true;
  callback(zoomOptions.onZoomComplete, [{ chart }]);
}
function wheelPreconditions(chart: Chart, event: WheelEvent, zoomOptions: NonNullable<ZoomPluginOptions['zoom']>): boolean {
  if (keyNotPressed(getModifierKey(zoomOptions.wheel), event)) {
    callback(zoomOptions.onZoomRejected, [{ chart, event }]);
    return false;
  }
  if (!zoomStart(chart, event, zoomOptions)) return false;
  if (event.cancelable) event.preventDefault();
  return event.deltaY !== undefined;
}
function wheel(chart: Chart, event: Event): void {
  const state = getState(chart);
  const zoomOptions = state.options.zoom!;
  const wheelEvent = event as WheelEvent;
  if (!wheelPreconditions(chart, wheelEvent, zoomOptions)) return;
  const rect = (wheelEvent.target as HTMLElement).getBoundingClientRect();
  const speed = zoomOptions.wheel!.speed!;
  const percentage = wheelEvent.deltaY >= 0 ? 2 - 1 / (1 - speed) : 1 + speed;
  const amount: ZoomAmount = {
    x: percentage,
    y: percentage,
    focalPoint: { x: wheelEvent.clientX - rect.left, y: wheelEvent.clientY - rect.top },
  };
  zoom(chart, amount, 'zoom', 'wheel');
  callback(state.handlers.onZoomComplete, [{ chart }]);
}
function addDebouncedHandler(chart: Chart, name: string, handler: ((ctx: { chart: Chart }) => void) | undefined, delay: number): void {
  if (handler) {
    getState(chart).handlers[name] = debounce(() => callback(handler, [{ chart }]), delay) as unknown as EventListener & { target?: EventTarget };
  }
}
function addListeners(chart: Chart, options: ZoomPluginOptions): void {
  const canvas = chart.canvas;
  const wheelOptions = options.zoom?.wheel;
  const dragOptions = options.zoom?.drag;
  const onZoomComplete = options.zoom?.onZoomComplete;
  if (wheelOptions?.enabled) {
    addHandler(chart, canvas, 'wheel', wheel);
    addDebouncedHandler(chart, 'onZoomComplete', onZoomComplete, 250);
  } else {
    removeHandler(chart, 'wheel');
  }
  if (dragOptions?.enabled) {
    addHandler(chart, canvas, 'mousedown', mouseDown);
    addHandler(chart, canvas.ownerDocument!, 'mouseup', mouseUp);
  } else {
    removeHandler(chart, 'mousedown');
    removeHandler(chart, 'mousemove');
    removeHandler(chart, 'mouseup');
    removeHandler(chart, 'keydown');
  }
}
function removeListeners(chart: Chart): void {
  removeHandler(chart, 'mousedown');
  removeHandler(chart, 'mousemove');
  removeHandler(chart, 'mouseup');
  removeHandler(chart, 'wheel');
  removeHandler(chart, 'click');
  removeHandler(chart, 'keydown');
}

// ---- drag-rectangle overlay ----

function drawDragOverlay(chart: Chart, caller: string, options: ZoomPluginOptions): void {
  const dragOptions = options.zoom!.drag!;
  const { dragStart, dragEnd } = getState(chart);
  if (dragOptions.drawTime !== caller || !dragEnd) return;
  const { left, top, width, height } = computeDragRect(chart, options.zoom!.mode, { dragStart: dragStart!, dragEnd }, dragOptions.maintainAspectRatio);
  const ctx = chart.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = dragOptions.backgroundColor || 'rgba(225,225,225,0.3)';
  ctx.fillRect(left, top, width, height);
  if (dragOptions.borderWidth && dragOptions.borderWidth > 0) {
    ctx.lineWidth = dragOptions.borderWidth;
    ctx.strokeStyle = dragOptions.borderColor || 'rgba(225,225,225)';
    ctx.strokeRect(left, top, width, height);
  }
  ctx.restore();
}

const DEFAULT_OPTIONS: ZoomPluginOptions = {
  pan: { enabled: false, mode: 'xy', threshold: 10, modifierKey: null },
  zoom: {
    wheel: { enabled: false, speed: 0.1, modifierKey: null },
    drag: { enabled: false, drawTime: 'beforeDatasetsDraw', modifierKey: null },
    mode: 'xy',
  },
};

/**
 * Chart.js plugin providing mouse-wheel zoom and mouse-drag-to-zoom-
 * rectangle interaction, plus a full programmatic zoom/pan API attached
 * directly onto the live chart instance. See this file's own header
 * comment for the deliberate Hammer.js/pinch/gesture-pan scope
 * decision.
 *
 * Supplied to Chart.js via its inline `plugins` array rather than a
 * global `Chart.register(...)` call.
 */
export const zoomPlugin: Plugin<ChartType, ZoomPluginOptions> = {
  id: 'zoom',

  start(chart: Chart, _args, options: ZoomPluginOptions): void {
    const state = getState(chart);
    state.options = options;
    const chartWithApi = chart as Chart & Record<string, unknown>;
    chartWithApi.pan = (delta: number | { x?: number; y?: number }, enabledScales?: LiveScale[], transition?: string) => pan(chart, delta, enabledScales, transition);
    chartWithApi.zoom = (amount: ZoomAmount, transition?: string) => zoom(chart, amount, transition);
    chartWithApi.zoomRect = (p0: Point, p1: Point, transition?: string) => zoomRect(chart, p0, p1, transition);
    chartWithApi.zoomScale = (id: string, range: { min: number; max: number }, transition?: string) => zoomScale(chart, id, range, transition);
    chartWithApi.resetZoom = (transition?: string) => resetZoom(chart, transition);
    chartWithApi.getZoomLevel = () => getZoomLevel(chart);
    chartWithApi.getInitialScaleBounds = () => getInitialScaleBounds(chart);
    chartWithApi.getZoomedScaleBounds = () => getZoomedScaleBounds(chart);
    chartWithApi.isZoomedOrPanned = () => isZoomedOrPanned(chart);
    chartWithApi.isZoomingOrPanning = () => isZoomingOrPanning(chart);
  },

  beforeEvent(chart: Chart, args): boolean | void {
    if (isZoomingOrPanning(chart)) return false;
    const event = args.event;
    if (event.type === 'click' || event.type === 'mouseup') {
      const state = getState(chart);
      if (state.filterNextClick) {
        state.filterNextClick = false;
        return false;
      }
    }
  },

  beforeUpdate(chart: Chart, _args, options: ZoomPluginOptions): void {
    const state = getState(chart);
    state.options = options;
    addListeners(chart, options);
  },

  beforeDatasetsDraw(chart: Chart, _args, options: ZoomPluginOptions): void {
    drawDragOverlay(chart, 'beforeDatasetsDraw', options);
  },
  afterDatasetsDraw(chart: Chart, _args, options: ZoomPluginOptions): void {
    drawDragOverlay(chart, 'afterDatasetsDraw', options);
  },
  beforeDraw(chart: Chart, _args, options: ZoomPluginOptions): void {
    drawDragOverlay(chart, 'beforeDraw', options);
  },
  afterDraw(chart: Chart, _args, options: ZoomPluginOptions): void {
    drawDragOverlay(chart, 'afterDraw', options);
  },

  stop(chart: Chart): void {
    removeListeners(chart);
    removeState(chart);
  },

  defaults: DEFAULT_OPTIONS as unknown as Record<string, unknown>,
};
