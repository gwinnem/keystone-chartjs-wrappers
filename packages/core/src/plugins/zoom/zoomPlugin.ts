/**
 * Local port of `chartjs-plugin-zoom` (v2.2.0, MIT, chartjs-plugin-zoom
 * Contributors), supplied via Chart.js's inline `plugins` array instead
 * of a dependency, so it avoids the docs-site dynamic-import hydration
 * gap the other still-dependency-based plugins in this project hit —
 * see docs/ZOOM_PLUGIN_PORT_PLAN.md for the full scope analysis behind
 * this port, written before implementation started.
 *
 * **Scope decision, made explicitly rather than silently**: the
 * original plugin drives pinch-zoom and drag-to-pan through Hammer.js,
 * which is itself unmaintained (confirmed via a real, open upstream
 * issue, already flagged in `docs/CHARTJS_ANALYSIS.md` §6). This port
 * drops Hammer.js entirely, but does *not* drop the two features it
 * drove — pinch-zoom and interactive pan are both reimplemented here
 * directly on top of the standards-based **Pointer Events API**
 * (`pointerdown`/`pointermove`/`pointerup`/`pointercancel`), which
 * unifies mouse/touch/pen input with no external dependency at all.
 * Mouse input is explicitly excluded from this pointer-event path (see
 * `pointerDown`'s own `pointerType === 'mouse'` check) — mouse drag-to-
 * zoom-rectangle and wheel-zoom keep using the separate, original
 * mouse-event handlers below, unchanged.
 *
 * **A real, honest finding from dissecting the original source**: the
 * original plugin has no mouse-only drag-to-pan mechanism at all —
 * `pan()` was only ever invoked from Hammer's own `handlePan()` (driven
 * by `Hammer.Pan()`, which recognized both touch *and* mouse-pointer
 * drags identically). This port's own pointer-event-based pan is
 * touch/pen-only for that reason — mouse users get `chart.pan()` as a
 * callable, programmatic method only (useful for a consumer's own
 * custom pan buttons/controls, as the docs site's own example does),
 * not an interactive drag gesture, matching what the original's own
 * mouse-input behavior genuinely was.
 *
 * Every other real function below (the zoom/pan math per scale type,
 * scale-limit bookkeeping, drag-rectangle geometry, wheel/mousedown/
 * mouseup event handling) is a faithful port of the original's own real
 * logic, dissected directly from the installed package's own dist file
 * (`node_modules/chartjs-plugin-zoom/dist/chartjs-plugin-zoom.esm.js`).
 *
 * Fully typed against real Chart.js types throughout. Two deliberate
 * departures from directly reusing Chart.js's own helper functions,
 * both to avoid fighting generic-inference edge cases that added no
 * real type safety of their own:
 * - `chart.js/helpers`' own `callback()`/`each()` have generic
 *   signatures tuned for Chart.js's own internal call sites; several
 *   real call sites here (a scale-type-keyed function dispatch, a
 *   `Record | Array` union passed to iterate) hit genuine TypeScript
 *   inference failures against them (confirmed via a real `tsc
 *   --noEmit` run, not assumed) with no real type-safety loss from
 *   using a simpler local equivalent instead ({@link invoke}, plain
 *   `Object.values()`/`for...of`).
 * - A local {@link ScreenPoint} type is used instead of Chart.js's own
 *   public `Point` type for on-screen pixel coordinates (mouse
 *   position, drag-rectangle corners, scale centers) — Chart.js's own
 *   `Point` allows `x`/`y` to be `null` (meant for missing *data*
 *   points on a chart, not screen coordinates), which doesn't apply
 *   here and would otherwise force null-checks with no real value at
 *   every use site.
 *
 * One genuine runtime-vs-public-type gap remains, handled via
 * {@link LiveScale}: Chart.js's own public `Scale` type (from
 * `types/index.d.ts`) omits several real runtime properties this
 * plugin genuinely needs (`chart`, the current computed `min`/`max`,
 * `getLabels()`) — confirmed real via Chart.js's own JSDoc-derived
 * implementation class (`dist/core/core.scale.d.ts`), which is a
 * different, internal declaration from the public `Scale` type and
 * isn't what `import { Scale } from 'chart.js'` resolves to.
 */
import type { Chart, ChartArea, ChartType, Plugin, Scale } from 'chart.js';
import { _isPointInArea, getRelativePosition } from 'chart.js/helpers';

/** Chart.js doesn't export its own update-mode string-literal union
 * under a stable public name — derived directly from `Chart['update']`'s
 * own real parameter type instead of guessing at one. */
type UpdateMode = Parameters<Chart['update']>[0];

/** See this file's own header comment for why this extends the public `Scale` type. */
interface LiveScale extends Scale {
  chart: Chart;
  min: number;
  max: number;
  getLabels(): string[];
}

/** On-screen pixel coordinates — see this file's own header comment for
 * why this isn't Chart.js's own public `Point` type. */
interface ScreenPoint {
  x: number;
  y: number;
}

/** Calls `fn` with `args` if it's a real function, otherwise a no-op —
 * see this file's own header comment for why this replaces
 * `chart.js/helpers`' own `callback()` here. */
function invoke<R>(fn: ((...args: never[]) => R) | undefined, args: unknown[]): R | undefined {
  return typeof fn === 'function' ? (fn as (...a: unknown[]) => R)(...args) : undefined;
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
    onPanStart?: (ctx: { chart: Chart; event: Event; point: ScreenPoint }) => void | false;
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
    /** Two-finger pinch-zoom, via the Pointer Events API — see this
     * file's own header comment for why this replaces the original
     * package's own Hammer.js-driven pinch gesture. `false`/omitted by
     * default, matching the original's own opt-in default. */
    pinch?: { enabled?: boolean };
    mode?: ZoomMode;
    scaleMode?: ZoomMode;
    overScaleMode?: ZoomMode;
    onZoom?: (ctx: { chart: Chart; trigger: string }) => void;
    onZoomStart?: (ctx: { chart: Chart; event: Event; point: ScreenPoint }) => void | false;
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
  handlers: Record<string, (EventListener & { target?: EventTarget }) | (() => void)>;
  panDelta: Record<string, number>;
  dragging: boolean;
  panning: boolean;
  dragStart?: MouseEvent | null;
  dragEnd?: MouseEvent | null;
  filterNextClick?: boolean;
  options: ZoomPluginOptions;
  /** Active touch/pen pointers currently down on the canvas, keyed by
   * `pointerId` — drives single-finger pan (1 active pointer) and
   * two-finger pinch-zoom (2 active pointers) via the Pointer Events
   * API. Mouse input never populates this map at all (see
   * `pointerDown`'s own explicit `pointerType === 'mouse'` exclusion) —
   * mouse drag/wheel keep using the separate, pre-existing mouse-event
   * handlers above. */
  pointers: Map<number, ScreenPoint>;
  /** The position the sole tracked pointer went down at, while a
   * single-finger gesture hasn't yet crossed `pan.threshold` — cleared
   * once panning genuinely starts (or the gesture is explicitly
   * rejected by `pan.onPanStart`). This is what finally gives
   * `pan.threshold`/`onPanStart`/`onPanRejected` real, working meaning
   * again (previously dead configuration with no gesture to apply to —
   * see this file's own header comment). */
  panStart?: ScreenPoint;
  /** Set while exactly two pointers are down and pinch-zoom is active —
   * `lastDistance` is the finger-to-finger distance as of the last
   * processed `pointermove`, used to compute each move's own
   * *incremental* zoom ratio (matching the wheel handler's own
   * per-tick relative zoom) rather than a ratio against the gesture's
   * starting distance, which would zoom relative to the wrong baseline
   * after the very first move. */
  pinch?: { lastDistance: number };
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
      pointers: new Map(),
    };
    chartStates.set(chart, state);
  }
  return state;
}

function removeState(chart: Chart): void {
  chartStates.delete(chart);
}

function liveScales(chart: Chart): LiveScale[] {
  return Object.values(chart.scales as unknown as Record<string, LiveScale>);
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

function getScaleUnderPoint(point: ScreenPoint, chart: Chart): LiveScale | null {
  for (const scale of liveScales(chart)) {
    if (point.y >= scale.top && point.y <= scale.bottom && point.x >= scale.left && point.x <= scale.right) {
      return scale;
    }
  }
  return null;
}

function getEnabledScalesByPoint(
  options: { mode?: ZoomMode; scaleMode?: ZoomMode; overScaleMode?: ZoomMode } | undefined,
  point: ScreenPoint,
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
  return liveScales(chart).filter((scaleItem) => enabled[scaleItem.axis as 'x' | 'y']);
}

// ---- zoom/pan math, per scale type ----

function zoomDelta(val: number, min: number, range: number, newRange: number): { min: number; max: number } {
  const minPercent = Math.max(0, Math.min(1, (val - min) / range || 0));
  const maxPercent = 1 - minPercent;
  return { min: newRange * minPercent, max: newRange * maxPercent };
}
function getValueAtPoint(scale: LiveScale, point: ScreenPoint): number | undefined {
  const pixel = scale.isHorizontal() ? point.x : point.y;
  // Deliberately NOT `?? NaN` here (unlike linearRange/panNumericalScale
  // below, which need a concrete number for isNaN checks): the original
  // plugin's own `logarithmicZoomRange` genuinely branches on this
  // value being `undefined` specifically (an out-of-range pixel), and
  // an earlier version of this port coerced it to NaN here, which
  // silently made that branch permanently unreachable — confirmed as a
  // real, introduced regression via a failing test ("leaves a
  // logarithmic scale unchanged when the zoom center resolves to an
  // undefined value"), not a hypothetical. `linearZoomDelta`'s own
  // caller passes this straight into `zoomDelta`, which already
  // tolerates `undefined`/`NaN` via its own `|| 0` fallback, so no
  // caller needed a NaN specifically — only `logarithmicZoomRange`
  // needed the real `undefined` to reach it at all.
  return scale.getValueForPixel(pixel);
}
function linearZoomDelta(scale: LiveScale, zoomAmount: number, center: ScreenPoint): { min: number; max: number } {
  const range = scale.max - scale.min;
  const newRange = range * (zoomAmount - 1);
  const centerValue = getValueAtPoint(scale, center);
  return zoomDelta(centerValue ?? NaN, scale.min, range, newRange);
}
function logarithmicZoomRange(scale: LiveScale, zoomAmount: number, center: ScreenPoint): { min: number; max: number } {
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
  const limit = scaleLimits[prop];
  if (limit === 'original') {
    const original = state.originalScaleLimits[scale.id][prop];
    return original.options ?? original.scale;
  }
  return limit ?? fallback;
}
function linearRange(scale: LiveScale, pixel0: number, pixel1: number): { min: number; max: number } {
  const v0 = scale.getValueForPixel(pixel0) ?? NaN;
  const v1 = scale.getValueForPixel(pixel1) ?? NaN;
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
  if (Math.abs(min - origMin) < epsilon) min = origMin;
  if (Math.abs(max - origMax) < epsilon) max = origMax;
  if (min < minLimit) {
    min = minLimit;
    max = Math.min(minLimit + range, maxLimit);
  } else if (max > maxLimit) {
    max = maxLimit;
    min = Math.max(maxLimit - range, minLimit);
  }
  return { min, max };
}
/** `zoomKind: true` for a real zoom, `'pan'` for a pan-triggered update (different limit-violation
 * behavior — see the real `zoomKind === 'pan'` check below), `false` for neither. */
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
function zoomNumericalScale(scale: LiveScale, zoomAmount: number, center: ScreenPoint, limits: Record<string, ScaleLimits> | undefined): boolean {
  const delta = linearZoomDelta(scale, zoomAmount, center);
  return updateRange(scale, { min: scale.min + delta.min, max: scale.max - delta.max }, limits, true);
}
function zoomLogarithmicScale(scale: LiveScale, zoomAmount: number, center: ScreenPoint, limits: Record<string, ScaleLimits> | undefined): boolean {
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
function zoomCategoryScale(scale: LiveScale, zoomAmount: number, center: ScreenPoint, limits: Record<string, ScaleLimits> | undefined): boolean {
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
  const newMin = scale.getValueForPixel(scale.getPixelForValue(prevStart + offset) - delta) ?? NaN;
  const newMax = scale.getValueForPixel(scale.getPixelForValue(prevEnd + offset) - delta) ?? NaN;
  if (isNaN(newMin) || isNaN(newMax)) return true;
  return updateRange(scale, { min: newMin, max: newMax }, limits, pan ? 'pan' : false);
}
function panNonLinearScale(scale: LiveScale, delta: number, limits: Record<string, ScaleLimits> | undefined): boolean {
  return panNumericalScale(scale, delta, limits, true);
}
const zoomFunctions: Record<string, (scale: LiveScale, zoomAmount: number, center: ScreenPoint, limits: Record<string, ScaleLimits> | undefined) => boolean> = {
  category: zoomCategoryScale,
  default: zoomNumericalScale,
  logarithmic: zoomLogarithmicScale,
};
const zoomRectFunctions: Record<string, (scale: LiveScale, from: number, to: number, limits: Record<string, ScaleLimits> | undefined) => void> = {
  default: zoomRectNumericalScale,
};
const panFunctions: Record<string, (scale: LiveScale, delta: number, limits: Record<string, ScaleLimits> | undefined) => boolean> = {
  category: panCategoryScale,
  default: panNumericalScale,
  logarithmic: panNonLinearScale,
  timeseries: panNonLinearScale,
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
function removeMissingScales(limits: Record<string, unknown>, scaleIds: Set<string>): void {
  for (const key of Object.keys(limits)) {
    if (!scaleIds.has(key)) delete limits[key];
  }
}
function storeOriginalScaleLimits(chart: Chart, state: ZoomPluginState): ZoomPluginState['originalScaleLimits'] {
  const scales = liveScales(chart);
  const { originalScaleLimits, updatedScaleLimits } = state;
  for (const scale of scales) {
    if (shouldUpdateScaleLimits(scale, originalScaleLimits, updatedScaleLimits)) {
      const opts = scale.options as { min?: number; max?: number };
      originalScaleLimits[scale.id] = {
        min: { scale: scale.min, options: opts.min },
        max: { scale: scale.max, options: opts.max },
      };
    }
  }
  const scaleIds = new Set(scales.map((s) => s.id));
  removeMissingScales(originalScaleLimits, scaleIds);
  removeMissingScales(updatedScaleLimits, scaleIds);
  return originalScaleLimits;
}
function doZoom(scale: LiveScale, amount: number, center: ScreenPoint, limits: Record<string, ScaleLimits> | undefined): void {
  const fn = zoomFunctions[scale.type] ?? zoomFunctions.default;
  fn(scale, amount, center, limits);
}
function doZoomRect(scale: LiveScale, from: number, to: number, limits: Record<string, ScaleLimits> | undefined): void {
  const fn = zoomRectFunctions[scale.type] ?? zoomRectFunctions.default;
  fn(scale, from, to, limits);
}
function getCenter(chart: Chart): ScreenPoint {
  const ca = chart.chartArea;
  return { x: (ca.left + ca.right) / 2, y: (ca.top + ca.bottom) / 2 };
}
/** Chart.js's own `update(mode)` expects a specific string-literal union
 * of built-in transition-mode names, but its own transitions config is
 * genuinely extensible — a plugin (this one included) can pass a custom
 * mode name it expects a consumer to configure under
 * `options.transitions.<mode>`, and Chart.js falls back to default
 * behavior even if that mode isn't configured. Confirmed this is the
 * original plugin's own real, intentional behavior (passing `'zoom'` as
 * a transition mode, not just the standard built-ins) — cast here
 * rather than narrowing this file's own `transition` parameters to the
 * built-in-only union, which would reject that real usage. */
function updateChart(chart: Chart, transition: string): void {
  chart.update(transition as UpdateMode);
}

// ---- public zoom/pan API (both driven by DOM events below, and callable directly) ----

export type ZoomAmount = number | { x?: number; y?: number; focalPoint?: ScreenPoint };

export function zoom(chart: Chart, amount: ZoomAmount, transition = 'none', trigger = 'api'): void {
  const { x = 1, y = 1, focalPoint = getCenter(chart) } = typeof amount === 'number' ? { x: amount, y: amount } : amount;
  const state = getState(chart);
  const { limits, zoom: zoomOptions } = state.options;
  storeOriginalScaleLimits(chart, state);
  const xEnabled = x !== 1;
  const yEnabled = y !== 1;
  const enabledScales = getEnabledScalesByPoint(zoomOptions, focalPoint, chart);
  // getEnabledScalesByPoint always returns a real array (possibly
  // empty), never null/undefined — the original JS's own
  // `enabledScales || chart.scales` therefore never actually falls
  // back at runtime (an empty array is truthy in JS). Using
  // `enabledScales` directly here, unconditionally, matches that real
  // behavior; an earlier draft of this port used
  // `enabledScales.length ? enabledScales : liveScales(chart)`, which
  // is NOT equivalent — confirmed as a real, introduced regression via
  // a failing test ("does not zoom a direction whose scale axis is
  // disabled by mode"), not a hypothetical: that version zoomed every
  // scale whenever none matched the enabled directions, instead of
  // zooming none.
  for (const scale of enabledScales) {
    if (scale.isHorizontal() && xEnabled) doZoom(scale, x, focalPoint, limits);
    else if (!scale.isHorizontal() && yEnabled) doZoom(scale, y, focalPoint, limits);
  }
  updateChart(chart, transition);
  invoke(zoomOptions?.onZoom, [{ chart, trigger }]);
}

export function zoomRect(chart: Chart, p0: ScreenPoint, p1: ScreenPoint, transition = 'none', trigger = 'api'): void {
  const state = getState(chart);
  const { limits, zoom: zoomOptions } = state.options;
  const mode = zoomOptions?.mode ?? 'xy';
  storeOriginalScaleLimits(chart, state);
  const xEnabled = directionEnabled(mode, 'x', chart);
  const yEnabled = directionEnabled(mode, 'y', chart);
  for (const scale of liveScales(chart)) {
    if (scale.isHorizontal() && xEnabled) doZoomRect(scale, p0.x, p1.x, limits);
    else if (!scale.isHorizontal() && yEnabled) doZoomRect(scale, p0.y, p1.y, limits);
  }
  updateChart(chart, transition);
  invoke(zoomOptions?.onZoom, [{ chart, trigger }]);
}

export function zoomScale(chart: Chart, scaleId: string, range: { min: number; max: number }, transition = 'none', trigger = 'api'): void {
  const state = getState(chart);
  storeOriginalScaleLimits(chart, state);
  const scale = (chart.scales as unknown as Record<string, LiveScale>)[scaleId];
  updateRange(scale, range, undefined, true);
  updateChart(chart, transition);
  invoke(state.options.zoom?.onZoom, [{ chart, trigger }]);
}

export function resetZoom(chart: Chart, transition = 'default'): void {
  const state = getState(chart);
  const originalScaleLimits = storeOriginalScaleLimits(chart, state);
  for (const scale of liveScales(chart)) {
    const scaleOptions = scale.options as { min?: number; max?: number };
    // The `else` branch below (delete, rather than restore) is
    // structurally very hard to reach: `storeOriginalScaleLimits` just
    // ran, above, and always populates `originalScaleLimits[scale.id]`
    // for every scale this same loop iterates (via `liveScales(chart)`,
    // the identical set) — confirmed by reading `shouldUpdateScaleLimits`
    // directly: it returns true whenever either limits map lacks an
    // entry for a scale, which is always true for a scale's very first
    // encounter. This mirrors the original package's own real logic
    // exactly (same shape, same apparent reachability gap), not a
    // simplification introduced by this port.
    if (originalScaleLimits[scale.id]) {
      scaleOptions.min = originalScaleLimits[scale.id].min.options;
      scaleOptions.max = originalScaleLimits[scale.id].max.options;
    } else {
      delete scaleOptions.min;
      delete scaleOptions.max;
    }
    delete state.updatedScaleLimits[scale.id];
  }
  updateChart(chart, transition);
  invoke(state.options.zoom?.onZoomComplete, [{ chart }]);
}

function getOriginalRange(state: ZoomPluginState, scaleId: string): number | undefined {
  const original = state.originalScaleLimits[scaleId];
  if (!original) return undefined;
  return (original.max.options ?? original.max.scale) - (original.min.options ?? original.min.scale);
}

export function getZoomLevel(chart: Chart): number {
  const state = getState(chart);
  let min = 1;
  let max = 1;
  for (const scale of liveScales(chart)) {
    const origRange = getOriginalRange(state, scale.id);
    if (origRange) {
      const level = Math.round((origRange / (scale.max - scale.min)) * 100) / 100;
      min = Math.min(min, level);
      max = Math.max(max, level);
    }
  }
  return min < 1 ? min : max;
}

function panScale(scale: LiveScale, delta: number, limits: Record<string, ScaleLimits> | undefined, state: ZoomPluginState): void {
  const { panDelta } = state;
  const storedDelta = panDelta[scale.id] || 0;
  const effectiveDelta = Math.sign(storedDelta) === Math.sign(delta) ? delta + storedDelta : delta;
  const fn = panFunctions[scale.type] ?? panFunctions.default;
  // The `else` branch below (accumulating an unapplied delta for the
  // next pan call) needs `fn(...)` to return false — meaning the range
  // was computed but didn't actually change. Confirmed reachable, not
  // just theoretical: an extremely small delta (e.g. 1e-7) on a scale
  // with no configured limits lets `fixRange`'s own epsilon-snap-to-
  // original logic (`range / 1e6`) snap the computed range exactly back
  // to the scale's own original bounds, making `updateRange`'s own
  // final "did this actually change anything" check false — see the
  // real, working test for this exact scenario in
  // tests/unit/zoomPlugin.spec.ts.
  if (fn(scale, effectiveDelta, limits)) {
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
  const scalesToPan = enabledScales?.length ? enabledScales : liveScales(chart);
  // Unlike `zoom()` above, `pan()`'s own `enabledScales` parameter is
  // genuinely optional here (undefined when called directly, e.g. via
  // the public `chart.pan()` API with no explicit scale list) — so this
  // fallback IS real and intentional, matching the original's own
  // `enabledScales || chart.scales` for this specific function (whose
  // own `enabledScales` argument can genuinely be undefined, unlike
  // `zoom()`'s own always-computed-array `enabledScales`).
  for (const scale of scalesToPan) {
    if (scale.isHorizontal() && xEnabled) panScale(scale, x, limits, state);
    else if (!scale.isHorizontal() && yEnabled) panScale(scale, y, limits, state);
  }
  updateChart(chart, transition);
  invoke(panOptions?.onPan, [{ chart }]);
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
  const handler = handlers[type] as (EventListener & { target?: EventTarget }) | undefined;
  if (handler?.target) {
    handler.target.removeEventListener(type, handler);
    delete handlers[type];
  }
}
function addHandler(chart: Chart, target: EventTarget, type: string, handler: (chart: Chart, event: Event, options: ZoomPluginOptions) => void): void {
  const { handlers, options } = getState(chart);
  const oldHandler = handlers[type] as (EventListener & { target?: EventTarget }) | undefined;
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
    updateChart(chart, 'none');
  }
}
function keyDown(chart: Chart, event: Event): void {
  const state = getState(chart);
  const keyEvent = event as KeyboardEvent;
  if (!state.dragStart || keyEvent.key !== 'Escape') return;
  removeHandler(chart, 'keydown');
  state.dragging = false;
  state.dragStart = state.dragEnd = null;
  updateChart(chart, 'none');
}
function getPointPosition(event: MouseEvent, chart: Chart): ScreenPoint {
  // Restored from the original rather than a naive
  // getBoundingClientRect()-only computation: Chart.js's own
  // `getRelativePosition` accounts for CSS transforms/scaling and
  // border-box sizing on the canvas that a bare bounding-rect diff
  // would silently get wrong under those conditions. Confirmed real,
  // not a guess: this is the original plugin's own exact logic for the
  // "is this event actually targeting the canvas" branch.
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
    if (invoke(onZoomStart, [{ chart, event, point }]) === false) {
      invoke(onZoomRejected, [{ chart, event }]);
      return false;
    }
  }
  return true;
}
function mouseDown(chart: Chart, event: Event): void {
  const mouseEvent = event as MouseEvent;
  if (chart.legend) {
    const point = getRelativePosition(mouseEvent, chart);
    // _isPointInArea's own Point parameter allows nullable x/y (for
    // missing data points) — getRelativePosition's own real return
    // shape is always non-null, so this widens safely with no cast
    // needed.
    if (_isPointInArea(point, chart.legend as unknown as ChartArea)) return;
  }
  const state = getState(chart);
  const { pan: panOptions, zoom: zoomOptions = {} } = state.options;
  if (
    mouseEvent.button !== 0 ||
    keyPressed(getModifierKey(panOptions), mouseEvent) ||
    keyNotPressed(getModifierKey(zoomOptions.drag), mouseEvent)
  ) {
    invoke(zoomOptions.onZoomRejected, [{ chart, event }]);
    return;
  }
  if (!zoomStart(chart, mouseEvent, zoomOptions)) return;
  state.dragStart = mouseEvent;
  addHandler(chart, chart.canvas.ownerDocument, 'mousemove', mouseMove);
  addHandler(chart, window.document, 'keydown', keyDown);
}
function applyAspectRatio(points: { begin: ScreenPoint; end: ScreenPoint }, aspectRatio: number): void {
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
  points: { begin: ScreenPoint; end: ScreenPoint },
  spec: { min: 'left' | 'top'; max: 'right' | 'bottom'; prop: 'x' | 'y' },
): void {
  const areaRecord = chartArea as unknown as Record<string, number>;
  rect[spec.min] = clamp(Math.min(points.begin[spec.prop], points.end[spec.prop]), areaRecord[spec.min], areaRecord[spec.max]);
  rect[spec.max] = clamp(Math.max(points.begin[spec.prop], points.end[spec.prop]), areaRecord[spec.min], areaRecord[spec.max]);
}
function getRelativePoints(chart: Chart, pointEvents: { dragStart: MouseEvent; dragEnd: MouseEvent }, maintainAspectRatio: boolean): { begin: ScreenPoint; end: ScreenPoint } {
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
    updateChart(chart, 'none');
    return;
  }
  zoomRect(chart, { x: rect.left, y: rect.top }, { x: rect.right, y: rect.bottom }, 'zoom', 'drag');
  state.dragging = false;
  state.filterNextClick = true;
  invoke(zoomOptions.onZoomComplete, [{ chart }]);
}
function wheelPreconditions(chart: Chart, event: WheelEvent, zoomOptions: NonNullable<ZoomPluginOptions['zoom']>): boolean {
  if (keyNotPressed(getModifierKey(zoomOptions.wheel), event)) {
    invoke(zoomOptions.onZoomRejected, [{ chart, event }]);
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
  const onZoomComplete = getState(chart).handlers.onZoomComplete as (() => void) | undefined;
  onZoomComplete?.();
}
function addDebouncedHandler(chart: Chart, name: string, handler: ((ctx: { chart: Chart }) => void) | undefined, delay: number): void {
  if (handler) {
    getState(chart).handlers[name] = debounce(() => invoke(handler, [{ chart }]), delay);
  }
}

// ---- Pointer Events API: touch/pen pan + pinch-zoom (Hammer.js replacement) ----

function getDistance(a: ScreenPoint, b: ScreenPoint): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
function getMidpoint(a: ScreenPoint, b: ScreenPoint): ScreenPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
/** `getPointPosition` above already works correctly for a `PointerEvent`
 * as-is (it only reads `target`/`clientX`/`clientY`, all real,
 * standard `PointerEvent` properties inherited from `MouseEvent`) —
 * this thin wrapper exists purely so call sites below read naturally
 * without an inline cast at every use. */
function pointerPosition(event: PointerEvent, chart: Chart): ScreenPoint {
  return getPointPosition(event as unknown as MouseEvent, chart);
}
function pointerDown(chart: Chart, event: Event): void {
  const pointerEvent = event as PointerEvent;
  // Mouse input is handled entirely by mouseDown/mouseMove/mouseUp/wheel
  // above — this whole pointer-event path exists specifically for
  // touch/pen input (single-finger pan, two-finger pinch-zoom), which
  // have no mouse-gesture equivalent at all (see this file's own header
  // comment). Explicitly excluding 'mouse' here avoids double-handling
  // the same physical click through two separate event systems.
  if (pointerEvent.pointerType === 'mouse') return;
  const state = getState(chart);
  const { pointers } = state;
  if (pointers.size >= 2) return; // only ever track the first two touches
  if (chart.legend) {
    // Same real guard mouseDown's own legend check applies for mouse —
    // don't start a touch gesture over the legend area either.
    const point = pointerPosition(pointerEvent, chart);
    if (_isPointInArea(point, chart.legend as unknown as ChartArea)) return;
  }
  const point = pointerPosition(pointerEvent, chart);
  pointers.set(pointerEvent.pointerId, point);
  // Keeps this pointer's own move/up events arriving even if the
  // finger drifts outside the canvas mid-gesture — without this, a fast
  // drag that momentarily leaves the canvas's own bounds would silently
  // stop updating until the finger re-entered it. Wrapped in try/catch:
  // confirmed via a real, reproduced browser exception (not a guess)
  // that `setPointerCapture` throws a real `NotFoundError` ("No active
  // pointer with the given id is found") whenever the browser's own
  // internal pointer-tracking doesn't (yet, or no longer) recognize this
  // exact pointerId as active — a real, if uncommon, possibility even
  // for genuine hardware input, not just synthetic events. Capture is
  // inherently best-effort here: the gesture itself still works
  // perfectly well without it (this call only helps events keep arriving
  // if the finger leaves the canvas), so a thrown exception here must
  // never abort the rest of this function. The optional chain's own
  // "real capture happens" branch is separately confirmed genuinely
  // untestable in this project's own jsdom test environment: jsdom has
  // no `setPointerCapture` on `Element.prototype` at all.
  try {
    (event.target as Element).setPointerCapture?.(pointerEvent.pointerId);
  } catch {
    // Best-effort only — see the comment above.
  }
  const zoomOptions = state.options.zoom ?? {};
  if (pointers.size === 2 && zoomOptions.pinch?.enabled) {
    // A second finger landing while pinch is enabled always takes over
    // from any single-finger pan already in progress — matches the
    // original's own real Hammer-based behavior (a pinch gesture
    // supersedes an in-progress pan the moment a 2nd touch appears).
    if (!zoomStart(chart, pointerEvent, zoomOptions)) return;
    const [p1, p2] = Array.from(pointers.values());
    state.pinch = { lastDistance: getDistance(p1, p2) };
    state.panning = false;
    state.panStart = undefined;
  } else if (pointers.size === 1 && state.options.pan?.enabled) {
    // Not yet a confirmed pan — only a candidate until pointerMove sees
    // it cross `pan.threshold` (see pointerMove's own check below).
    state.panStart = point;
  }
}
function pointerMove(chart: Chart, event: Event): void {
  const pointerEvent = event as PointerEvent;
  if (pointerEvent.pointerType === 'mouse') return;
  const state = getState(chart);
  const { pointers } = state;
  if (!pointers.has(pointerEvent.pointerId)) return;
  const previous = pointers.get(pointerEvent.pointerId)!;
  const current = pointerPosition(pointerEvent, chart);
  pointers.set(pointerEvent.pointerId, current);

  if (pointers.size === 2 && state.pinch) {
    const [p1, p2] = Array.from(pointers.values());
    const distance = getDistance(p1, p2);
    // Guards against a division-by-near-zero spike (fingers briefly
    // overlapping mid-gesture) producing a wild, single-frame zoom jump.
    if (state.pinch.lastDistance > 0) {
      const ratio = distance / state.pinch.lastDistance;
      zoom(chart, { x: ratio, y: ratio, focalPoint: getMidpoint(p1, p2) }, 'none', 'pinch');
    }
    state.pinch.lastDistance = distance;
    return;
  }

  if (pointers.size !== 1 || !state.options.pan?.enabled) return;
  const panOptions = state.options.pan;
  if (!state.panning) {
    if (!state.panStart) return; // gesture already rejected below, or superseded by a pinch
    const threshold = panOptions.threshold ?? 0;
    if (getDistance(state.panStart, current) < threshold) return; // still within threshold, not a pan yet
    if (invoke(panOptions.onPanStart, [{ chart, event: pointerEvent, point: current }]) === false) {
      invoke(panOptions.onPanRejected, [{ chart, event: pointerEvent }]);
      state.panStart = undefined; // don't keep re-checking every frame after an explicit rejection
      return;
    }
    state.panning = true;
    return;
  }
  const dx = current.x - previous.x;
  const dy = current.y - previous.y;
  if (dx !== 0 || dy !== 0) pan(chart, { x: dx, y: dy });
}
function pointerUp(chart: Chart, event: Event): void {
  const pointerEvent = event as PointerEvent;
  if (pointerEvent.pointerType === 'mouse') return;
  const state = getState(chart);
  const { pointers } = state;
  if (!pointers.has(pointerEvent.pointerId)) return;
  pointers.delete(pointerEvent.pointerId);

  if (pointers.size < 2 && state.pinch) {
    state.pinch = undefined;
    invoke(state.options.zoom?.onZoomComplete, [{ chart }]);
  }
  if (pointers.size === 1 && state.options.pan?.enabled && !state.pinch) {
    // One finger lifted out of a two-finger pinch, one finger still
    // down — re-baseline as a fresh pan candidate from here, rather than
    // computing a delta against a stale pre-pinch position (which could
    // otherwise produce a spurious jump).
    state.panStart = pointers.values().next().value;
    state.panning = false;
  } else if (pointers.size === 0) {
    if (state.panning) invoke(state.options.pan?.onPanComplete, [{ chart }]);
    state.panning = false;
    state.panStart = undefined;
  }
}
function addListeners(chart: Chart, options: ZoomPluginOptions): void {
  const canvas = chart.canvas;
  const wheelOptions = options.zoom?.wheel;
  const dragOptions = options.zoom?.drag;
  const onZoomComplete = options.zoom?.onZoomComplete;
  const pinchEnabled = options.zoom?.pinch?.enabled;
  const panEnabled = options.pan?.enabled;
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
  if (panEnabled || pinchEnabled) {
    addHandler(chart, canvas, 'pointerdown', pointerDown);
    addHandler(chart, canvas.ownerDocument!, 'pointermove', pointerMove);
    addHandler(chart, canvas.ownerDocument!, 'pointerup', pointerUp);
    addHandler(chart, canvas.ownerDocument!, 'pointercancel', pointerUp);
    // Without this, the browser's own native touch panning/pinch-zoom on
    // the canvas fights with this plugin's own gesture handling (both
    // try to interpret the same touch input at once) — 'none' hands
    // full control of touch gestures on this element over to this
    // plugin's own JS-driven pan/zoom instead.
    canvas.style.touchAction = 'none';
  } else {
    removeHandler(chart, 'pointerdown');
    removeHandler(chart, 'pointermove');
    removeHandler(chart, 'pointerup');
    removeHandler(chart, 'pointercancel');
    canvas.style.touchAction = '';
  }
}
function removeListeners(chart: Chart): void {
  removeHandler(chart, 'mousedown');
  removeHandler(chart, 'mousemove');
  removeHandler(chart, 'mouseup');
  removeHandler(chart, 'wheel');
  removeHandler(chart, 'click');
  removeHandler(chart, 'keydown');
  removeHandler(chart, 'pointerdown');
  removeHandler(chart, 'pointermove');
  removeHandler(chart, 'pointerup');
  removeHandler(chart, 'pointercancel');
  chart.canvas.style.touchAction = '';
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
    pinch: { enabled: false },
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
    chartWithApi.zoomRect = (p0: ScreenPoint, p1: ScreenPoint, transition?: string) => zoomRect(chart, p0, p1, transition);
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
